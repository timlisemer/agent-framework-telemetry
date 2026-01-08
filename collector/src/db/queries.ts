import { sql } from "./client.js";
import type { TelemetryEvent, TranscriptMessage } from "../types.js";

export async function insertTelemetryEvents(
  events: TelemetryEvent[]
): Promise<number> {
  if (events.length === 0) return 0;

  const values = events.map((e) => ({
    // Required fields
    host_id: e.hostId,
    session_id: e.sessionId,
    event_type: e.eventType,
    agent_name: e.agentName,
    hook_name: e.hookName,
    mode: e.mode,
    execution_type: e.executionType,
    decision: e.decision,
    tool_name: e.toolName,
    working_dir: e.workingDir,
    latency_ms: e.latencyMs,
    // Optional model fields (required if executionType is 'llm')
    model_tier: e.modelTier ?? null,
    model_name: e.modelName ?? null,
    // Optional fields
    decision_reason: e.decisionReason ?? null,
    extra_data: e.extraData ? JSON.stringify(e.extraData) : null,
    created_at: e.timestamp || new Date().toISOString(),
  }));

  await sql`INSERT INTO telemetry_events ${sql(values)}`;
  return events.length;
}

export async function upsertTranscript(
  sessionId: string,
  hostId: string,
  transcript: TranscriptMessage[]
): Promise<void> {
  const messageCounts = {
    user: transcript.filter((m) => m.role === "user").length,
    assistant: transcript.filter((m) => m.role === "assistant").length,
    tool_result: transcript.filter((m) => m.role === "tool_result").length,
  };

  await sql`
    INSERT INTO session_transcripts (session_id, host_id, transcript_data, message_counts)
    VALUES (${sessionId}, ${hostId}, ${JSON.stringify(transcript)}, ${JSON.stringify(messageCounts)})
    ON CONFLICT (session_id) DO UPDATE SET
      transcript_data = EXCLUDED.transcript_data,
      message_counts = EXCLUDED.message_counts,
      updated_at = NOW()
  `;
}

export async function validateApiKey(
  keyHash: string
): Promise<{ id: number } | null> {
  const result = await sql`
    SELECT id FROM api_keys
    WHERE key_hash = ${keyHash} AND is_active = TRUE
  `;

  if (result.length === 0) return null;

  sql`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ${keyHash}`.catch(
    () => {}
  );

  return { id: result[0].id };
}
