# Agent Framework Telemetry

VPS-hosted telemetry collection stack for the agent-framework.

## Stack

- **Collector**: Bun + Hono API service
- **Database**: PostgreSQL 16
- **Visualization**: Grafana 11
- **Proxy**: Caddy 2 (automatic TLS)

## Quick Start

1. Copy environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your domain and passwords
   ```

2. Start the stack:
   ```bash
   docker compose up -d
   ```

3. Create API keys for each host (see below)

4. Test the health endpoint:
   ```bash
   curl https://your-domain.com/api/v1/health
   ```

5. Access Grafana:
   ```
   https://your-domain.com/grafana/
   ```

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
docker compose exec postgres psql -U telemetry -d agent_telemetry -c \
  "INSERT INTO api_keys (key_hash, host_id, description)
   VALUES (encode(sha256('$API_KEY'::bytea), 'hex'), 'laptop', 'Laptop host');"
```

Repeat for each host (desktop, server, etc.), using different host_id values.

## HomeAssistant Integration

Add an iframe card to embed Grafana:

```yaml
type: iframe
url: https://your-domain.com/grafana/d/agent-overview?orgId=1&refresh=30s&kiosk
aspect_ratio: 16:9
```

## Development

Local development without Docker:

```bash
cd collector
bun install
bun run dev
```

Requires a local PostgreSQL instance with `DATABASE_URL` environment variable set.

## Configuration

Environment variables in `.env`:

| Variable | Description |
|----------|-------------|
| DOMAIN | Your domain (e.g., telemetry.example.com) |
| POSTGRES_PASSWORD | PostgreSQL password |
| GRAFANA_ADMIN_PASSWORD | Grafana admin password |

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

## License

Private - All rights reserved.
