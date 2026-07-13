// Central runtime-configuration reader.
//
// PRODUCTION: the Docker entrypoint hook script
// (docker/docker-entrypoint.d/40-generate-runtime-config.sh) renders
// public/config.template.js into /usr/share/nginx/html/config.js from real
// container env vars every time the container starts. index.html loads it
// via a plain (non-module) <script> tag before the app's module bundle, so
// window.__APP_CONFIG__ is always populated before this module is ever
// evaluated. This is what lets the same built image be redeployed across
// environments purely via container env-var changes, without a rebuild.
//
// DEV / VITEST: nothing generates config.js, so the <script src="/config.js">
// tag in index.html 404s harmlessly and window.__APP_CONFIG__ stays
// undefined. Every getter below then falls through to the existing
// import.meta.env.VITE_* build-time variables, then to the same literal
// defaults that existed in the code before this module was introduced.
//
// Each getter is a plain function (not a precomputed top-level constant) so
// the read always happens at call time, matching the previous inline
// import.meta.env.VITE_* reads exactly (some of them lazy, e.g. inside a
// submit handler) — see ResetPasswordView.vue.

declare global {
  interface Window {
    __APP_CONFIG__?: Record<string, string>
  }
}

function readRuntimeConfig(key: string): string | undefined {
  return window.__APP_CONFIG__?.[key]
}

export function apiBaseUrl(): string {
  return (
    readRuntimeConfig('API_BASE_URL') ||
    import.meta.env.VITE_API_BASE_URL ||
    'https://api.vindobona2.at/api'
  )
}

export function googleClientId(): string {
  return readRuntimeConfig('GOOGLE_CLIENT_ID') || import.meta.env.VITE_GOOGLE_CLIENT_ID
}

export function passwordMinLength(): number {
  return Number(
    readRuntimeConfig('PASSWORD_MIN_LENGTH') || import.meta.env.VITE_PASSWORD_MIN_LENGTH || 8,
  )
}

export function appEnvironment(): string | undefined {
  return readRuntimeConfig('APP_ENVIRONMENT') || import.meta.env.VITE_APP_ENVIRONMENT
}
