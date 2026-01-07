#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until su postgres -c "pg_isready -q"; do
    sleep 1
done
echo "PostgreSQL is ready"

# Create user and database if not exists
# Get password safely and escape single quotes for SQL
# tr -d '\n' removes trailing newline from grep output
PG_PASS=$(env | grep '^POSTGRES_PASSWORD=' | cut -d'=' -f2- | tr -d '\n' | sed "s/'/''/g")
su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='telemetry'\" | grep -q 1 || psql -c \"CREATE USER telemetry WITH PASSWORD '${PG_PASS}';\""
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='agent_telemetry'\" | grep -q 1 || psql -c \"CREATE DATABASE agent_telemetry OWNER telemetry;\""

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
