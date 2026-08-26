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
[`vb-deploy`'s Phase 2 — Day-2 Operations](../vb-deploy/README.md#phase-2--day-2-operations).

---

# Deutsch

Dieses Template soll den Einstieg in die Entwicklung mit Vue 3 in Vite erleichtern.

> Alle zugehörigen Repos liegen in der GitHub-Organisation [K-O-St-V-Vindobona-II](https://github.com/K-O-St-V-Vindobona-II).

## Empfohlenes IDE-Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (Vetur deaktivieren).

## Empfohlenes Browser-Setup

- Chromium-basierte Browser (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Custom Object Formatter in den Chrome DevTools aktivieren](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Custom Object Formatter in den Firefox DevTools aktivieren](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Typ-Unterstützung für `.vue`-Imports in TS

TypeScript kann Typinformationen für `.vue`-Imports von Haus aus nicht verarbeiten, deshalb wird die `tsc`-CLI für die Typprüfung durch `vue-tsc` ersetzt. Im Editor braucht es [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar), damit der TypeScript-Sprachdienst `.vue`-Typen versteht.

## Konfiguration anpassen

Siehe [Vite-Konfigurationsreferenz](https://vite.dev/config/).

## Projekt-Setup

```sh
npm install
```

### Nach dem Klonen

```sh
# Git-Hooks installieren — einmalig pro Klon nötig, verhindert CI-Fehlschläge durch Formatierungs-Abweichungen
pre-commit install
```

> **Warum das wichtig ist:** Ohne `pre-commit install` umgehen Commits ESLint, Prettier,
> die `vue-tsc`-Typprüfung und die Vitest-Suite komplett. Die CI-Pipeline führt dieselben
> Prüfungen aus — alle davon werden lokal von den Pre-Commit-Hooks gespiegelt.

### Kompilieren mit Hot-Reload für die Entwicklung

```sh
npm run dev
```

### Typprüfung, Kompilieren und Minifizieren für Produktion

```sh
npm run build
```

## Umgebungsvariablen

Für die lokale Entwicklung (`npm run dev`) `.env.example` kopieren und die
nötigen Werte eintragen. Das Produktions-Docker-Image ignoriert alle
`VITE_*`-Build-Time-Variablen und liest stattdessen vier Laufzeit-Variablen
(ohne `VITE_`-Präfix, in die Container-Umgebung injiziert) bei jedem
Container-Start ein — siehe `.env.example` und
`docker/docker-entrypoint.d/40-generate-runtime-config.sh` für den vollen
Mechanismus:

| Variable | Pflicht | Zweck |
|---|---|---|
| `API_BASE_URL` | Ja | Basis-URL der Backend-API. |
| `PASSWORD_MIN_LENGTH` | Ja | Mindest-Passwortlänge für die Live-Validierung im Formular. |
| `APP_ENVIRONMENT` | Ja | Welche Stage diese Instanz darstellt (`development`/`test`/`qa`/`production`). |
| `GOOGLE_CLIENT_ID` | Nein | Google-OAuth2-Client-ID für "Mit Google anmelden". Fehlt sie, wird der Button clientseitig ausgeblendet, statt den Start zu blockieren. |

Echte Production-/Stage-Werte (und wie sie verwaltet werden): siehe
[`vb-deploy`s Stages](../vb-deploy/README.md#stages-1).

## CI/CD

Die Pipeline (`.github/workflows/ci-cd.yml`) läuft bei jedem Push nach
`development` und bei PRs nach `main`:

1. **Lint & Format** — ESLint + Prettier
2. **Typecheck & Test** — `vue-tsc` (strict) + Vitest mit Coverage
3. **CodeQL Security Scan**
4. **Build & Push Image** — pusht nach `ghcr.io` bei Release oder manuellem Trigger

Der Production-/Stage-Rollout selbst läuft außerhalb dieser Pipeline: Der
`podman-auto-update.timer` des Zielsystems holt das neue `:latest`-Image
automatisch, oder ein Operator löst ihn sofort per `--tags deploy-intern`
aus — siehe
[`vb-deploy`s Phase 2 — Tag-2-Betrieb](../vb-deploy/README.md#phase-2--tag-2-betrieb).
