import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { insertTelemetryEvents } from "../db/queries.js";
import { authMiddleware } from "../middleware/auth.js";

const telemetryRouter = new Hono<{ Variables: { hostId: string } }>();

const eventSchema = z.object({
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
  timestamp: z.string().optional(),
  decision: z.string().optional(),
  decisionReason: z.string().optional(),
  toolName: z.string().optional(),
  toolInput: z.record(z.unknown()).optional(),
  workingDir: z.string().optional(),
  latencyMs: z.number().optional(),
  modelTier: z.enum(["haiku", "sonnet", "opus"]).optional(),
  errorCount: z.number().optional(),
  warningCount: z.number().optional(),
  extraData: z.record(z.unknown()).optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

telemetryRouter.use("/*", authMiddleware);

telemetryRouter.post("/batch", zValidator("json", batchSchema), async (c) => {
  const { events } = c.req.valid("json");
  const authenticatedHostId = c.get("hostId");

  for (const event of events) {
    if (event.hostId !== authenticatedHostId) {
      return c.json(
        { error: `Host ID mismatch: expected ${authenticatedHostId}` },
        400
      );
    }
  }

  try {
    const inserted = await insertTelemetryEvents(events);
    return c.json({ accepted: inserted });
  } catch (error) {
    console.error("Failed to insert events:", error);
    return c.json({ error: "Failed to store events" }, 500);
  }
});

export { telemetryRouter };
