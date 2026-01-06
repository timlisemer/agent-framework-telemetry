#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

# Ensure PGDATA directory exists and has correct permissions
# This must be done as root BEFORE running initdb as postgres
if [ ! -d "$PGDATA" ]; then
    echo "Creating PostgreSQL data directory..."
    mkdir -p "$PGDATA"
fi

# Fix ownership and permissions on the mounted volume (as root)
echo "Setting ownership and permissions on $PGDATA..."
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

# Initialize database if not exists
if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL database..."
    su postgres -c "initdb -D $PGDATA --auth-host=md5 --auth-local=trust"

    # Configure PostgreSQL
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "host all all ::0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "PostgreSQL data directory initialized"
else
    echo "PostgreSQL data directory already exists"
fi
