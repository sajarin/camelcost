#!/bin/bash
# Sandboxed package analysis using Docker
# Security features:
# - --network none: No network access during analysis
# - --tmpfs /tmp:size=100m: Limited disk space (100MB)
# - --memory 512m: Limited memory
# - --cpus 1: Limited CPU
# - --pids-limit 100: Limited processes
# - --read-only: Read-only root filesystem
# - --user 1000:1000: Non-root user
# - --rm: Auto-cleanup container

set -e

PACKAGE="$1"
TIMEOUT="${2:-120}"  # Default 2 minute timeout

if [ -z "$PACKAGE" ]; then
    echo '{"error":"No package name provided"}'
    exit 1
fi

# Run analysis in isolated container
timeout "$TIMEOUT" docker run \
    --rm \
    --network none \
    --tmpfs /tmp:size=100m,mode=1777 \
    --memory 512m \
    --memory-swap 512m \
    --cpus 1 \
    --pids-limit 100 \
    --read-only \
    --user 1000:1000 \
    --security-opt no-new-privileges \
    camelcost:latest \
    "$PACKAGE" --json 2>/dev/null

exit $?
