import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AgentProvider, AgentClient } from "@mumaw/synapse-client";

const client = new AgentClient({
  url: "http://localhost:3001",
  opts: {
    transports: ["websocket"],
  },
});

createRoot(document.getElementById("root")!).render(
  <AgentProvider client={client}>
    <App />
  </AgentProvider>,
);
