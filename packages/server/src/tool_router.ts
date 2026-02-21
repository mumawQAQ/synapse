import { ToolDefinition } from "@synapse/protocol";

export class ToolRouter {
  public tools: ToolDefinition[] = [];

  /**
   * Register a single tool definition on this router.
   */
  register(tool: ToolDefinition): this {
    this.tools.push(tool);
    return this;
  }

  /**
   * Register multiple tool definitions at once.
   */
  registerAll(tools: ToolDefinition[]): this {
    this.tools.push(...tools);
    return this;
  }
}
