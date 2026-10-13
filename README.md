# vb-intern

[English](README.md) | [Deutsch](README.de.md)

The management web application of the Vindobona II system, for members and officials. This README covers what is specific to this repository and assumes you know the [`vb-deploy` README](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md), the leading document for how the whole system is built, run and restored. All four repositories live in the GitHub organization [K-O-St-V-Vindobona-II](https://github.com/K-O-St-V-Vindobona-II).

## 1. Purpose and naming

`vb-intern` is the **authenticated frontend**: the single-page application in which members and officials log in and use the member database ("Standesdatenbank"), the archive, the fee accounts and bookkeeping of the alumni association ("AH-Kassen"/`p4x`), the information pages, the administration of the public website ("www-Administration") and the system pages for operators. It contains no data of its own: every page is a client of [`vb-api`](https://github.com/K-O-St-V-Vindobona-II/vb-api). The public website is a separate application, [`vb-www`](https://github.com/K-O-St-V-Vindobona-II/vb-www).

**Naming convention:** the repository name is the subdomain. `vb-intern` is served at **`intern.vindobona2.at`** (and `vb-api` at `api.vindobona2.at`, `vb-www` at `www.vindobona2.at`). On other stages the domains come from the stage's inventory file in the private repository `vb-access` (see `vb-deploy` [1.3](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md#13-the-github-organization-and-the-repositories)).

Tech stack: Vue 3 (`<script setup>`, TypeScript, Composition API), Vite, Pinia, Vue Router, PrimeVue, axios; served by nginx in production.

## 2. Containers of this repository

One container: **`vb-intern`**, in its own pod `vb-intern-pod`. It has no database and no sidecar. On the local development stage the same name is a plain container with the Vite dev server instead of nginx.

| Container | Pod | Image | Runs code of this repository? |
|---|---|---|---|
| `vb-intern` | `vb-intern-pod` | `ghcr.io/k-o-st-v-vindobona-ii/vb-intern` | **Yes**, the built application |

Quadlet definition, port and hardening are in `vb-deploy` (chapter [1.4](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md#14-containers-and-pods)).

## 3. What the container does

`vb-intern` serves the **pre-built static files** of the application with nginx (the unprivileged image, port 8080 in the container, port 21001 on `127.0.0.1` of the host, reached through Caddy). nginx falls back to `index.html` for every unknown path (client-side routing), caches `/assets/` for a year because file names carry a hash, makes browsers re-check `index.html` on every visit and never stores `config.js`.

The browser, not the container, talks to the backend: the application calls the API at `API_BASE_URL` directly (with credentials). Login works with an access token that the application keeps in memory only, plus a refresh cookie set by the API that is renewed in the background, so a page reload does not log you out. The Content-Security-Policy that Caddy sets for `intern` allows exactly this API, Google's sign-in script and the object storage for images.

On start the container writes `config.js` from its environment (see below) and refuses to start when a value is missing or malformed. Health check: the root URL answers.

## 4. Where the code of this repository runs

The code is built **once**, in the `Dockerfile`: a Node stage runs `npm ci` and `npm run build`; a second stage copies the result into `nginx-unprivileged`. The CI publishes the image as `ghcr.io/k-o-st-v-vindobona-ii/vb-intern:latest` and `...:<full commit sha>` (the image also carries the commit as the label `org.opencontainers.image.revision`). The same image runs on every stage: **nothing stage specific is built in.** Instead a start-up script (`docker/docker-entrypoint.d/40-generate-runtime-config.sh`) renders `config.js` from four environment variables of the container on every start, and the application reads them through `src/runtimeConfig.ts`:

| Variable | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | yes | Base URL of the backend, for example `https://api.vindobona2.at/api`. |
| `PASSWORD_MIN_LENGTH` | yes | Minimum password length shown in form validation. |
| `APP_ENVIRONMENT` | yes | Which stage this instance is (`development`, `test`, `qa`, `production`). |
| `GOOGLE_CLIENT_ID` | no | Client ID for "Sign in with Google"; without it the button is hidden. |

The values are written into JavaScript that every visitor's browser runs, so the script validates them: `API_BASE_URL` must be a plain `http://` or `https://` address without quotes, backslashes, angle brackets, `$`, backticks or whitespace; `PASSWORD_MIN_LENGTH` a positive whole number; `APP_ENVIRONMENT` one of the four stage names; `GOOGLE_CLIENT_ID` only letters, digits, dots, underscores and hyphens. The real values per stage live in the private repository `vb-access`; the variables are described in `vb-deploy` ([Appendix A](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md#appendix-a-secrets-and-required-variables)).

On the **development stage** nothing generates `config.js`: its request returns 404 (harmless) and the application falls back to the `VITE_*` variables of `.env`, then to built-in defaults.

Layout of the source:

```
src/views/         one folder per area: standesdb, archive, p4x, tracking, system, publicsite, auth, ...
src/components/    shared building blocks
src/layouts/       AppLayout (logged in) and AuthLayout (login)
src/services/      one module per API area; the only place that calls the API
src/stores/        Pinia stores (session, loading state, ...)
src/composables/   reusable logic without UI (session manager, ...)
src/router/        routes and navigation guards (permissions)
src/utils/         formatting and helpers
src/types/         shared TypeScript types
```

---

## Development

### Setup

- Podman with the `vb-intern` development container running from the local development Quadlets ([`vb-deploy` 5.7](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md#57-local-development-environment)). It runs `npm run dev` (Vite dev server with hot reload) with the source folder mounted, on `127.0.0.1:20001`. The API it talks to is configured by `VITE_API_BASE_URL`.
- Node `^22.18.0` or `>=24.12.0` (the container image uses Node 24).
- Run every command through `podman exec vb-intern ...`; never run `npm install` on the host.
- Editor: VS Code with the official Vue extension (disable Vetur) and the Vue.js devtools in your browser. Type checking uses `vue-tsc` because TypeScript alone cannot read `.vue` files.

```bash
# once per clone: install the git hooks (they mirror the CI checks)
pre-commit install
```

Without the hooks, commits skip ESLint, Prettier, type checking and the tests, and the CI fails later. The hooks that need the container run through `podman exec`, so it must be running when you commit.

### Commands

```bash
podman exec vb-intern npm run dev            # dev server (already started by the container)
podman exec vb-intern npm run build          # type check and production build
podman exec vb-intern npm run type-check     # vue-tsc, strict
podman exec vb-intern npm run lint           # ESLint, no warnings allowed
podman exec vb-intern npm run format:check   # Prettier (use `npm run format` to fix)
podman exec vb-intern npx vitest run         # all tests once
podman exec vb-intern npm run test:coverage  # tests with the coverage gate
```

### Tests

Vitest with jsdom. Coverage is measured for statements, branches, functions and lines, and each must stay at **90 %** or above (also for the stores on their own); `npm run test:coverage` fails below that, and so does the CI. New logic comes with tests; put logic that has no UI into a composable or a store so it can be tested without rendering.

### Environment variables

For local development copy `.env.example` to `.env` and fill in `VITE_APP_ENVIRONMENT`, `VITE_API_BASE_URL` and `VITE_PASSWORD_MIN_LENGTH`. `VITE_*` variables are compiled into the bundle and are therefore public: never put a secret there. The production image ignores them and uses the four runtime variables above. A build-time guard in `vite.env-check.ts` checks the stage name.

### Branching and conventions

- `main` is protected and takes pull requests only. Work happens on `development`.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) and are written in English; so are code comments.
- Components use `<script setup lang="ts">` with typed `defineProps`/`defineEmits`, scoped styles, and a mobile-first layout (base styles for phones, `min-width` media queries for larger screens).

### CI/CD

`.github/workflows/ci-cd.yml` runs on every push to and pull request against `main`, weekly (to refresh the CodeQL scan) and on manual trigger:

1. **Lint and format:** ESLint and Prettier.
2. **Typecheck and test:** `vue-tsc` (strict) and Vitest with the coverage thresholds.
3. **CodeQL** security scan.
4. **Read-only rootfs smoke test:** the image started read-only with all capabilities dropped, checking what it serves.
5. **Build and push the image:** only from `main` (push or manual trigger), and only after every other job passed.

The rollout is not part of the pipeline: the host's `podman-auto-update.timer` picks up the new `:latest` image overnight, or an operator deploys at once with `--tags deploy-intern` (see `vb-deploy` [1.7](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.md#17-how-a-change-reaches-production)).
