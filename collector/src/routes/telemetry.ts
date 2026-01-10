import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { insertTelemetryEvents } from "../db/queries.js";
import { authMiddleware } from "../middleware/auth.js";

const telemetryRouter = new Hono();

const eventSchema = z.object({
  // Required fields
  hostId: z.string(),
  sessionId: z.string(),
  eventType: z.enum([
    "agent_execution",
    "hook_decision",
    "error",
    "escalation",
    "commit",
  ]),
  agentName: z.string(),
  // Name of the hook that triggered this agent (e.g., PreToolUse, PostToolUse)
  hookName: z.string(),
  // Execution mode: direct or lazy
  mode: z.enum(["direct", "lazy"]),
  // Decision result: APPROVE, CONTINUE, DENY, CONFIRM, SUCCESS, ERROR
  decision: z.enum(["APPROVE", "CONTINUE", "DENY", "CONFIRM", "SUCCESS", "ERROR"]),
  // Name of the tool being executed
  toolName: z.string(),
  // Working directory path
  workingDir: z.string(),
  // Operation latency in milliseconds
  latencyMs: z.number(),
  // Execution type: llm (uses AI model) or typescript (pure code)
  executionType: z.enum(["llm", "typescript"]),
  // Model tier category (haiku, sonnet, opus) - required if executionType is 'llm'
  modelTier: z.enum(["haiku", "sonnet", "opus"]).optional(),
  // Actual model name from LLM provider (e.g., claude-3-haiku-20240307, gpt-4-turbo) - required if executionType is 'llm'
  modelName: z.string().optional(),
  // Whether agent executed without internal errors (distinct from decision)
  success: z.boolean(),
  // Number of LLM errors/retries before completion (0 if none)
  errorCount: z.number().int().min(0),

  // Optional fields
  timestamp: z.string().optional(),
  decisionReason: z.string().optional(),
  extraData: z.record(z.unknown()).optional(),

  // Token usage (only for executionType='llm')
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  cachedTokens: z.number().int().min(0).optional(),
  reasoningTokens: z.number().int().min(0).optional(),

  // Cost tracking (USD)
  cost: z.number().min(0).optional(),

  // Client version (e.g., "1.0.42")
  clientVersion: z.string().max(20).optional(),

  // OpenRouter generation ID for async cost fetching (comma-separated for multi-turn)
  generationId: z.string().max(512).optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

telemetryRouter.use("/*", authMiddleware);

telemetryRouter.post("/batch", zValidator("json", batchSchema), async (c) => {
  const { events } = c.req.valid("json");

  try {
    const inserted = await insertTelemetryEvents(events);
    return c.json({ accepted: inserted });
  } catch (error) {
    console.error("Failed to insert events:", error);
    return c.json({ error: "Failed to store events" }, 500);
  }
});

export { telemetryRouter };
