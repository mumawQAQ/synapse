# Synapse Playground Server

This package serves as a reference implementation of the `@synapse/server` package. It provides a running WebSocket server with predefined server-side tools to test the Synapse Agent architecture.

## Getting Started

Because this playground sits within the Synapse monorepo, it uses workspace dependencies.

### 1. Environment Variables

Create a `.env` file in the root of `apps/playground-server` (or the monorepo root) and add your OpenAI API Key:

```bash
OPENAI_API_KEY=sk-...
```

### 2. Run the Server

From the root of the monorepo, run:

```bash
pnpm --filter @synapse/playground-server dev
```

_(Alternatively, simply run `pnpm dev` inside this directory)._

This will start an Express/Socket.io server on `http://localhost:3001`. The server uses `tsx` to automatically watch for changes and restart.

## How it works

The entry point is `src/index.ts`. It initializes:

1. An Express HTTP server.
2. A `Socket.io` WebSocket server (`cors` enabled for all origins).
3. The `OpenAIAgentProvider` (using GPT-4o by default).
4. The `AgentServer` instance.

It also registers a few demo tools demonstrating **Server-Side Execution**, such as simulated database fetches and system file operations.

## Running the Full Demo

This server is designed to work in tandem with the frontend client. To see the full magic of Synapse, make sure you also run the **Playground Web** app (`apps/playground-web`) simultaneously!
