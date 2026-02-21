import OpenAI from "openai";
import { ToolDefinition, Logger, DefaultLogger } from "@mumaw/synapse-protocol";

const NEXT_ACTION_SUGGESTION_SCHEMA = {
  name: "next_action_suggestion_response",
  schema: {
    type: "object",
    properties: {
      response: {
        type: "string",
      },
      next_action_suggestion: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
  },
};

export type TextEvent = {
  type: "text";
  content: string;
  done: boolean;
  suggestedActions?: string[];
};

export type ToolCallEvent = {
  type: "tool_call";
  toolName: string;
  callId: string;
  args: unknown;
};

export type ErrorEvent = {
  type: "error";
  error: string;
};

export type AgentEvent = TextEvent | ToolCallEvent | ErrorEvent;

export interface AgentProvider {
  run(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
    tools: ToolDefinition[],
  ): Promise<AgentEvent[]>;
}

export interface AgentProviderOptions {
  apiKey: string;
  model?: string;
  nextActionSuggestion?: boolean;
  logger?: Logger;
}

export class OpenAIAgentProvider implements AgentProvider {
  private client: OpenAI;
  public model: string;
  public nextActionSuggestion: boolean;
  private logger: Logger;

  constructor({
    apiKey,
    model = "gpt-5-mini",
    nextActionSuggestion = true,
    logger,
  }: AgentProviderOptions) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.nextActionSuggestion = nextActionSuggestion;
    this.logger = logger || new DefaultLogger();
  }

  async run(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
    tools: ToolDefinition[],
  ): Promise<AgentEvent[]> {
    const formattedTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
        },
      }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        stream: false,
        response_format: this.nextActionSuggestion
          ? {
              type: "json_schema",
              json_schema: NEXT_ACTION_SUGGESTION_SCHEMA,
            }
          : undefined,
      });

      const events: AgentEvent[] = [];
      const message = response.choices[0]?.message;
      this.logger.debug("[OpenAIAgentProvider] Raw message:", message);

      if (message?.content) {
        if (this.nextActionSuggestion && !message.tool_calls?.length) {
          try {
            const parsed = JSON.parse(message.content) as {
              response?: string;
              next_action_suggestion?: string[];
            };
            events.push({
              type: "text",
              content: parsed.response ?? message.content,
              done: true,
              suggestedActions: parsed.next_action_suggestion,
            });
          } catch {
            events.push({ type: "text", content: message.content, done: true });
          }
        } else {
          events.push({ type: "text", content: message.content, done: true });
        }
      }

      if (message?.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== "function") continue;

          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            this.logger.error(
              "[OpenAIAgentProvider] Failed to parse tool arguments:",
              toolCall.function.arguments,
            );
          }
          events.push({
            type: "tool_call",
            toolName: toolCall.function.name,
            callId: toolCall.id,
            args,
          });
        }
      }

      return events;
    } catch (e) {
      this.logger.error("[OpenAIAgentProvider] API Error:", e);
      return [
        {
          type: "error",
          error: e instanceof Error ? e.message : JSON.stringify(e),
        },
      ];
    }
  }
}
