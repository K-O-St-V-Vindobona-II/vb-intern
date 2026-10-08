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

fail() {
  echo "FATAL: $1 Aborting." >&2
  exit 1
}

# config.template.js writes every value between single quotes into JavaScript that the browser
# executes, so each one is held to what it may legitimately be: a quote, backslash, angle
# bracket, dollar sign, backtick, whitespace or line break in any of them would end the string
# or the script and break, or take over, config.js.
case "$API_BASE_URL" in
  http://?* | https://?*) ;;
  *) fail "API_BASE_URL must start with http:// or https:// and name a host." ;;
esac
case "$API_BASE_URL" in
  *[!A-Za-z0-9:/._~%@+,=?\&#-]*)
    fail "API_BASE_URL contains a character that is not allowed in a plain URL."
    ;;
esac
case "$GOOGLE_CLIENT_ID" in
  *[!A-Za-z0-9._-]*)
    fail "GOOGLE_CLIENT_ID may only contain letters, digits, dots, underscores and hyphens."
    ;;
esac
case "$PASSWORD_MIN_LENGTH" in
  *[!0-9]* | 0*) fail "PASSWORD_MIN_LENGTH must be a positive whole number." ;;
esac
case "$APP_ENVIRONMENT" in
  development | test | qa | production) ;;
  *) fail "APP_ENVIRONMENT must be one of: development, test, qa, production." ;;
esac

if [ ! -f "$TEMPLATE" ]; then
  echo "FATAL: $TEMPLATE not found. Aborting." >&2
  exit 1
fi

export API_BASE_URL GOOGLE_CLIENT_ID PASSWORD_MIN_LENGTH APP_ENVIRONMENT

mkdir -p "$(dirname "$OUTPUT")"

envsubst '${API_BASE_URL} ${GOOGLE_CLIENT_ID} ${PASSWORD_MIN_LENGTH} ${APP_ENVIRONMENT}' \
  < "$TEMPLATE" > "$OUTPUT"

echo "Generated runtime config.js from container environment."
