import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../tool_registry";
import {
  ClientSideToolDefinition,
  ServerSideToolDefinition,
} from "@synapse/protocol";
import { z } from "zod";
import { ToolRouter } from "../tool_router";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe("Registration", () => {
    it("should register a single tool", () => {
      const tool: ClientSideToolDefinition = {
        name: "test_tool",
        description: "A test tool",
        executionSide: "client",
      };

      registry.register(tool);
      expect(registry.size).toBe(1);
      expect(registry.getToolByName("test_tool")).toEqual(tool);
    });

    it("should overwrite existing tool with same name", () => {
      const tool1: ClientSideToolDefinition = {
        name: "test_tool",
        description: "v1",
        executionSide: "client",
      };
      const tool2: ClientSideToolDefinition = {
        name: "test_tool",
        description: "v2",
        executionSide: "client",
      };

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.size).toBe(1);
      expect(registry.getToolByName("test_tool")?.description).toBe("v2");
    });

    it("should register multiple tools via use(router)", () => {
      const router = new ToolRouter();
      router.register({
        name: "tool1",
        description: "desc",
        executionSide: "client",
      });
      router.register({
        name: "tool2",
        description: "desc",
        executionSide: "client",
      });

      registry.use(router);
      expect(registry.size).toBe(2);
    });
  });

  describe("Context Filtering (Ghost Execution Prevention)", () => {
    const adminTool: ServerSideToolDefinition = {
      name: "admin_only",
      description: "Admin tool",
      executionSide: "server",
      handler: async () => {},
      contextFilter: (ctx) => ctx.metadata?.role === "admin",
    };

    const publicTool: ClientSideToolDefinition = {
      name: "public_tool",
      description: "Public tool",
      executionSide: "client",
    };

    beforeEach(() => {
      registry.register(adminTool);
      registry.register(publicTool);
    });

    it("should return all tools if no context filters apply", () => {
      const tools = registry.getToolsForContext({
        metadata: { role: "admin" },
      });
      expect(tools.length).toBe(2);
    });

    it("should filter out tools when context does not match", () => {
      const tools = registry.getToolsForContext({
        metadata: { role: "viewer" },
      });
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("public_tool");
    });

    it("isToolAvailable should return true if context matches or no filter exists", () => {
      expect(
        registry.isToolAvailable("public_tool", {
          metadata: { role: "viewer" },
        }),
      ).toBe(true);
      expect(
        registry.isToolAvailable("admin_only", { metadata: { role: "admin" } }),
      ).toBe(true);
    });

    it("isToolAvailable should return false if context fails filter", () => {
      expect(
        registry.isToolAvailable("admin_only", {
          metadata: { role: "viewer" },
        }),
      ).toBe(false);
    });

    it("isToolAvailable should return false for nonexistent tool", () => {
      expect(registry.isToolAvailable("fake_tool", {})).toBe(false);
    });
  });

  describe("Result Validation", () => {
    const schemaTool: ClientSideToolDefinition = {
      name: "strict_tool",
      description: "Strict result schema",
      executionSide: "client",
      resultSchema: z.object({ id: z.number(), name: z.string() }),
    };

    const flexibleTool: ClientSideToolDefinition = {
      name: "flexible_tool",
      description: "No result schema",
      executionSide: "client",
    };

    beforeEach(() => {
      registry.register(schemaTool);
      registry.register(flexibleTool);
    });

    it("should pass validation if data matches schema", () => {
      const result = registry.validateResult("strict_tool", {
        id: 1,
        name: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: 1, name: "Test" });
      }
    });

    it("should fail validation if data does not match schema", () => {
      const result = registry.validateResult("strict_tool", {
        id: "invalid",
        wrongProp: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Result validation failed");
      }
    });

    it("should implicitly pass validation if no schema is defined", () => {
      const data = { completely: "arbitrary", number: 42 };
      const result = registry.validateResult("flexible_tool", data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it("should return error for unknown tool validation", () => {
      const result = registry.validateResult("fake_tool", {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unknown tool");
      }
    });
  });
});
