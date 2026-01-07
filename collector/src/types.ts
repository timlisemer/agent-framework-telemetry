export type TelemetryEventType =
  | "agent_execution"
  | "hook_decision"
  | "error"
  | "escalation"
  | "commit";

export type ModelTier = "haiku" | "sonnet" | "opus";

export interface TelemetryEvent {
  // Required fields
  hostId: string;
  sessionId: string;
  eventType: TelemetryEventType;
  agentName: string;
  // Name of the hook that triggered this agent (e.g., PreToolUse, PostToolUse)
  hookName: string;
  // Decision result (APPROVED, DENIED, CONFIRMED, DECLINED, OK, BLOCK)
  decision: string;
  // Name of the tool being executed
  toolName: string;
  // Working directory path
  workingDir: string;
  // Operation latency in milliseconds
  latencyMs: number;
  // Model tier category (haiku, sonnet, opus)
  modelTier: ModelTier;
  // Actual model name from LLM provider (e.g., claude-3-haiku-20240307, gpt-4-turbo)
  modelName: string;
  // Number of errors from LLM provider during this operation
  errorCount: number;
  // Whether operation completed without errors (declined requests can still be success=true)
  success: boolean;

  // Optional fields
  timestamp?: string;
  decisionReason?: string;
  extraData?: Record<string, unknown>;
}

export interface BatchTelemetryRequest {
  events: TelemetryEvent[];
}

export interface TranscriptMessage {
  role: "user" | "assistant" | "tool_result";
  content: string;
  index: number;
}

export interface TranscriptUploadRequest {
  sessionId: string;
  hostId: string;
  transcript: TranscriptMessage[];
}
