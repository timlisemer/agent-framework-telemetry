import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { upsertTranscript } from "../db/queries.js";
import { authMiddleware } from "../middleware/auth.js";

const transcriptRouter = new Hono();

const transcriptSchema = z.object({
  sessionId: z.string().min(1).max(255),
  hostId: z.string().min(1).max(255),
  transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "tool_result"]),
        content: z.string().max(1000000), // 1MB per message
        index: z.number().int().min(0),
      })
    )
    .max(10000), // Max 10k messages per transcript
});

transcriptRouter.use("/*", authMiddleware);

transcriptRouter.post("/", zValidator("json", transcriptSchema), async (c) => {
  const { sessionId, hostId, transcript } = c.req.valid("json");

  try {
    await upsertTranscript(sessionId, hostId, transcript);
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to upsert transcript:", error);
    return c.json({ error: "Failed to store transcript" }, 500);
  }
});

export { transcriptRouter };
