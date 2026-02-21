import {
  ToolDefinition,
  ClientContext,
  Logger,
  DefaultLogger,
} from "@synapse/protocol";
import { ToolRouter } from "./tool_router";

/**
 * ToolRegistry — the single source of truth for all tool definitions.
 *
 * All tool schemas, descriptions, parameter definitions, result schemas,
 * and context filters live here. The client NEVER provides these.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new DefaultLogger();
  }

  /**
   * Register a tool definition on the server.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(
        `[ToolRegistry] Overwriting existing tool: ${tool.name}`,
      );
    }
    this.tools.set(tool.name, tool);
    this.logger.info(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tool definitions at once.
   */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  use(router: ToolRouter): this {
    this.registerAll(router.tools);
    return this;
  }

  /**
   * Returns only the tools available for the given client context.
   * If a tool has no contextFilter, it is always available.
   */
  getToolsForContext(context: ClientContext): ToolDefinition[] {
    const filtered: ToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      if (!tool.contextFilter || tool.contextFilter(context)) {
        filtered.push(tool);
      }
    }
    return filtered;
  }

  /**
   * Look up a single tool by name.
   */
  getToolByName(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Validate a client-returned result against the tool's result schema.
   * Returns { success: true, data } if valid or no schema defined,
   * or { success: false, error } if validation fails.
   */
  validateResult(
    toolName: string,
    result: unknown,
  ): { success: true; data: unknown } | { success: false; error: string } {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    if (!("resultSchema" in tool) || !tool.resultSchema) {
      // No schema defined — accept the result as-is
      return { success: true, data: result };
    }

    try {
      const parsed = tool.resultSchema.safeParse(result);
      if (parsed.success) {
        return { success: true, data: parsed.data };
      }
      return {
        success: false,
        error: `Result validation failed for ${toolName}: ${parsed.error.message}`,
      };
    } catch (e) {
      return {
        success: false,
        error: `Result validation error for ${toolName}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Check if a tool is valid for the given context (for ghost execution detection).
   */
  isToolAvailable(toolName: string, context: ClientContext): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return false;
    if (!tool.contextFilter) return true;
    return tool.contextFilter(context);
  }

  /**
   * Get the count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}
