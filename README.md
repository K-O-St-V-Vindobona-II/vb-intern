# vb-intern

This template should help get you started developing with Vue 3 in Vite.

> All related repos live in the [K-O-St-V-Vindobona-II](https://github.com/K-O-St-V-Vindobona-II) GitHub organization.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### After cloning

```sh
# Install git hooks — required once per clone, prevents CI failures from formatting mismatches
pre-commit install
```

> **Why this matters:** Without `pre-commit install`, commits bypass ESLint, Prettier,
> `vue-tsc` type-checking, and the Vitest suite entirely. The CI pipeline runs the same
> checks — all of which the pre-commit hooks mirror locally.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Environment Variables

For local dev (`npm run dev`), copy `.env.example` and fill in the required
values. The production Docker image ignores all `VITE_*` build-time
variables and instead reads four runtime variables (no `VITE_` prefix,
injected into the container's environment) on every container start — see
`.env.example` and `docker/docker-entrypoint.d/40-generate-runtime-config.sh`
for the full mechanism:

| Variable | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | Yes | Base URL of the backend API. |
| `PASSWORD_MIN_LENGTH` | Yes | Minimum password length shown in live form validation. |
| `APP_ENVIRONMENT` | Yes | Which stage this instance represents (`development`/`test`/`qa`/`production`). |
| `GOOGLE_CLIENT_ID` | No | Google OAuth2 client ID for "Sign in with Google". When unset, the button is hidden client-side instead of blocking boot. |

Actual production/stage values (and how they're managed): see
[`vb-deploy`'s Stages](../vb-deploy/README.md#stages).

## CI/CD

The pipeline (`.github/workflows/ci-cd.yml`) runs on every push to
`development` and on PRs to `main`:

1. **Lint & Format** — ESLint + Prettier
2. **Typecheck & Test** — `vue-tsc` (strict) + Vitest with coverage
3. **CodeQL Security Scan**
4. **Build & Push Image** — pushes to `ghcr.io` on release or manual trigger

Production/stage rollout itself happens outside this pipeline: the host's own
`podman-auto-update.timer` picks up the new `:latest` image automatically, or
an operator triggers it immediately via `--tags deploy-intern` — see
[`vb-deploy`'s Phase 2 — Tag-2-Betrieb](../vb-deploy/README.md#phase-2--tag-2-betrieb).
