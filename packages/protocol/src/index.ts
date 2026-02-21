import { z } from "zod";

// ─── Logging ───────────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class DefaultLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) console.debug(message, ...args);
  }
  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) console.info(message, ...args);
  }
  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) console.warn(message, ...args);
  }
  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) console.error(message, ...args);
  }
}

// ─── Event Constants ───────────────────────────────────────────────────────────

export const AGENT_EVENTS = {
  // Context (Client → Server)
  CONTEXT_UPDATE: "agent:context_update",
  CONTEXT_SYNC: "agent:context_sync",

  // Chat (bidirectional)
  USER_MESSAGE: "agent:user_message",
  AGENT_RESPONSE: "agent:agent_response",

  // Tool execution (Server → Client → Server)
  TOOL_INVOCATION: "agent:tool_invocation",
  TOOL_RESULT: "agent:tool_result",
  TOOL_ERROR: "agent:tool_error",
} as const;

// ─── Client Context ────────────────────────────────────────────────────────────
// Sent from Client → Server so the server can filter which tools to inject.

export const ClientContextSchema = z.object({
  page_id: z.string().optional(),
  active_tab: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  /** Extensible bag for app-specific context */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ClientContext = z.infer<typeof ClientContextSchema>;

// ─── Tool Invocation (Server → Client) ─────────────────────────────────────────
// The server asks the client to execute a tool.

export const ToolInvocationSchema = z.object({
  toolId: z.string(),
  callId: z.string(),
  params: z.unknown(),
});

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

// ─── Tool Result (Client → Server) ─────────────────────────────────────────────
// The client returns the result of a tool execution.

export const ToolResultSchema = z.object({
  toolId: z.string(),
  callId: z.string(),
  result: z.unknown(),
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

// ─── Tool Error (Client → Server) ──────────────────────────────────────────────
// The client reports an error during tool execution.

export const ToolErrorSchema = z.object({
  toolId: z.string(),
  callId: z.string(),
  message: z.string(),
});

export type ToolError = z.infer<typeof ToolErrorSchema>;

// ─── User Message (Client → Server) ────────────────────────────────────────────

export const UserMessageSchema = z.object({
  content: z.string(),
});

export type UserMessage = z.infer<typeof UserMessageSchema>;

// ─── Agent Response (Server → Client) ──────────────────────────────────────────

export const AgentResponseSchema = z.object({
  content: z.string(),
  done: z.boolean(),
  suggestedActions: z.array(z.string()).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export interface BaseToolDefinition {
  /** Unique identifier for the tool, used to route invocations */
  name: string;
  /** Human-readable description injected into the LLM system prompt */
  description: string;
  /** JSON Schema for the tool parameters (sent to LLM) */
  parameters?: Record<string, unknown>;
  /**
   * Optional filter: given the client's current context, return true if
   * this tool should be available. If omitted, the tool is always available.
   */
  contextFilter?: (context: ClientContext) => boolean;
  /** Timeout in milliseconds for the tool execution. Overrides any default. */
  timeout?: number;
}

export interface ClientSideToolDefinition extends BaseToolDefinition {
  /**
   * This tool is executed on the client side (via WebSocket). Defaults to "client".
   */
  executionSide: "client";
  /**
   * Optional Zod schema to validate the result returned by the client.
   * If not provided, the result is accepted as-is.
   */
  resultSchema?: z.ZodType<unknown>;
}

export interface ServerSideToolDefinition extends BaseToolDefinition {
  /**
   * This tool is handled entirely on the server.
   */
  executionSide: "server";
  /**
   * Server-side handler for the tool.
   */
  handler: (params: any, context: ClientContext) => Promise<any>;
}

export type ToolDefinition =
  | ClientSideToolDefinition
  | ServerSideToolDefinition;
