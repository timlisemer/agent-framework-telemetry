# Stage 1: Build collector
FROM oven/bun:1-debian AS collector-builder
WORKDIR /app
COPY collector/package.json collector/bun.lockb* ./
RUN bun install --frozen-lockfile --production
COPY collector/src ./src
COPY collector/tsconfig.json ./

# Stage 2: Runtime (PostgreSQL 16 already included)
FROM postgres:16-bookworm

ARG TARGETARCH
ARG S6_OVERLAY_VERSION=3.2.0.2

# Install base dependencies (needed for s6-overlay download and Grafana)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install s6-overlay (map Docker arch to s6-overlay naming)
RUN case "${TARGETARCH}" in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      *) S6_ARCH=${TARGETARCH} ;; \
    esac && \
    curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" -o /tmp/s6-overlay-noarch.tar.xz && \
    curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" -o /tmp/s6-overlay-arch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-arch.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

# Install Grafana 11
RUN curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /usr/share/keyrings/grafana.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list && \
    apt-get update && apt-get install -y --no-install-recommends grafana && \
    rm -rf /var/lib/apt/lists/*

# Install Bun
COPY --from=oven/bun:1-debian /usr/local/bin/bun /usr/local/bin/bun

# Copy built collector from stage 1
COPY --from=collector-builder /app /app

# Copy project files
COPY db/init.sql /docker-entrypoint-initdb.d/
COPY grafana/provisioning /etc/grafana/provisioning
COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d
COPY docker/scripts /scripts

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Configure PostgreSQL data directory
ENV PGDATA=/var/lib/postgresql/data
RUN mkdir -p "$PGDATA" && chown -R postgres:postgres "$PGDATA" && chmod 700 "$PGDATA"

# Configure Grafana
RUN mkdir -p /var/lib/grafana && chown -R grafana:grafana /var/lib/grafana

# Set environment for services
ENV NODE_ENV=production
# DATABASE_URL is constructed at runtime by validate-env.sh from POSTGRES_PASSWORD
ENV GF_PATHS_PROVISIONING=/etc/grafana/provisioning
ENV GF_PATHS_DATA=/var/lib/grafana

# Ports:
#   3000 - Grafana web UI
#   3001 - Telemetry Collector API
#   5432 - PostgreSQL (optional, for direct access)
EXPOSE 3000 3001 5432
VOLUME ["/var/lib/postgresql/data", "/var/lib/grafana"]

# Health check verifies all critical services are running
# - PostgreSQL responds to queries
# - Collector API responds on /api/v1/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD su postgres -c "pg_isready -q" && curl -sf http://localhost:3001/api/v1/health > /dev/null

ENTRYPOINT ["/init"]
