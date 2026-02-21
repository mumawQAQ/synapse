import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { AgentServer } from "@mumaw/synapse-server";
import { todoRouter } from "./routers/todos";
import { noteRouter } from "./routers/notes";
import { settingsRouter } from "./routers/settings";
import "dotenv/config";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const agent = new AgentServer(io);

agent.use(todoRouter);
agent.use(noteRouter);
agent.use(settingsRouter);

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`✅ Playground Server is running on http://localhost:${PORT}`);
});
