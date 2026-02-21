import { ToolRouter } from "@synapse/server";
import { z } from "zod";
import { ClientContext } from "@synapse/protocol";

export const settingsRouter = new ToolRouter();

settingsRouter.registerAll([
  {
    name: "toggleDarkMode",
    description: "Toggle dark mode on or off in the user's settings",
    parameters: {
      type: "object",
      properties: {},
    },
    resultSchema: z.object({
      darkMode: z.boolean(),
    }),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "settings",
    executionSide: "client",
  },
  {
    name: "setFontSize",
    description: "Change the UI font size. Options: 'small', 'medium', 'large'",
    parameters: {
      type: "object",
      properties: {
        size: {
          type: "string",
          enum: ["small", "medium", "large"],
          description: "The font size to set",
        },
      },
      required: ["size"],
    },
    resultSchema: z.object({
      fontSize: z.string(),
    }),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "settings",
    executionSide: "client",
  },
  {
    name: "setAccentColor",
    description:
      "Change the UI accent color. Options: 'blue', 'purple', 'green', 'orange', 'pink'",
    parameters: {
      type: "object",
      properties: {
        color: {
          type: "string",
          enum: ["blue", "purple", "green", "orange", "pink"],
          description: "The accent color to use",
        },
      },
      required: ["color"],
    },
    resultSchema: z.object({
      accentColor: z.string(),
    }),
    contextFilter: (ctx: ClientContext) => ctx.page_id === "settings",
    executionSide: "client",
  },
  {
    name: "getSettings",
    description:
      "Get the current user settings (dark mode, font size, accent color)",
    parameters: {
      type: "object",
      properties: {},
    },
    contextFilter: (ctx: ClientContext) => ctx.page_id === "settings",
    executionSide: "client",
  },
]);
