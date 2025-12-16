# Isolated container for package analysis
# Security: runs with --network none, --tmpfs /tmp:size=100m, --memory 512m
#
# Build: docker build -t camelcost:latest .
# Run:   docker run --rm --network none --tmpfs /tmp:size=100m camelcost react

FROM oven/bun:1-alpine

# Install Node.js for running bundled code detection
RUN apk add --no-cache nodejs npm

# Create non-root user for security
RUN adduser -D -u 1000 -h /home/analyzer analyzer

WORKDIR /app

# Copy package files and install deps as root first
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile && \
    chown -R analyzer:analyzer /app

# Copy source
COPY --chown=analyzer:analyzer src/ ./src/

# Create writable directories that will be tmpfs mounted
RUN mkdir -p /tmp/analysis && chown analyzer:analyzer /tmp/analysis

# Switch to non-root user
USER analyzer

# Set HOME for bun/npm to work properly
ENV HOME=/home/analyzer
ENV TMPDIR=/tmp

# Entry point runs analysis and outputs JSON
ENTRYPOINT ["bun", "run", "src/cli.js"]
