#!/bin/sh
set -eu

# Renders public/config.template.js (copied verbatim into dist/ by Vite, then
# into /usr/share/nginx/html by the Dockerfile's final COPY) into config.js
# using the container's real runtime env vars, then removes the template so
# it is never accidentally served. Runs automatically because nginx:1-alpine's
# own /docker-entrypoint.sh executes every executable *.sh file in
# /docker-entrypoint.d/ before starting nginx.
#
# Fails loudly (nonzero exit + clear stderr message) if any required
# variable is missing, instead of silently defaulting — mirroring
# app/core/security.py's SECRET_KEY = os.environ["SECRET_KEY"] and
# vite.env-check.ts's validateViteEnv() in the sibling vb-api/vb-intern repos.

HTML_ROOT="/usr/share/nginx/html"
TEMPLATE="$HTML_ROOT/config.template.js"
OUTPUT="$HTML_ROOT/config.js"

require_env() {
  var_name="$1"
  eval "value=\${$var_name:-}"
  if [ -z "$value" ]; then
    echo "FATAL: required environment variable $var_name is not set. Aborting." >&2
    exit 1
  fi
}

require_env API_BASE_URL
require_env GOOGLE_CLIENT_ID
require_env PASSWORD_MIN_LENGTH
require_env APP_ENVIRONMENT

if [ ! -f "$TEMPLATE" ]; then
  echo "FATAL: $TEMPLATE not found. Aborting." >&2
  exit 1
fi

export API_BASE_URL GOOGLE_CLIENT_ID PASSWORD_MIN_LENGTH APP_ENVIRONMENT

envsubst '${API_BASE_URL} ${GOOGLE_CLIENT_ID} ${PASSWORD_MIN_LENGTH} ${APP_ENVIRONMENT}' \
  < "$TEMPLATE" > "$OUTPUT"

rm -f "$TEMPLATE"

echo "Generated runtime config.js from container environment."
