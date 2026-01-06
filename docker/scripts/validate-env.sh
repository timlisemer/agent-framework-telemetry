#!/bin/sh
set -e

missing=""
for var in POSTGRES_PASSWORD GF_SECURITY_ADMIN_PASSWORD TELEMETRY_API_KEY; do
    eval "val=\$$var"
    if [ -z "$val" ]; then
        echo "ERROR: $var not set"
        missing="$missing $var"
    fi
done

if [ -n "$missing" ]; then
    echo "Missing required environment variables:$missing"
    exit 1
fi

# Export DATABASE_URL to s6 container environment for collector service
DATABASE_URL="postgres://telemetry:${POSTGRES_PASSWORD}@localhost:5432/agent_telemetry"
printf '%s' "$DATABASE_URL" > /run/s6/container_environment/DATABASE_URL
echo "DATABASE_URL exported to s6 environment"

echo "Environment validation passed"
