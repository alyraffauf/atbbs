#!/bin/sh
set -eu

image="atbbs-smoke:${GITHUB_RUN_ID:-local}"
container="atbbs-smoke-${GITHUB_RUN_ID:-local}-$$"

docker build -t "$image" .
docker run -d --name "$container" -e PUBLIC_URL=https://atbbs.example -p 127.0.0.1::80 "$image"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
port="$(docker port "$container" 80/tcp | sed 's/.*://')"

attempt=0
until curl --fail --silent "http://127.0.0.1:$port/config.json" >/tmp/atbbs-config.json; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 30
  sleep 1
done

jq -e '.redirect_uri == "https://atbbs.example/oauth/callback"' /tmp/atbbs-config.json
curl --fail --silent "http://127.0.0.1:$port/client-metadata.json" \
  | jq -e '.client_id == "https://atbbs.example/client-metadata.json"'

if docker run --rm -e PUBLIC_URL=http://atbbs.example "$image" true; then
  echo "container accepted a non-HTTPS PUBLIC_URL" >&2
  exit 1
fi
