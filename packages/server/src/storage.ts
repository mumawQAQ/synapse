import { ClientContext } from "@synapse/protocol";
import OpenAI from "openai";

export interface SessionData {
  context: ClientContext;
  messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>;
}

export interface SessionStorageProvider {
  /** Retrieve a session's data */
  get(sessionId: string): Promise<SessionData | null>;

  /** Save a session's data */
  set(sessionId: string, data: SessionData): Promise<void>;

  /** Delete a session */
  delete(sessionId: string): Promise<void>;
}

export class InMemorySessionStorage implements SessionStorageProvider {
  private store = new Map<string, SessionData>();

  async get(sessionId: string): Promise<SessionData | null> {
    return this.store.get(sessionId) || null;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    this.store.set(sessionId, data);
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
