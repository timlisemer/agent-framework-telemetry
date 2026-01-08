export type TelemetryEventType =
  | "agent_execution"
  | "hook_decision"
  | "error"
  | "escalation"
  | "commit";

export type ModelTier = "haiku" | "sonnet" | "opus";

// Execution mode: direct or lazy evaluation
export type Mode = "direct" | "lazy";

// Execution type: llm (uses AI model) or typescript (pure code)
export type ExecutionType = "llm" | "typescript";

// Core decision types
export type Decision = "APPROVE" | "DENY" | "CONFIRM" | "SUCCESS" | "ERROR";

export interface TelemetryEvent {
  // Required fields
  hostId: string;
  sessionId: string;
  eventType: TelemetryEventType;
  agentName: string;
  // Name of the hook that triggered this agent (e.g., PreToolUse, PostToolUse)
  hookName: string;
  // Execution mode
  mode: Mode;
  // Decision result
  decision: Decision;
  // Name of the tool being executed
  toolName: string;
  // Working directory path
  workingDir: string;
  // Operation latency in milliseconds
  latencyMs: number;
  // Execution type: llm (uses AI model) or typescript (pure code)
  executionType: ExecutionType;
  // Model tier category (haiku, sonnet, opus) - required if executionType is 'llm'
  modelTier?: ModelTier;
  // Actual model name from LLM provider (e.g., claude-3-haiku-20240307, gpt-4-turbo) - required if executionType is 'llm'
  modelName?: string;

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
