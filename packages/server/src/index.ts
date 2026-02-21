import { Server, Socket } from "socket.io";
import { AgentProvider, OpenAIAgentProvider } from "./provider";
import { ClientSession } from "./session";
import { ToolRegistry } from "./tool_registry";
import { ToolRouter } from "./tool_router";
import { ToolDefinition, Logger, DefaultLogger } from "@mumaw/synapse-protocol";
import { SessionStorageProvider, InMemorySessionStorage } from "./storage";

export { ToolRegistry } from "./tool_registry";
export { ToolRouter } from "./tool_router";
export { AgentProvider, OpenAIAgentProvider } from "./provider";
export { InMemorySessionStorage } from "./storage";
export type { SessionStorageProvider, SessionData } from "./storage";
export type {
  AgentEvent,
  TextEvent,
  ToolCallEvent,
  ErrorEvent,
} from "./provider";

export type { ToolDefinition } from "@mumaw/synapse-protocol";

export interface AgentServerOptions {
  /** Default timeout for client tool execution in milliseconds. Defaults to 30000. */
  defaultToolTimeout?: number;
  /** Storage provider for persisting session state across restarts. Defaults to InMemorySessionStorage. */
  storage?: SessionStorageProvider;
  /** Custom agent provider for LLM execution. Defaults to OpenAIAgentProvider. */
  provider?: AgentProvider;
  /** Custom tool registry. Defaults to a new ToolRegistry instance. */
  registry?: ToolRegistry;
  /**
   * System prompt injected to initialize the LLM.
   * Defaults to: "You are a helpful AI agent with access to client-side tools..."
   */
  systemPrompt?: string;
  /**
   * Custom logger instance. Defaults to DefaultLogger.
   */
  logger?: Logger;
}

export class AgentServer {
  private io: Server;
  public provider: AgentProvider;
  public registry: ToolRegistry;
  public storage: SessionStorageProvider;
  private sessions: Map<string, ClientSession> = new Map();
  private options: AgentServerOptions;
  private logger: Logger;

  constructor(io: Server, options?: AgentServerOptions) {
    this.options = options || {};
    this.io = io;
    this.storage = this.options.storage || new InMemorySessionStorage();
    this.logger = this.options.logger || new DefaultLogger();

    if (this.options.registry) {
      this.registry = this.options.registry;
    } else {
      this.registry = new ToolRegistry(this.logger);
    }

    // Register an internal tool so the LLM can ask for the context at any time
    this.registry.register({
      name: "get_current_context",
      description:
        "Returns the user's current context, including their active page and tab.",
      executionSide: "server",
      handler: async (_params, context) => {
        return context;
      },
    });

    if (this.options.provider) {
      this.provider = this.options.provider;
    } else {
      if (!process.env.OPENAI_API_KEY) {
        this.logger.warn(
          "⚠️  WARNING: No OPENAI_API_KEY found and no custom provider supplied. Agent will fail to run.",
        );
      }
      this.provider = new OpenAIAgentProvider({
        apiKey: process.env.OPENAI_API_KEY || "",
        logger: this.logger,
      });
    }

    this.setupConnection();
  }

  register(tool: ToolDefinition): this {
    this.registry.register(tool);
    return this;
  }

  registerAll(tools: ToolDefinition[]): this {
    this.registry.registerAll(tools);
    return this;
  }

  use(router: ToolRouter): this {
    this.registry.use(router);
    return this;
  }

  private setupConnection() {
    this.io.on("connection", async (socket: Socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      // We use the socket ID as the session ID for now,
      // but developers could eventually pass in a custom token.
      const sessionId = socket.handshake.auth?.sessionId || socket.id;

      const session = new ClientSession(
        socket,
        sessionId,
        this.provider,
        this.registry,
        this.storage,
        this.options.defaultToolTimeout,
        this.options.systemPrompt,
        this.logger,
      );

      await session.initialize();
      this.sessions.set(socket.id, session);

      socket.on("disconnect", () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
        this.sessions.delete(socket.id);
      });
    });
  }
}
