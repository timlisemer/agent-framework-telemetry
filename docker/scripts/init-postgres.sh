#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until su postgres -c "pg_isready -q"; do
    sleep 1
done
echo "PostgreSQL is ready"

# Create user and database if not exists
# Get password safely from environment
PG_PASS=$(env | grep '^POSTGRES_PASSWORD=' | cut -d'=' -f2- | tr -d '\n')

# Validate password is not empty
if [ -z "$PG_PASS" ]; then
    echo "Error: POSTGRES_PASSWORD is required" >&2
    exit 1
fi

# Escape single quotes for SQL ('' is the escape sequence for ' in PostgreSQL)
PG_PASS_ESCAPED=$(printf '%s' "$PG_PASS" | sed "s/'/''/g")

# Check if user exists, create if not
su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='telemetry'\"" | grep -q 1 || \
    su postgres -c "psql -c \"CREATE USER telemetry WITH PASSWORD '${PG_PASS_ESCAPED}';\""

# Check if database exists, create if not
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='agent_telemetry'\"" | grep -q 1 || \
    su postgres -c "psql -c \"CREATE DATABASE agent_telemetry OWNER telemetry;\""

# Run init.sql if tables don't exist
su postgres -c "psql -d agent_telemetry -tc \"SELECT 1 FROM information_schema.tables WHERE table_name='telemetry_events'\" | grep -q 1" || {
    echo "Running init.sql..."
    su postgres -c "psql -d agent_telemetry -f /docker-entrypoint-initdb.d/init.sql"
    su postgres -c "psql -d agent_telemetry -c \"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO telemetry;\""
    su postgres -c "psql -d agent_telemetry -c \"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO telemetry;\""
}

# Seed API key
/scripts/seed-api-key.sh

echo "PostgreSQL initialization complete"
