export type TelemetryEventType =
  | "agent_execution"
  | "hook_decision"
  | "error"
  | "escalation"
  | "commit";

export type ModelTier = "haiku" | "sonnet" | "opus";

export interface TelemetryEvent {
  hostId: string;
  sessionId: string;
  eventType: TelemetryEventType;
  agentName: string;
  timestamp?: string;
  decision?: string;
  decisionReason?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  workingDir?: string;
  latencyMs?: number;
  modelTier?: ModelTier;
  errorCount?: number;
  warningCount?: number;
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
