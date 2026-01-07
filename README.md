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

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/telemetry/batch | X-API-Key | Batch insert events (max 100) |
| POST | /api/v1/transcript | X-API-Key | Upsert session transcript |
| GET | /api/v1/health | None | Health check |

## API Key Management

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

## Core API

The telemetry API is built on two fundamental concepts provided by the client.

### Decision (required)

Every event must include exactly one decision value:

| Decision | Category | When to Use |
|----------|----------|-------------|
| `APPROVE` | Authorization | Agent approved tool execution |
| `DENY` | Authorization | Agent blocked tool execution |
| `CONFIRM` | Quality | Check/confirm agent validated code |
| `SUCCESS` | Outcome | Operation completed without errors |
| `ERROR` | Outcome | Provider error occurred (API failures, etc.) |

### Mode (required)

Execution mode the agent is running in:

| Mode | Description |
|------|-------------|
| `direct` | Direct execution mode |
| `lazy` | Lazy evaluation mode |

### Metrics Definitions

- **Approval Rate**: Percentage of events where `decision IN ('APPROVE', 'CONFIRM', 'SUCCESS')`
- **Success Rate**: Percentage of events where `decision != 'ERROR'`
- **Denial Rate**: Percentage of events where `decision = 'DENY'`
- **Error Rate**: Percentage of events where `decision = 'ERROR'`

## Telemetry Event Format

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `hostId` | string | Unique identifier for the host machine |
| `sessionId` | string | Session identifier |
| `eventType` | enum | One of: `agent_execution`, `hook_decision`, `error`, `escalation`, `commit` |
| `agentName` | string | Name of the agent (e.g., `tool-approve`, `commit`, `check`, `confirm`) |
| `hookName` | string | Name of the hook that triggered this agent (e.g., `PreToolUse`, `PostToolUse`) |
| `mode` | enum | Execution mode: `direct`, `lazy` |
| `decision` | enum | Decision result: `APPROVE`, `DENY`, `CONFIRM`, `SUCCESS`, `ERROR` |
| `toolName` | string | Name of the tool being executed (e.g., `Bash`, `Read`, `Edit`) |
| `workingDir` | string | Working directory path |
| `latencyMs` | number | Operation latency in milliseconds |
| `modelTier` | enum | Model tier category: `haiku`, `sonnet`, `opus` |
| `modelName` | string | Actual model name from LLM provider (e.g., `claude-3-haiku-20240307`, `gpt-4-turbo`) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp (defaults to server time if not provided) |
| `decisionReason` | string | Explanation for the decision |
| `extraData` | object | Additional arbitrary data (JSONB) |

### Example Request

```json
{
  "events": [
    {
      "hostId": "laptop",
      "sessionId": "abc123",
      "eventType": "agent_execution",
      "agentName": "tool-approve",
      "hookName": "PreToolUse",
      "mode": "direct",
      "decision": "APPROVE",
      "toolName": "Bash",
      "workingDir": "/home/user/project",
      "latencyMs": 150,
      "modelTier": "haiku",
      "modelName": "claude-3-haiku-20240307",
      "decisionReason": "Tool is safe"
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL telemetry user password |
| `GF_SECURITY_ADMIN_PASSWORD` | Yes | Grafana admin password |
| `AGENT_FRAMEWORK_API_KEY` | Yes | API key for telemetry collection (use `openssl rand -hex 32`) |

## Local Development

```bash
cd collector
bun install
bun run dev
```

Requires a local PostgreSQL instance with `DATABASE_URL` environment variable set.
