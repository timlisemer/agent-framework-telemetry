# Agent Framework Telemetry

Telemetry collection stack for the agent-framework.

## Components

- **Collector**: Bun + Hono API service (Docker image: `ghcr.io/timlisemer/agent-framework-telemetry/collector-linux-arm64:latest`)
- **Database**: PostgreSQL 16
- **Visualization**: Grafana 11

## Deployment

This repo provides:
- Pre-built Docker images via GitHub Actions
- Database schema (`db/init.sql`)
- Grafana provisioning configs (`grafana/provisioning/`)

For NixOS deployment, see the [nixos config repo](https://github.com/timlisemer/nixos).

---

## API Reference

### Authentication

All endpoints (except `/api/v1/health`) require authentication via the `X-API-Key` header.

```
X-API-Key: <your-api-key>
```

### API Key Management

Generate and insert API keys:

```bash
# Generate a new API key
API_KEY=$(openssl rand -hex 32)
echo "API Key: $API_KEY"

# Insert the hash into the database
psql -U telemetry -d agent_telemetry -c \
  "INSERT INTO api_keys (key_hash, description)
   VALUES (encode(sha256('$API_KEY'::bytea), 'hex'), 'My API key');"
```

---

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/telemetry/batch` | Required | Batch insert telemetry events (1-100 events) |
| POST | `/api/v1/transcript` | Required | Upsert session transcript |
| GET | `/api/v1/health` | None | Health check |

---

### POST /api/v1/telemetry/batch

Batch insert telemetry events.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | API key for authentication |
| `Content-Type` | Yes | Must be `application/json` |

#### Request Body

```json
{
  "events": [TelemetryEvent, ...]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `events` | array | Yes | Array of telemetry events (minimum 1, maximum 100) |

#### Telemetry Event Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hostId` | string | Yes | Unique identifier for the host machine |
| `sessionId` | string | Yes | Session identifier (e.g., `process-12345-1704067200000`) |
| `eventType` | enum | Yes | Type of event (see Event Types below) |
| `agentName` | string | Yes | Name of the agent (e.g., `tool-approve`, `commit`, `check`) |
| `hookName` | string | Yes | Hook that triggered this agent (e.g., `PreToolUse`, `PostToolUse`, `Notification`) |
| `mode` | enum | Yes | Execution mode: `direct` or `lazy` |
| `executionType` | enum | Yes | How the decision was made: `llm` or `typescript` |
| `decision` | enum | Yes | Decision result (see Decision Types below) |
| `toolName` | string | Yes | Tool being executed (e.g., `Bash`, `Read`, `Edit`, `Write`) |
| `workingDir` | string | Yes | Working directory path |
| `latencyMs` | number | Yes | Operation latency in milliseconds |
| `modelTier` | enum | No* | Model tier: `haiku`, `sonnet`, `opus` (*Required if `executionType` is `llm`) |
| `modelName` | string | No* | Actual model name (e.g., `claude-3-haiku-20240307`) (*Required if `executionType` is `llm`) |
| `success` | boolean | Yes | Whether agent executed without internal errors (distinct from decision) |
| `errorCount` | number | Yes | Number of LLM errors/retries before completion (0 if none) |
| `timestamp` | string | No | ISO 8601 timestamp (defaults to server time) |
| `decisionReason` | string | No | Explanation for the decision |
| `extraData` | object | No | Additional arbitrary data (stored as JSONB) |

#### Event Types

| Value | Description |
|-------|-------------|
| `agent_execution` | Agent executed and made a decision |
| `hook_decision` | Hook-level decision without full agent execution |
| `error` | Error occurred during processing |
| `escalation` | Decision escalated to higher tier |
| `commit` | Commit operation performed |

#### Execution Types

| Value | Description |
|-------|-------------|
| `llm` | Decision made by an LLM model (requires `modelTier` and `modelName`) |
| `typescript` | Decision made by TypeScript code without LLM |

#### Decision Types

| Decision | Category | Description |
|----------|----------|-------------|
| `APPROVE` | Authorization | Agent approved tool execution |
| `DENY` | Authorization | Agent blocked tool execution |
| `CONFIRM` | Quality | Check/confirm agent validated code |
| `SUCCESS` | Outcome | Operation completed without errors |
| `ERROR` | Outcome | Agent failed to execute (no decision was made) |

**Important:** `decision` and `success` are different concepts:
- `decision` = The agent's choice about the tool/action
- `success` = Whether the agent itself ran without internal errors

Examples:
- Agent works correctly, blocks dangerous command: `success: true`, `decision: "DENY"`
- Agent works correctly, allows safe command: `success: true`, `decision: "APPROVE"`
- Agent crashes due to LLM API timeout: `success: false`, `decision: "ERROR"`

#### Mode Types

| Mode | Description |
|------|-------------|
| `direct` | Direct execution mode - agent runs immediately |
| `lazy` | Lazy evaluation mode - deferred execution |

#### Model Tiers

| Tier | Description |
|------|-------------|
| `haiku` | Fast, lightweight model tier |
| `sonnet` | Balanced performance/capability tier |
| `opus` | Most capable model tier |

#### Example: LLM Agent Request

```json
{
  "events": [
    {
      "hostId": "laptop",
      "sessionId": "process-12345-1704067200000",
      "eventType": "agent_execution",
      "agentName": "tool-approve",
      "hookName": "PreToolUse",
      "mode": "direct",
      "executionType": "llm",
      "decision": "APPROVE",
      "toolName": "Bash",
      "workingDir": "/home/user/project",
      "latencyMs": 150,
      "modelTier": "haiku",
      "modelName": "claude-3-haiku-20240307",
      "success": true,
      "errorCount": 0,
      "decisionReason": "Command is safe to execute"
    }
  ]
}
```

#### Example: TypeScript Agent Request

```json
{
  "events": [
    {
      "hostId": "laptop",
      "sessionId": "process-12345-1704067200000",
      "eventType": "hook_decision",
      "agentName": "error-acknowledge",
      "hookName": "Notification",
      "mode": "direct",
      "executionType": "typescript",
      "decision": "APPROVE",
      "toolName": "Bash",
      "workingDir": "/home/user/project",
      "latencyMs": 5,
      "success": true,
      "errorCount": 0,
      "decisionReason": "Auto-acknowledged error notification"
    }
  ]
}
```

#### Response

**Success (200 OK)**
```json
{
  "accepted": 1
}
```

**Validation Error (400 Bad Request)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["events", 0, "decision"],
      "message": "Invalid enum value"
    }
  ]
}
```

**Authentication Error (401 Unauthorized)**
```json
{
  "error": "Invalid API key"
}
```

**Server Error (500 Internal Server Error)**
```json
{
  "error": "Failed to store events"
}
```

---

### POST /api/v1/transcript

Upsert a session transcript (creates new or updates existing).

#### Request Body

```json
{
  "sessionId": "process-12345-1704067200000",
  "hostId": "laptop",
  "transcript": [
    {
      "role": "user",
      "content": "Help me fix this bug",
      "index": 0
    },
    {
      "role": "assistant",
      "content": "I'll investigate the issue",
      "index": 1
    },
    {
      "role": "tool_result",
      "content": "File contents...",
      "index": 2
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Unique session identifier |
| `hostId` | string | Yes | Host machine identifier |
| `transcript` | array | Yes | Array of transcript messages |

#### Transcript Message Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | enum | Yes | Message role: `user`, `assistant`, or `tool_result` |
| `content` | string | Yes | Message content |
| `index` | number | Yes | Message index in conversation |

#### Response

**Success (200 OK)**
```json
{
  "success": true
}
```

---

### GET /api/v1/health

Health check endpoint (no authentication required).

#### Response

**Success (200 OK)**
```json
{
  "status": "ok"
}
```

---

## Metrics Definitions

The Grafana dashboard calculates these key metrics:

| Metric | Formula | Description |
|--------|---------|-------------|
| **Approval Rate** | `(APPROVE + CONFIRM + SUCCESS) / Total * 100` | Percentage of positive decisions |
| **Success Rate** | `(Total - ERROR) / Total * 100` | Percentage of non-error events |
| **Denial Rate** | `DENY / Total * 100` | Percentage of denied operations |
| **Error Rate** | `ERROR / Total * 100` | Percentage of error events |

---

## Database Schema

### telemetry_events

Main table for storing telemetry events.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | BIGSERIAL | No | Primary key |
| `host_id` | VARCHAR(64) | No | Host identifier |
| `session_id` | VARCHAR(255) | No | Session identifier |
| `event_type` | VARCHAR(32) | No | Event type |
| `agent_name` | VARCHAR(64) | No | Agent name |
| `hook_name` | VARCHAR(64) | No | Hook name |
| `mode` | VARCHAR(16) | No | Execution mode |
| `execution_type` | VARCHAR(16) | No | Execution type (llm/typescript) |
| `decision` | VARCHAR(32) | No | Decision result |
| `decision_reason` | TEXT | Yes | Decision explanation |
| `tool_name` | VARCHAR(64) | No | Tool name |
| `working_dir` | VARCHAR(512) | No | Working directory |
| `latency_ms` | INTEGER | No | Latency in ms |
| `model_tier` | VARCHAR(16) | Yes | Model tier (null for typescript) |
| `model_name` | VARCHAR(128) | Yes | Model name (null for typescript) |
| `success` | BOOLEAN | No | Whether agent executed without internal errors |
| `error_count` | INTEGER | No | Number of LLM errors/retries |
| `extra_data` | JSONB | Yes | Additional data |
| `created_at` | TIMESTAMPTZ | No | Event timestamp |

### session_transcripts

Stores full conversation transcripts for debugging.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | BIGSERIAL | No | Primary key |
| `host_id` | VARCHAR(64) | No | Host identifier |
| `session_id` | VARCHAR(255) | No | Unique session identifier |
| `transcript_data` | JSONB | No | Full transcript |
| `message_counts` | JSONB | Yes | Message count by role |
| `created_at` | TIMESTAMPTZ | No | Creation time |
| `updated_at` | TIMESTAMPTZ | No | Last update time |

### api_keys

API key storage (SHA-256 hashed).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | No | Primary key |
| `key_hash` | VARCHAR(128) | No | SHA-256 hash of key |
| `description` | VARCHAR(255) | Yes | Key description |
| `created_at` | TIMESTAMPTZ | No | Creation time |
| `last_used_at` | TIMESTAMPTZ | Yes | Last usage time |
| `is_active` | BOOLEAN | No | Whether key is active |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL telemetry user password |
| `GF_SECURITY_ADMIN_PASSWORD` | Yes | Grafana admin password |
| `AGENT_FRAMEWORK_API_KEY` | Yes | API key for telemetry collection |

---

## Local Development

```bash
cd collector
bun install
bun run dev
```

Requires a local PostgreSQL instance with `DATABASE_URL` environment variable set.

---

## Rate Limits & Constraints

| Constraint | Value |
|------------|-------|
| Max events per batch | 100 |
| Min events per batch | 1 |
| Max `hostId` length | 64 characters |
| Max `sessionId` length | 255 characters |
| Max `agentName` length | 64 characters |
| Max `hookName` length | 64 characters |
| Max `toolName` length | 64 characters |
| Max `workingDir` length | 512 characters |
| Max `modelName` length | 128 characters |
