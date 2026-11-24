#!/usr/bin/env sh
# Gate de init del Custom Harness: valida el POC de Go y, si existe, el front en web/.
set -eu
cd "$(dirname "$0")"

echo "[init] go vet ./..."
go vet ./...
echo "[init] go build ./..."
go build ./...
echo "[init] go test ./..."
go test ./...

if [ -f web/package.json ]; then
  echo "[init] web: npm run check"
  (cd web && npm run --silent check)
fi

echo "[init] ok"
