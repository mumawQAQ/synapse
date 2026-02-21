import React, { createContext, useContext, useEffect } from "react";
import { AgentClient } from "./agent_client";
import { ClientContext } from "@mumaw/synapse-protocol";

const AgentContext = createContext<AgentClient | null>(null);

interface AgentProviderProps {
  client: AgentClient;
  children: React.ReactNode;
  /** Optional initial context to send on mount */
  initialContext?: ClientContext;
}

export const AgentProvider: React.FC<AgentProviderProps> = ({
  client,
  children,
  initialContext,
}) => {
  useEffect(() => {
    if (initialContext) {
      client.setContext("__provider__", initialContext);
    }

    return () => {
      client.removeContext("__provider__");
      client.socket.disconnect();
    };
  }, [client]);

  return (
    <AgentContext.Provider value={client}>{children}</AgentContext.Provider>
  );
};

export const useAgentClient = () => {
  const client = useContext(AgentContext);
  if (!client) {
    throw new Error("useAgentClient must be used within an AgentProvider");
  }
  return client;
};
