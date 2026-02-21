# Synapse Framework

**Synapse** is an open-source, hybrid AI Agent framework built over WebSockets. It is designed specifically for building interactive, "copilot-like" assistants that securely and natively interact with your existing frontend UI and backend infrastructure.

Unlike traditional Generative UI frameworks (which stream server-rendered UI components down to the client), Synapse acts as an **agentic automation layer**. The AI operates as a powerful "ghost user," driving your existing native frontend logic and seamlessly executing server-side tasks.

## Why Synapse?

- **True Hybrid Execution:** Define tools that execute securely on your Node backend (`executionSide: "server"`) OR seamlessly trigger interactions natively in the user's browser (`executionSide: "client"`). The LLM seamlessly orchestrates both.
- **Non-Invasive Architecture:** No need to rewrite your frontend into Server Components or learn complex Generative UI paradigms. Synapse hooks right into your existing React state, API calls, and Redux actions.
- **Context-Aware ("Anti-Ghost Execution"):** As users navigate your app, the client constantly syncs its `ClientContext` to the server. Tools are automatically filtered out if they are not relevant to the user's active page or permissions, preventing the LLM from hallucinating clicks on buttons that no longer exist.
- **Built-in Autonomous Loops:** Synapse handles multi-step agent reasoning loops natively. The LLM can execute a client tool (like `getSelection()`), wait for the DOM state, process it, and execute a follow-up action all within the same persistent WebSocket connection.
- **Uncompromising Security:** The server's `ToolRegistry` is the absolute source of truth. The client cannot spoof tool schemas, and any result a client returns after executing a tool is strictly validated against a Zod schema before it reaches the LLM.

## How it Works

1. **The Server:** You define your `ToolRegistry` with both Server-Side tools (like querying a database) and Client-Side tools (like navigating the app or reading the DOM).
2. **The Connection:** Your frontend establishes a WebSocket connection with the `AgentServer` and continuously streams its `ClientContext`.
3. **The Agent Loop:** When a user sends a message, the LLM decides which tools to call. Server tools execute natively. Client tool invocations are dispatched over the socket.
4. **The Client Execution:** The client receives the `TOOL_INVOCATION`, executes existing business logic, and returns a `TOOL_RESULT` to the server, prompting the LLM's next action.

## Core Packages

Synapse is structured as a monorepo powered by Turborepo:

- **`@synapse/protocol`**: The core TypeScript interfaces, Zod Schemas (`ToolDefinition`, `ClientContext`), and event constants that power the real-time protocol.
- **`@synapse/server`**: The core Node.js backend logic containing the `AgentServer`, `ClientSession`, `ToolRegistry`, and the `AgentProvider` (LLM wrappers).
- **`@synapse/client`**: The React/frontend SDK providing context providers (`<AgentProvider>`) and easy-to-use hooks (e.g., `useAgentTool()`) to seamlessly link frontend actions to the agentic loop.

## Getting Started

_(Getting started documentation, frontend SDK usage, and code examples coming soon!)_

---

This framework is built for developers who want deeply integrated AI Copilots that feel native to their applications, without ripping out existing architectures.

> Feel free to explore the `apps/playground-server` (Backend) and `apps/playground-web` (Frontend React Client) to see a complete example implementation of the framework in action.
