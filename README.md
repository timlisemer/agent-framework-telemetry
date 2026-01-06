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

Generate and insert API keys for each host:

```bash
# Generate a new API key
API_KEY=$(openssl rand -hex 32)
echo "API Key for laptop: $API_KEY"

# Insert the hash into the database
psql -U telemetry -d agent_telemetry -c \
  "INSERT INTO api_keys (key_hash, host_id, description)
   VALUES (encode(sha256('$API_KEY'::bytea), 'hex'), 'laptop', 'Laptop host');"
```

## Telemetry Event Format

```json
{
  "events": [
    {
      "hostId": "laptop",
      "sessionId": "abc123",
      "eventType": "agent_execution",
      "agentName": "tool-approve",
      "timestamp": "2024-01-15T10:30:00Z",
      "decision": "APPROVED",
      "decisionReason": "Tool is safe",
      "toolName": "Bash",
      "latencyMs": 150,
      "modelTier": "haiku"
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
| `TELEMETRY_HOST_ID` | No | Host ID to associate with API key (default: `default`) |

## Local Development

```bash
cd collector
bun install
bun run dev
```

Requires a local PostgreSQL instance with `DATABASE_URL` environment variable set.
