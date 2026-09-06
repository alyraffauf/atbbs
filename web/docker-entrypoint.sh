#!/bin/sh
set -e

: "${PUBLIC_URL:?PUBLIC_URL environment variable is required (e.g. https://atbbs.app)}"

if ! printf '%s' "$PUBLIC_URL" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'; then
  echo "PUBLIC_URL must be a bare HTTPS origin" >&2
  exit 1
fi

HTML=/usr/share/nginx/html

jq --arg origin "$PUBLIC_URL" \
  'walk(if type == "string" then gsub("__PUBLIC_URL__"; $origin) else . end)' \
  "${HTML}/config.template.json" > "${HTML}/config.json"
jq --arg origin "$PUBLIC_URL" \
  'walk(if type == "string" then gsub("__PUBLIC_URL__"; $origin) else . end)' \
  "${HTML}/client-metadata.template.json" > "${HTML}/client-metadata.json"

exec "$@"
