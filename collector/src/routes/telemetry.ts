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
  // Decision result (APPROVED, DENIED, CONFIRMED, DECLINED, OK, BLOCK)
  decision: z.enum(["APPROVED", "DENIED", "CONFIRMED", "DECLINED", "OK", "BLOCK"]),
  // Name of the tool being executed
  toolName: z.string(),
  // Working directory path
  workingDir: z.string(),
  // Operation latency in milliseconds
  latencyMs: z.number(),
  // Model tier category (haiku, sonnet, opus)
  modelTier: z.enum(["haiku", "sonnet", "opus"]),
  // Actual model name from LLM provider (e.g., claude-3-haiku-20240307, gpt-4-turbo)
  modelName: z.string(),
  // Number of errors from LLM provider during this operation
  errorCount: z.number(),
  // Whether operation completed without errors (declined requests can still be success=true)
  success: z.boolean(),

  // Optional fields
  timestamp: z.string().optional(),
  decisionReason: z.string().optional(),
  extraData: z.record(z.unknown()).optional(),
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
