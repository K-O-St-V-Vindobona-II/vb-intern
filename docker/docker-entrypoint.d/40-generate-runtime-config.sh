#!/bin/sh
set -eu

# Renders config.template.js (moved out of the webroot by the Dockerfile,
# see /etc/vb-intern/config.template.js) into config.js using the
# container's real runtime env vars, writing the result to a tmpfs path
# served via nginx.conf's "alias" directive instead of into the webroot
# itself - the webroot is read-only in production (ReadOnly=true), so
# nothing can be written there at runtime. Runs automatically because
# nginx:1-alpine's own /docker-entrypoint.sh executes every executable
# *.sh file in /docker-entrypoint.d/ before starting nginx.
#
# Fails loudly (nonzero exit + clear stderr message) if any required
# variable is missing, instead of silently defaulting - mirroring
# app/core/security.py's SECRET_KEY = os.environ["SECRET_KEY"] and
# vite.env-check.ts's validateViteEnv() in the sibling vb-api/vb-intern repos.

TEMPLATE="/etc/vb-intern/config.template.js"
OUTPUT="/run/vb-config/config.js"

require_env() {
  var_name="$1"
  eval "value=\${$var_name:-}"
  if [ -z "$value" ]; then
    echo "FATAL: required environment variable $var_name is not set. Aborting." >&2
    exit 1
  fi
}

# Unlike require_env(), a missing/empty value is not an error - it just
# stays an empty string in the rendered config.js. Used for GOOGLE_CLIENT_ID:
# the frontend hides the "Sign in with Google" button when it is empty
# (see LoginView.vue's isGoogleLoginEnabled) instead of refusing to boot.
optional_env() {
  var_name="$1"
  eval "value=\${$var_name:-}"
  eval "$var_name=\$value"
}

require_env API_BASE_URL
optional_env GOOGLE_CLIENT_ID
require_env PASSWORD_MIN_LENGTH
require_env APP_ENVIRONMENT

if [ ! -f "$TEMPLATE" ]; then
  echo "FATAL: $TEMPLATE not found. Aborting." >&2
  exit 1
fi

export API_BASE_URL GOOGLE_CLIENT_ID PASSWORD_MIN_LENGTH APP_ENVIRONMENT

mkdir -p "$(dirname "$OUTPUT")"

envsubst '${API_BASE_URL} ${GOOGLE_CLIENT_ID} ${PASSWORD_MIN_LENGTH} ${APP_ENVIRONMENT}' \
  < "$TEMPLATE" > "$OUTPUT"

echo "Generated runtime config.js from container environment."
