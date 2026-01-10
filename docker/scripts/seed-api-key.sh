#!/bin/sh
set -e

# Use env to get raw value - avoids shell expansion of $ in key
# tr -d '\n' removes trailing newline from grep output before hashing
KEY_HASH=$(env | grep '^AGENT_FRAMEWORK_API_KEY=' | cut -d'=' -f2- | tr -d '\n' | sha256sum | cut -d' ' -f1)

# Validate hash is exactly 64 hex characters (SHA-256 output)
if ! printf '%s' "$KEY_HASH" | grep -qE '^[a-f0-9]{64}$'; then
    echo "Error: Invalid key hash format" >&2
    exit 1
fi

# Use psql with -v to safely pass the hash as a variable
su postgres -c "psql -d agent_telemetry -v key_hash=\"'$KEY_HASH'\" -c \"INSERT INTO api_keys (key_hash, description, is_active) VALUES (:key_hash, 'Container startup', TRUE) ON CONFLICT (key_hash) DO NOTHING;\""

echo "API key seeded"
