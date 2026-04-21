#!/bin/sh
set -e

: "${PUBLIC_URL:?PUBLIC_URL environment variable is required (e.g. https://atbbs.app)}"

# Strip trailing slash.
PUBLIC_URL="${PUBLIC_URL%/}"

HTML=/usr/share/nginx/html

# Substitute __PUBLIC_URL__ in the vite-emitted templates. Use | as sed
# delimiter since PUBLIC_URL contains /.
sed "s|__PUBLIC_URL__|${PUBLIC_URL}|g" \
  "${HTML}/config.template.json" > "${HTML}/config.json"
sed "s|__PUBLIC_URL__|${PUBLIC_URL}|g" \
  "${HTML}/client-metadata.template.json" > "${HTML}/client-metadata.json"

exec nginx -g 'daemon off;'
