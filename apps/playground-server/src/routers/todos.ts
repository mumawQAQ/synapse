import { ToolRouter } from "@mumaw/synapse-server";
import { z } from "zod";
import { ClientContext } from "@mumaw/synapse-protocol";

export const todoRouter = new ToolRouter();

todoRouter.register({
  name: "addTodo",
  description: "Add a new todo item to the user's list",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "The content of the todo" },
    },
    required: ["text"],
  },
  resultSchema: z.string(),
  contextFilter: (ctx: ClientContext) => ctx.page_id === "todos",
  executionSide: "client",
});

todoRouter.registerAll([
  {
    name: "removeTodo",
    description: "Remove a todo item by its unique ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the todo to remove" },
      },
      required: ["id"],
    },
    resultSchema: z.string(),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "todos",
    executionSide: "client",
  },
  {
    name: "toggleTodo",
    description: "Toggle the completion status of a todo item",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the todo to toggle" },
      },
      required: ["id"],
    },
    resultSchema: z.string(),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "todos",
    executionSide: "client",
  },
  {
    name: "listTodos",
    description:
      "List all current todo items with their IDs and completion status",
    parameters: {
      type: "object",
      properties: {},
    },
    contextFilter: (ctx: ClientContext) => ctx.page_id === "todos",
    executionSide: "client",
  },
]);
