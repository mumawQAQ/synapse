import { io, ManagerOptions, SocketOptions, Socket } from "socket.io-client";
import {
  AGENT_EVENTS,
  ToolInvocation,
  ToolInvocationSchema,
  ToolResult,
  ToolError,
  UserMessage,
  AgentResponse,
  ClientContext,
  Logger,
  DefaultLogger,
} from "@mumaw/synapse-protocol";

export interface AgentClientConfig {
  url: string;
  opts?: Partial<ManagerOptions & SocketOptions>;
  initialContext?: ClientContext;
  /**
   * Default timeout in milliseconds for client-executed tools.
   * If a tool takes longer than this to return, the SDK will automatically
   * report a timeout error back to the server. Defaults to 30000ms.
   */
  defaultToolTimeout?: number;
  /**
   * Custom logger instance. Defaults to DefaultLogger.
   */
  logger?: Logger;
}

export type AgentResponseHandler = (response: AgentResponse) => void;

type ToolExecutor = (params: unknown) => Promise<unknown> | unknown;

/**
 * AgentClient — the frontend counterpart of the server-authoritative agent.
 *
 * Key principles:
 * - NEVER sends tool definitions/schemas to the server
 * - Only registers local *executors* (functions) by tool ID
 * - Sends context updates so the server can filter tools
 */
export class AgentClient {
  public socket: Socket;

  /** Local executor map: toolId → function. No schemas are stored. */
  private executors = new Map<string, ToolExecutor>();

  private responseListeners = new Set<AgentResponseHandler>();

  /**
   * Scoped context contributions. Each component contributes a slice
   * under a unique scope key. All slices are merged before sending.
   */
  private contextScopes = new Map<string, ClientContext>();

  private defaultToolTimeout: number;
  private logger: Logger;

  constructor(config: AgentClientConfig) {
    this.socket = io(config.url, config.opts);
    this.defaultToolTimeout = config.defaultToolTimeout || 30000;
    this.logger = config.logger || new DefaultLogger();

    if (config.initialContext) {
      this.contextScopes.set("__initial__", config.initialContext);
    }

    this.setupGlobalListeners();
  }

  private setupGlobalListeners() {
    this.socket.on("connect", () => {
      this.logger.info(`[AgentClient] Connected: ${this.socket.id}`);

      // Sync context on (re)connect
      const merged = this.getMergedContext();
      if (Object.keys(merged).length > 0) {
        this.socket.emit(AGENT_EVENTS.CONTEXT_UPDATE, merged);
      }
    });

    // Listen for tool invocations from the server
    this.socket.on(AGENT_EVENTS.TOOL_INVOCATION, (payload: unknown) => {
      const parsed = ToolInvocationSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error(
          "[AgentClient] Invalid tool invocation:",
          parsed.error,
        );
        return;
      }
      this.handleInvocation(parsed.data);
    });

    // Listen for agent responses
    this.socket.on(AGENT_EVENTS.AGENT_RESPONSE, (payload: AgentResponse) => {
      this.responseListeners.forEach((listener) => listener(payload));
    });

    // Listen for context sync acknowledgements
    this.socket.on(AGENT_EVENTS.CONTEXT_SYNC, (payload: unknown) => {
      this.logger.debug("[AgentClient] Context synced:", payload);
    });
  }

  // ── Context (Scoped) ────────────────────────────────────────────────────────

  /**
   * Set a scoped context contribution. Each component should provide a
   * unique `scope` key (e.g. "TodoList", "SettingsPanel"). Multiple
   * components can contribute different slices without overwriting each other.
   */
  public setContext(scope: string, context: ClientContext): void {
    this.contextScopes.set(scope, context);
    this.emitMergedContext();
  }

  /**
   * Remove a scoped context contribution (e.g. when a component unmounts).
   * The merged context is re-sent without this scope's slice.
   */
  public removeContext(scope: string): void {
    this.contextScopes.delete(scope);
    this.emitMergedContext();
  }

  /**
   * Merge all scoped contributions into a single ClientContext.
   * - Simple fields are overwritten (last scope wins)
   * - `capabilities` arrays are concatenated and deduplicated
   */
  public getMergedContext(): ClientContext {
    const merged: ClientContext = {};
    const allCapabilities: string[] = [];

    for (const ctx of this.contextScopes.values()) {
      if (ctx.capabilities) {
        allCapabilities.push(...ctx.capabilities);
      }
      Object.assign(merged, ctx);
    }

    if (allCapabilities.length > 0) {
      merged.capabilities = [...new Set(allCapabilities)];
    }

    return merged;
  }

  private emitMergedContext(): void {
    if (this.socket.connected) {
      this.socket.emit(AGENT_EVENTS.CONTEXT_UPDATE, this.getMergedContext());
    }
  }

  // ── Executor Registration ───────────────────────────────────────────────────

  /**
   * Register a local executor for a tool ID. NO schema is sent to the server.
   * The server already knows the tool definition — this just tells the client
   * how to execute it when invoked.
   */
  public registerExecutor(toolId: string, func: ToolExecutor): void {
    const existing = this.executors.get(toolId);
    if (existing === func) return; // Skip if same function reference

    this.executors.set(toolId, func);
    this.logger.debug(`[AgentClient] Executor registered: ${toolId}`);
  }

  /**
   * Unregister a local executor. Does NOT notify the server because the
   * server owns the tool definitions.
   */
  public unregisterExecutor(toolId: string): void {
    this.executors.delete(toolId);
    this.logger.debug(`[AgentClient] Executor unregistered: ${toolId}`);
  }

  // ── Chat ────────────────────────────────────────────────────────────────────

  public chat(content: string): void {
    if (!this.socket.connected) {
      this.logger.warn(
        "[AgentClient] Cannot send message: Socket disconnected",
      );
      return;
    }
    this.socket.emit(AGENT_EVENTS.USER_MESSAGE, {
      content,
    } satisfies UserMessage);
  }

  // ── Response Listeners ──────────────────────────────────────────────────────

  public onResponse(handler: AgentResponseHandler): () => void {
    this.responseListeners.add(handler);
    return () => {
      this.responseListeners.delete(handler);
    };
  }

  // ── Tool Invocation Handler ─────────────────────────────────────────────────

  private async handleInvocation(invocation: ToolInvocation): Promise<void> {
    const executor = this.executors.get(invocation.toolId);

    if (!executor) {
      this.logger.error(
        `[AgentClient] No executor for tool: ${invocation.toolId}`,
      );
      this.socket.emit(AGENT_EVENTS.TOOL_ERROR, {
        toolId: invocation.toolId,
        callId: invocation.callId,
        message: `Tool "${invocation.toolId}" is not available in the current client version`,
      } satisfies ToolError);
      return;
    }

    try {
      // Enforce a hard timeout on client-executed tools
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Client-side tool execution timed out after ${this.defaultToolTimeout}ms.`,
              ),
            ),
          this.defaultToolTimeout,
        ),
      );

      const result = await Promise.race([
        executor(invocation.params),
        timeoutPromise,
      ]);

      this.socket.emit(AGENT_EVENTS.TOOL_RESULT, {
        result,
        callId: invocation.callId,
        toolId: invocation.toolId,
      } satisfies ToolResult);
    } catch (error: unknown) {
      this.logger.error(
        `[AgentClient] Executor error: ${invocation.toolId}`,
        error,
      );
      this.socket.emit(AGENT_EVENTS.TOOL_ERROR, {
        toolId: invocation.toolId,
        callId: invocation.callId,
        message: error instanceof Error ? error.message : JSON.stringify(error),
      } satisfies ToolError);
    }
  }
}
