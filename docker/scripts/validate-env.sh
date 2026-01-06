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

# URL-encode the password for safe use in DATABASE_URL
# Handle common special characters that break URL parsing
ENCODED_PASSWORD=$(printf '%s' "$POSTGRES_PASSWORD" | sed \
    -e 's/%/%25/g' \
    -e 's/ /%20/g' \
    -e 's/!/%21/g' \
    -e 's/#/%23/g' \
    -e 's/\$/%24/g' \
    -e 's/&/%26/g' \
    -e "s/'/%27/g" \
    -e 's/(/%28/g' \
    -e 's/)/%29/g' \
    -e 's/*/%2A/g' \
    -e 's/+/%2B/g' \
    -e 's/,/%2C/g' \
    -e 's/:/%3A/g' \
    -e 's/;/%3B/g' \
    -e 's/=/%3D/g' \
    -e 's/?/%3F/g' \
    -e 's/@/%40/g' \
    -e 's/\[/%5B/g' \
    -e 's/\]/%5D/g')

# Export DATABASE_URL to s6 container environment for collector service
DATABASE_URL="postgres://telemetry:${ENCODED_PASSWORD}@localhost:5432/agent_telemetry"
printf '%s' "$DATABASE_URL" > /run/s6/container_environment/DATABASE_URL
echo "DATABASE_URL exported to s6 environment"

echo "Environment validation passed"
