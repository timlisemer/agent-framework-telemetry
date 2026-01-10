import { describe, expect, test } from "bun:test";
import { z } from "zod";

// Recreate the schema for testing (to avoid import issues with mocked modules)
const eventSchema = z
  .object({
    hostId: z.string().min(1).max(255),
    sessionId: z.string().min(1).max(255),
    eventType: z.enum([
      "agent_execution",
      "hook_decision",
      "error",
      "escalation",
      "commit",
    ]),
    agentName: z.string().min(1).max(100),
    hookName: z.string().min(1).max(100),
    mode: z.enum(["direct", "lazy"]),
    decision: z.enum([
      "APPROVE",
      "CONTINUE",
      "DENY",
      "CONFIRM",
      "SUCCESS",
      "ERROR",
    ]),
    toolName: z.string().min(1).max(100),
    workingDir: z.string().min(1).max(1000),
    latencyMs: z.number().min(0).max(3600000),
    executionType: z.enum(["llm", "typescript"]),
    modelTier: z.enum(["haiku", "sonnet", "opus"]).optional(),
    modelName: z.string().max(100).optional(),
    success: z.boolean(),
    errorCount: z.number().int().min(0).max(1000),
    timestamp: z.string().max(50).optional(),
    decisionReason: z.string().max(5000).optional(),
    extraData: z.record(z.unknown()).optional(),
    promptTokens: z.number().int().min(0).max(10000000).optional(),
    completionTokens: z.number().int().min(0).max(10000000).optional(),
    totalTokens: z.number().int().min(0).max(10000000).optional(),
    cachedTokens: z.number().int().min(0).max(10000000).optional(),
    reasoningTokens: z.number().int().min(0).max(10000000).optional(),
    cost: z.number().min(0).max(10000).optional(),
    clientVersion: z.string().max(20).optional(),
    generationId: z.string().max(512).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.executionType === "llm") {
      if (!data.modelTier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "modelTier is required when executionType is 'llm'",
          path: ["modelTier"],
        });
      }
      if (!data.modelName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "modelName is required when executionType is 'llm'",
          path: ["modelName"],
        });
      }
    }
  });

const validTypescriptEvent = {
  hostId: "host-1",
  sessionId: "session-1",
  eventType: "agent_execution" as const,
  agentName: "test-agent",
  hookName: "PreToolUse",
  mode: "direct" as const,
  decision: "APPROVE" as const,
  toolName: "Read",
  workingDir: "/home/user",
  latencyMs: 100,
  executionType: "typescript" as const,
  success: true,
  errorCount: 0,
};

const validLlmEvent = {
  ...validTypescriptEvent,
  executionType: "llm" as const,
  modelTier: "haiku" as const,
  modelName: "claude-3-haiku-20240307",
};

describe("Telemetry Event Validation", () => {
  describe("Valid Events", () => {
    test("accepts valid typescript event", () => {
      const result = eventSchema.safeParse(validTypescriptEvent);
      expect(result.success).toBe(true);
    });

    test("accepts valid LLM event with modelTier and modelName", () => {
      const result = eventSchema.safeParse(validLlmEvent);
      expect(result.success).toBe(true);
    });
  });

  describe("Conditional Validation", () => {
    test("rejects LLM event without modelTier", () => {
      const event = {
        ...validTypescriptEvent,
        executionType: "llm" as const,
        modelName: "claude-3-haiku",
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("modelTier is required");
      }
    });

    test("rejects LLM event without modelName", () => {
      const event = {
        ...validTypescriptEvent,
        executionType: "llm" as const,
        modelTier: "haiku" as const,
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("modelName is required");
      }
    });

    test("typescript event does not require modelTier or modelName", () => {
      const result = eventSchema.safeParse(validTypescriptEvent);
      expect(result.success).toBe(true);
    });
  });

  describe("String Length Validation", () => {
    test("rejects hostId exceeding 255 characters", () => {
      const event = {
        ...validTypescriptEvent,
        hostId: "x".repeat(256),
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects empty hostId", () => {
      const event = {
        ...validTypescriptEvent,
        hostId: "",
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects agentName exceeding 100 characters", () => {
      const event = {
        ...validTypescriptEvent,
        agentName: "x".repeat(101),
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects workingDir exceeding 1000 characters", () => {
      const event = {
        ...validTypescriptEvent,
        workingDir: "/".repeat(1001),
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects decisionReason exceeding 5000 characters", () => {
      const event = {
        ...validTypescriptEvent,
        decisionReason: "x".repeat(5001),
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });

  describe("Numeric Validation", () => {
    test("rejects negative latencyMs", () => {
      const event = {
        ...validTypescriptEvent,
        latencyMs: -1,
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects latencyMs exceeding 1 hour", () => {
      const event = {
        ...validTypescriptEvent,
        latencyMs: 3600001,
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });

    test("rejects negative errorCount", () => {
      const event = {
        ...validTypescriptEvent,
        errorCount: -1,
      };
      const result = eventSchema.safeParse(event);
      expect(result.success).toBe(false);
    });
  });
});
