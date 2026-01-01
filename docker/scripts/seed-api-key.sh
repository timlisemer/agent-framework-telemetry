#!/bin/sh
set -e

KEY_HASH=$(printf '%s' "${TELEMETRY_API_KEY}" | sha256sum | cut -d' ' -f1)

su postgres -c "psql -d agent_telemetry -c \"INSERT INTO api_keys (key_hash, host_id, description, is_active) VALUES ('${KEY_HASH}', 'default', 'Container startup', TRUE) ON CONFLICT (key_hash) DO NOTHING;\""

echo "API key seeded"
