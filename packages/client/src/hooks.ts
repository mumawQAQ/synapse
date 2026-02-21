import { useEffect, useState, useCallback, useId, useRef } from "react";
import { useAgentClient } from "./agent_provider";
import { AgentResponse, ClientContext, AGENT_EVENTS } from "@mumaw/synapse-protocol";

/**
 * useAgentTool — Register a local executor for a server-defined tool.
 *
 * Unlike the old API, this hook does NOT send any tool schema to the server.
 * The server already owns the tool definition. This hook only tells the
 * client how to execute the tool when the server invokes it.
 *
 * Uses a ref internally so the executor always calls the latest `func`,
 * avoiding stale closure issues when `func` captures React state.
 *
 * @param toolId - The tool ID (must match the server-side tool name)
 * @param func   - The execution function called when the server invokes this tool
 */
export const useAgentTool = <TArgs = unknown, TResult = unknown>(
  toolId: string,
  func: (args: TArgs) => Promise<TResult> | TResult,
) => {
  const client = useAgentClient();
  const funcRef = useRef(func);

  // Always keep the ref pointing to the latest function
  useEffect(() => {
    funcRef.current = func;
  });

  useEffect(() => {
    // Register a stable wrapper that delegates to the ref
    client.registerExecutor(toolId, (args: unknown) =>
      funcRef.current(args as TArgs),
    );

    return () => {
      client.unregisterExecutor(toolId);
    };
  }, [client, toolId]);
};

/**
 * useContextSync — Contribute a scoped context slice to the server.
 *
 * Each component provides a unique `scope` key (or one is auto-generated).
 * Multiple components can each contribute their own context without
 * overwriting each other. On unmount, the scope is removed.
 *
 * @param context - The context slice to contribute
 * @param scope   - Optional unique key for this scope (auto-generated if omitted)
 */
export const useContextSync = (context: ClientContext, scope?: string) => {
  const client = useAgentClient();
  const autoScope = useId();
  const resolvedScope = scope ?? autoScope;

  useEffect(() => {
    client.setContext(resolvedScope, context);

    return () => {
      client.removeContext(resolvedScope);
    };
  }, [client, resolvedScope, JSON.stringify(context)]);
};

/**
 * useAgentChat — Hook for sending messages and receiving agent responses.
 */
export const useAgentChat = () => {
  const client = useAgentClient();
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [history, setHistory] = useState<
    { role: "user" | "agent"; content: string }[]
  >([]);

  // Robustness States
  const [isConnected, setIsConnected] = useState<boolean>(
    client.socket.connected,
  );
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setError(null);
    };
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = (err: Error) =>
      setError(`Connection Error: ${err.message}`);

    client.socket.on("connect", onConnect);
    client.socket.on("disconnect", onDisconnect);
    client.socket.on("connect_error", onConnectError);

    // Track active runs via tool invocation signals (optional advanced track)
    client.socket.on(AGENT_EVENTS.TOOL_INVOCATION, () => setIsExecuting(true));
    client.socket.on(AGENT_EVENTS.TOOL_RESULT, () => setIsExecuting(false));
    client.socket.on(AGENT_EVENTS.TOOL_ERROR, () => setIsExecuting(false));

    return () => {
      client.socket.off("connect", onConnect);
      client.socket.off("disconnect", onDisconnect);
      client.socket.off("connect_error", onConnectError);
      client.socket.off(AGENT_EVENTS.TOOL_INVOCATION);
      client.socket.off(AGENT_EVENTS.TOOL_RESULT);
      client.socket.off(AGENT_EVENTS.TOOL_ERROR);
    };
  }, [client]);

  useEffect(() => {
    const cleanup = client.onResponse((response) => {
      setLastResponse(response);
      setIsExecuting(false);
      setError(null);
      if (response.content) {
        setHistory((prev) => {
          return [...prev, { role: "agent", content: response.content }];
        });
      }
      if (response.suggestedActions) {
        setSuggestedActions(response.suggestedActions);
      }
    });
    return cleanup;
  }, [client]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!isConnected) {
        setError("Cannot send message: Not connected to server.");
        return;
      }
      setSuggestedActions([]); // Clear actions when user sends a new message
      setIsExecuting(true);
      setError(null);
      setHistory((prev) => [...prev, { role: "user", content }]);
      client.chat(content);
    },
    [client, isConnected],
  );

  return {
    sendMessage,
    lastResponse,
    history,
    suggestedActions,
    isConnected,
    isExecuting,
    error,
  };
};
