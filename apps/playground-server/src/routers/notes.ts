import { ToolRouter } from "@synapse/server";
import { z } from "zod";
import { ClientContext } from "@synapse/protocol";

export const noteRouter = new ToolRouter();

noteRouter.registerAll([
  {
    name: "addNote",
    description: "Create a new note with a title and body content",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "The title of the note" },
        body: { type: "string", description: "The body content of the note" },
      },
      required: ["title", "body"],
    },
    resultSchema: z.string(),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "notes",
    executionSide: "client",
  },
  {
    name: "removeNote",
    description: "Delete a note by its unique ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the note to remove" },
      },
      required: ["id"],
    },
    resultSchema: z.string(),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "notes",
    executionSide: "client",
  },
  {
    name: "listNotes",
    description:
      "List all current notes with their IDs, titles, and body content",
    parameters: {
      type: "object",
      properties: {},
    },
    contextFilter: (ctx: ClientContext) => ctx.page_id === "notes",
    executionSide: "client",
  },
  {
    name: "searchNotes",
    description: "Search notes by keyword in title or body",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword" },
      },
      required: ["query"],
    },
    contextFilter: (ctx: ClientContext) => ctx.page_id === "notes",
    executionSide: "client",
  },
  {
    name: "searchWeather",
    executionSide: "server",
    description: "Search weather by city name",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "The city name" },
      },
      required: ["city"],
    },
    handler: async (params: { city: string }) => {
      return `Weather in ${params.city} is sunny`;
    },
  },
]);
