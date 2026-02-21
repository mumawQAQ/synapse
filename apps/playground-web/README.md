# Synapse Playground Web (React)

This package serves as a reference frontend implementation utilizing the `@mumaw/synapse-client` React SDK. It connects to the `playground-server` and demonstrates how an AI Agent can natively drive a React application.

## Getting Started

Because this playground sits within the Synapse monorepo, it uses workspace dependencies.

### 1. Ensure the Server is Running

Before starting the frontend, ensure the `playground-server` is actively running on port `3001` so the WebSocket connection succeeds.
_(See `apps/playground-server/README.md` for instructions)._

### 2. Run the Web App

From the root of the monorepo, run:

```bash
pnpm --filter playground-web dev
```

_(Alternatively, simply run `pnpm dev` inside this directory)._

This spins up a Vite-powered React application, typically available at `http://localhost:5173`.

## How It Works

The magic happens natively inside the browser via the Synapse Socket Protocol.

- **`<AgentProvider>`**: Located at the root of the application, it establishes the WebSocket connection and provides global context.
- **`useAgent()`**: Used by the chat interface to render the message history and send user instructions to the LLM.
- **`useAgentTool()`**: Peppered throughout the application, this hook exposes React logic (like state setters, theme toggles, and navigation events) as tools that the server LLM can autonomously invoke.

## What to Try

Once both the Web and Server apps are running, open your browser and tell the Agent to:

1. _"Switch to dark mode"_ (Triggers a `ClientSideToolDefinition` changing React state).
2. _"What page am I on right now?"_ (Demonstrates Context-Awareness and Ghost Execution prevention).
3. _"Fetch my recent database logs"_ (Triggers a `ServerSideToolDefinition` hitting the backend without API routes).
