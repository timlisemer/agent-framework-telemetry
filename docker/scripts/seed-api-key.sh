#!/bin/sh
set -e

# Use env to get raw value - avoids shell expansion of $ in key
# tr -d '\n' removes trailing newline from grep output before hashing
KEY_HASH=$(env | grep '^AGENT_FRAMEWORK_API_KEY=' | cut -d'=' -f2- | tr -d '\n' | sha256sum | cut -d' ' -f1)

su postgres -c "psql -d agent_telemetry -c \"INSERT INTO api_keys (key_hash, description, is_active) VALUES ('${KEY_HASH}', 'Container startup', TRUE) ON CONFLICT (key_hash) DO NOTHING;\""

echo "API key seeded"
