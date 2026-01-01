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

echo "Environment validation passed"
