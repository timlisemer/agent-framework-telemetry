#!/bin/sh
set -e

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

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
