#!/bin/sh
set -e

GF_DATA="${GF_PATHS_DATA:-/var/lib/grafana}"
GF_PLUGINS="/usr/share/grafana/data/plugins"

# Ensure Grafana data directory exists and has correct permissions
if [ ! -d "$GF_DATA" ]; then
    echo "Creating Grafana data directory..."
    mkdir -p "$GF_DATA"
fi

# Fix ownership and permissions on the mounted volume (as root)
echo "Setting ownership and permissions on $GF_DATA..."
chown grafana:grafana "$GF_DATA"
chmod 755 "$GF_DATA"

# Fix plugins directory permissions for auto-install
if [ ! -d "$GF_PLUGINS" ]; then
    echo "Creating Grafana plugins directory..."
    mkdir -p "$GF_PLUGINS"
fi
chown -R grafana:grafana "$GF_PLUGINS"
chmod 755 "$GF_PLUGINS"

echo "Grafana data directory ready"
