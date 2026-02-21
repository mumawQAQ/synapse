import { Socket } from "socket.io";
import {
  AGENT_EVENTS,
  ClientContext,
  ClientContextSchema,
  ToolInvocation,
  ToolResultSchema,
  ToolErrorSchema,
  UserMessageSchema,
  AgentResponse,
  ToolResult,
  Logger,
  DefaultLogger,
} from "@mumaw/synapse-protocol";
import { AgentProvider, ToolCallEvent } from "./provider";
import { ToolRegistry } from "./tool_registry";
import OpenAI from "openai";
import { SessionStorageProvider } from "./storage";

export class ClientSession {
  private socket: Socket;
  public sessionId: string;
  private provider: AgentProvider;
  private registry: ToolRegistry;
  private storage: SessionStorageProvider;
  private currentContext: ClientContext = {};
  private messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> =
    [];
  private defaultToolTimeout: number;
  private systemPrompt?: string;
  private logger: Logger;

  constructor(
    socket: Socket,
    sessionId: string,
    provider: AgentProvider,
    registry: ToolRegistry,
    storage: SessionStorageProvider,
    defaultToolTimeout: number = 30000,
    systemPrompt?: string,
    logger?: Logger,
  ) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.provider = provider;
    this.registry = registry;
    this.storage = storage;
    this.defaultToolTimeout = defaultToolTimeout;
    this.systemPrompt = systemPrompt;
    this.logger = logger || new DefaultLogger();
    this.setupListeners();
  }

  async initialize() {
    const data = await this.storage.get(this.sessionId);
    if (data) {
      this.currentContext = data.context;
      this.messages = data.messages;
      this.logger.debug(`[Session ${this.sessionId}] Resumed from storage`);
    } else {
      this.messages.push({
        role: "system",
        content:
          this.systemPrompt ||
          "You are a helpful AI agent with access to client-side tools. " +
            "Be concise and helpful in your responses. You can use the `get_current_context` tool to see the user's current page and state.",
      });
      await this.saveState();
    }
  }

  private async saveState() {
    await this.storage.set(this.sessionId, {
      context: this.currentContext,
      messages: this.messages,
    });
  }

  private setupListeners() {
    // ── Context Updates ─────────────────────────────────────────────────
    this.socket.on(AGENT_EVENTS.CONTEXT_UPDATE, (payload: unknown) => {
      const parsed = ClientContextSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error(
          `[Session ${this.socket.id}] Invalid context update:`,
          parsed.error,
        );
        return;
      }

      this.currentContext = parsed.data;
      this.logger.debug(
        `[Session ${this.socket.id}] Context updated:`,
        this.currentContext,
      );

      // Async save state
      this.saveState().catch((e) =>
        this.logger.error("Failed to save state:", e),
      );

      // Acknowledge to the client
      this.socket.emit(AGENT_EVENTS.CONTEXT_SYNC, {
        context: this.currentContext,
        availableTools: this.registry
          .getToolsForContext(this.currentContext)
          .map((t) => t.name),
      });
    });

    // ── User Messages ───────────────────────────────────────────────────
    this.socket.on(AGENT_EVENTS.USER_MESSAGE, async (payload: unknown) => {
      const parsed = UserMessageSchema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error("Invalid user message:", parsed.error);
        return;
      }

      const content = parsed.data.content;
      this.logger.info(`[Session ${this.socket.id}] User: ${content}`);

      await this.handleUserMessage(content);
    });
  }

  private async handleUserMessage(content: string) {
    this.messages.push({ role: "user", content });
    await this.saveState();
    await this.runAgentLoop();
  }

  private async runAgentLoop() {
    const MAX_TURNS = 5;
    let turns = 0;

    while (turns < MAX_TURNS) {
      turns++;

      this.logger.debug(`[Session ${this.socket.id}] Run Loop Turn ${turns}`);

      // Get tools filtered by the client's current context
      const availableTools = this.registry.getToolsForContext(
        this.currentContext,
      );

      let assistantMessageContent = "";
      let toolCalls: ToolCallEvent[] = [];
      let suggestedActions: string[] | undefined;

      try {
        const events = await this.provider.run(this.messages, availableTools);
        for (const event of events) {
          if (event.type === "text") {
            assistantMessageContent += event.content;
            if (event.suggestedActions) {
              suggestedActions = event.suggestedActions;
            }
            this.socket.emit(AGENT_EVENTS.AGENT_RESPONSE, {
              content: event.content,
              done: false,
            } satisfies AgentResponse);
          } else if (event.type === "tool_call") {
            toolCalls.push(event);
          } else if (event.type === "error") {
            throw event.error;
          }
        }
      } catch (e: any) {
        this.logger.error("Agent Provider Error:", e);
        this.socket.emit(AGENT_EVENTS.AGENT_RESPONSE, {
          content: `Error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
          done: true,
        } satisfies AgentResponse);
        return;
      }

      const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam =
        {
          role: "assistant",
          content: assistantMessageContent || null,
        };

      if (toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls.map((tc) => ({
          id: tc.callId,
          type: "function",
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.args),
          },
        }));
      }
      this.messages.push(assistantMessage);
      await this.saveState();

      // If no tool calls, we are done
      if (toolCalls.length === 0) {
        this.socket.emit(AGENT_EVENTS.AGENT_RESPONSE, {
          content: "",
          done: true,
          suggestedActions,
        } satisfies AgentResponse);
        break;
      }

      // Execute tools
      this.logger.debug(
        `[Session ${this.socket.id}] Requesting tools:`,
        toolCalls.map((t) => t.toolName),
      );

      for (const tc of toolCalls) {
        try {
          // ── Ghost Execution Check ───────────────────────────────────
          if (
            !this.registry.isToolAvailable(tc.toolName, this.currentContext)
          ) {
            this.logger.warn(
              `[Session ${this.socket.id}] Ghost execution: ${tc.toolName} no longer available`,
            );
            this.messages.push({
              role: "tool",
              tool_call_id: tc.callId,
              content:
                "Error: User is no longer on the valid page. The tool cannot be executed in the current context.",
            });
            continue;
          }

          // ── Server-Side Tool Execution ──────────────────────────────
          const toolDef = this.registry.getToolByName(tc.toolName);
          if (toolDef?.executionSide === "server" && toolDef.handler) {
            const result = await toolDef.handler(tc.args, this.currentContext);
            const validated = this.registry.validateResult(tc.toolName, result);
            this.messages.push({
              role: "tool",
              tool_call_id: tc.callId,
              content: JSON.stringify(
                validated.success ? validated.data : { error: validated.error },
              ),
            });
            continue;
          }

          // ── Client-Side Tool Invocation ─────────────────────────────
          const result = await this.invokeClientTool(
            tc.toolName,
            tc.callId,
            tc.args,
            toolDef?.timeout,
          );

          // Validate the result against the tool's result schema
          const validated = this.registry.validateResult(
            tc.toolName,
            result.result,
          );

          if (!validated.success) {
            this.logger.error(
              `[Session ${this.socket.id}] Result validation failed:`,
              validated.error,
            );
            this.messages.push({
              role: "tool",
              tool_call_id: result.callId,
              content: JSON.stringify({
                error: `Result validation failed: ${validated.error}`,
              }),
            });
          } else {
            this.messages.push({
              role: "tool",
              tool_call_id: result.callId,
              content: JSON.stringify(validated.data),
            });
          }
        } catch (e: any) {
          this.logger.error(
            `[Session ${this.socket.id}] Tool Execution Failed: ${tc.toolName}`,
            e,
          );
          this.messages.push({
            role: "tool",
            tool_call_id: tc.callId,
            content: `Error: ${e instanceof Error ? e.message : JSON.stringify(e)}`,
          });
        }
      }

      await this.saveState();

      // Loop continues to let agent see tool results and respond
    }
  }

  private invokeClientTool(
    name: string,
    callId: string,
    args: unknown,
    toolTimeout?: number,
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      this.socket.emit(AGENT_EVENTS.TOOL_INVOCATION, {
        toolId: name,
        callId,
        params: args,
      } satisfies ToolInvocation);

      const onResult = (payload: unknown) => {
        const parsed = ToolResultSchema.safeParse(payload);
        if (parsed.success && parsed.data.callId === callId) {
          this.socket.off(AGENT_EVENTS.TOOL_RESULT, onResult);
          this.socket.off(AGENT_EVENTS.TOOL_ERROR, onError);
          clearTimeout(timeoutId);
          resolve(parsed.data);
        }
      };

      const onError = (payload: unknown) => {
        const parsed = ToolErrorSchema.safeParse(payload);
        if (parsed.success && parsed.data.callId === callId) {
          this.socket.off(AGENT_EVENTS.TOOL_RESULT, onResult);
          this.socket.off(AGENT_EVENTS.TOOL_ERROR, onError);
          clearTimeout(timeoutId);
          reject(new Error(parsed.data.message));
        }
      };

      this.socket.on(AGENT_EVENTS.TOOL_RESULT, onResult);
      this.socket.on(AGENT_EVENTS.TOOL_ERROR, onError);

      // Timeout
      const timeoutMs = toolTimeout ?? this.defaultToolTimeout;
      const timeoutId = setTimeout(() => {
        this.socket.off(AGENT_EVENTS.TOOL_RESULT, onResult);
        this.socket.off(AGENT_EVENTS.TOOL_ERROR, onError);
        reject(new Error(`Tool Timeout (${timeoutMs}ms)`));
      }, timeoutMs);
    });
  }
}
