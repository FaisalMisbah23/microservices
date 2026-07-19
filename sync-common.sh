#!/bin/bash
# sync-common.sh
# Rebuild local common and symlink it into each service that depends on it

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMON_DIR="$ROOT_DIR/common"

echo "Cleaning and rebuilding common..."
cd "$COMMON_DIR"
npm run build

# Services that depend on @fmticketflow/common
SERVICES=("auth" "tickets" "orders" "expiration")

for service in "${SERVICES[@]}"; do
  echo "Linking common into $service..."
  TARGET_DIR="$ROOT_DIR/$service/node_modules/@fmticketflow"
  mkdir -p "$TARGET_DIR"
  rm -rf "$TARGET_DIR/common"
  ln -sfn "$COMMON_DIR" "$TARGET_DIR/common"
done

echo "All services updated with latest common build!"
