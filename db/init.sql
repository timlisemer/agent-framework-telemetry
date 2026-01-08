-- Main telemetry events table
CREATE TABLE telemetry_events (
    id BIGSERIAL PRIMARY KEY,
    host_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    agent_name VARCHAR(64) NOT NULL,
    -- Name of the hook that triggered this agent
    hook_name VARCHAR(64) NOT NULL,
    -- Execution mode: direct or lazy
    mode VARCHAR(16) NOT NULL,
    -- Execution type: llm (uses AI model) or typescript (pure code)
    execution_type VARCHAR(16) NOT NULL,
    -- Decision: APPROVE, DENY, CONFIRM, SUCCESS, ERROR
    decision VARCHAR(32) NOT NULL,
    decision_reason TEXT,
    tool_name VARCHAR(64) NOT NULL,
    working_dir VARCHAR(512) NOT NULL,
    latency_ms INTEGER NOT NULL,
    -- Model tier (haiku, sonnet, opus) - static category, NULL for typescript execution
    model_tier VARCHAR(16),
    -- Actual model name from LLM provider (e.g., claude-3-haiku-20240307, gpt-4-turbo), NULL for typescript execution
    model_name VARCHAR(128),
    -- Whether agent executed without internal errors (distinct from decision)
    success BOOLEAN NOT NULL DEFAULT TRUE,
    -- Number of LLM errors/retries before completion
    error_count INTEGER NOT NULL DEFAULT 0,
    extra_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_events_host_id ON telemetry_events(host_id);
CREATE INDEX idx_events_session_id ON telemetry_events(session_id);
CREATE INDEX idx_events_created_at ON telemetry_events(created_at);
CREATE INDEX idx_events_agent_name ON telemetry_events(agent_name);
CREATE INDEX idx_events_decision ON telemetry_events(decision);
CREATE INDEX idx_events_event_type ON telemetry_events(event_type);

-- Composite index for dashboard queries
CREATE INDEX idx_events_time_agent ON telemetry_events(created_at, agent_name);

-- Partial index for denial analysis
CREATE INDEX idx_events_denials ON telemetry_events(agent_name, created_at)
    WHERE decision = 'DENY';

-- Partial index for error analysis
CREATE INDEX idx_events_errors ON telemetry_events(agent_name, created_at)
    WHERE decision = 'ERROR';

-- Index for agent success analysis
CREATE INDEX idx_events_success ON telemetry_events(success, created_at);

-- Index for mode queries
CREATE INDEX idx_events_mode ON telemetry_events(mode);

-- Index for execution type queries
CREATE INDEX idx_events_execution_type ON telemetry_events(execution_type);

-- Index for model analytics
CREATE INDEX idx_events_model_name ON telemetry_events(model_name);

-- Index for hook analytics
CREATE INDEX idx_events_hook_name ON telemetry_events(hook_name);

-- Full session transcripts for debugging
CREATE TABLE session_transcripts (
    id BIGSERIAL PRIMARY KEY,
    host_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    transcript_data JSONB NOT NULL,
    message_counts JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_session UNIQUE (session_id)
);

CREATE INDEX idx_transcripts_session ON session_transcripts(session_id);
CREATE INDEX idx_transcripts_host ON session_transcripts(host_id);
CREATE INDEX idx_transcripts_created ON session_transcripts(created_at);

-- API keys for authentication (store SHA-256 hash, not plaintext)
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(128) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
