# vb-intern

[English](README.md) | [Deutsch](README.de.md)

Die Verwaltungs-Webanwendung des Vindobona-II-Systems, für Mitglieder und Funktionäre. Dieses README behandelt, was für dieses Repository spezifisch ist, und setzt das [`vb-deploy`-README](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md) voraus, das führende Dokument dafür, wie das ganze System aufgebaut ist, betrieben und wiederhergestellt wird. Alle vier Repositories liegen in der GitHub-Organisation [K-O-St-V-Vindobona-II](https://github.com/K-O-St-V-Vindobona-II).

## 1. Aufgabe und Namenskonvention

`vb-intern` ist das **Frontend mit Anmeldung**: die Single-Page-Anwendung, in der sich Mitglieder und Funktionäre anmelden und die Mitgliederdatenbank ("Standesdatenbank"), das Archiv, die Beitragskonten und die Buchhaltung der Altherrenschaft ("AH-Kassen"/`p4x`), die Informationsseiten, die Verwaltung der öffentlichen Website ("www-Administration") und die Systemseiten für Betreiber nutzen. Sie enthält keine eigenen Daten: Jede Seite ist ein Client von [`vb-api`](https://github.com/K-O-St-V-Vindobona-II/vb-api). Die öffentliche Website ist eine eigene Anwendung, [`vb-www`](https://github.com/K-O-St-V-Vindobona-II/vb-www).

**Namenskonvention:** Der Repository-Name ist die Subdomain. `vb-intern` wird unter **`intern.vindobona2.at`** ausgeliefert (und `vb-api` unter `api.vindobona2.at`, `vb-www` unter `www.vindobona2.at`). Auf anderen Stages kommen die Domains aus der Inventory-Datei der Stage im privaten Repository `vb-access` (siehe `vb-deploy` [1.3](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md#13-die-github-organisation-und-die-repositories)).

Tech-Stack: Vue 3 (`<script setup>`, TypeScript, Composition API), Vite, Pinia, Vue Router, PrimeVue, axios; in Produktion von nginx ausgeliefert.

## 2. Container dieses Repositories

Ein Container: **`vb-intern`**, in einem eigenen Pod `vb-intern-pod`. Er hat keine Datenbank und kein Sidecar. Auf der lokalen Entwicklungs-Stage ist derselbe Name ein einfacher Container mit dem Vite-Dev-Server statt nginx.

| Container | Pod | Image | Führt Code dieses Repositories aus? |
|---|---|---|---|
| `vb-intern` | `vb-intern-pod` | `ghcr.io/k-o-st-v-vindobona-ii/vb-intern` | **Ja**, die gebaute Anwendung |

Quadlet-Definition, Port und Härtung stehen in `vb-deploy` (Kapitel [1.4](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md#14-container-und-pods)).

## 3. Was der Container tut

`vb-intern` liefert die **fertig gebauten statischen Dateien** der Anwendung mit nginx aus (das unprivilegierte Image, Port 8080 im Container, Port 21001 auf `127.0.0.1` des Hosts, erreichbar über Caddy). nginx fällt bei jedem unbekannten Pfad auf `index.html` zurück (Routing im Browser), cached `/assets/` ein Jahr lang, weil die Dateinamen einen Hash tragen, lässt Browser `index.html` bei jedem Besuch neu prüfen und speichert `config.js` nie.

Mit dem Backend spricht der Browser, nicht der Container: Die Anwendung ruft die API unter `API_BASE_URL` direkt auf (mit Credentials). Die Anmeldung läuft über ein Access-Token, das die Anwendung nur im Speicher hält, plus ein von der API gesetztes Refresh-Cookie, das im Hintergrund erneuert wird; ein Neuladen der Seite meldet dich also nicht ab. Die Content-Security-Policy, die Caddy für `intern` setzt, erlaubt genau diese API, Googles Anmelde-Skript und den Objektspeicher für Bilder.

Beim Start schreibt der Container `config.js` aus seiner Umgebung (siehe unten) und verweigert den Start, wenn ein Wert fehlt oder fehlerhaft ist. Health-Check: Die Root-URL antwortet.

## 4. Wo der Code dieses Repositories läuft

Der Code wird **einmal** gebaut, im `Dockerfile`: Eine Node-Stufe führt `npm ci` und `npm run build` aus; eine zweite Stufe kopiert das Ergebnis in `nginx-unprivileged`. Die CI veröffentlicht das Image als `ghcr.io/k-o-st-v-vindobona-ii/vb-intern:latest` und `...:<voller Commit-SHA>`. Dasselbe Image läuft auf jeder Stage: **Nichts Stage-Spezifisches wird eingebaut.** Stattdessen erzeugt ein Start-Skript (`docker/docker-entrypoint.d/40-generate-runtime-config.sh`) bei jedem Start `config.js` aus vier Umgebungsvariablen des Containers, und die Anwendung liest sie über `src/runtimeConfig.ts`:

| Variable | Pflicht | Zweck |
|---|---|---|
| `API_BASE_URL` | ja | Basis-URL des Backends, zum Beispiel `https://api.vindobona2.at/api`. |
| `PASSWORD_MIN_LENGTH` | ja | Minimale Passwortlänge, die in der Formular-Validierung angezeigt wird. |
| `APP_ENVIRONMENT` | ja | Welche Stage diese Instanz ist (`development`, `test`, `qa`, `production`). |
| `GOOGLE_CLIENT_ID` | nein | Client-ID für "Mit Google anmelden"; ohne sie wird der Button ausgeblendet. |

Die Werte landen in JavaScript, das der Browser jedes Besuchers ausführt, deshalb prüft das Skript sie: `API_BASE_URL` muss eine schlichte `http://`- oder `https://`-Adresse ohne Anführungszeichen, Backslashes, spitze Klammern, `$`, Backticks oder Leerzeichen sein; `PASSWORD_MIN_LENGTH` eine positive ganze Zahl; `APP_ENVIRONMENT` einer der vier Stage-Namen; `GOOGLE_CLIENT_ID` nur Buchstaben, Ziffern, Punkte, Unterstriche und Bindestriche. Die echten Werte je Stage liegen im privaten Repository `vb-access`; die Variablen sind in `vb-deploy` beschrieben ([Anhang A](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md#anhang-a-secrets-und-pflichtvariablen)).

Auf der **Entwicklungs-Stage** erzeugt nichts eine `config.js`: Ihre Anfrage liefert 404 (harmlos), und die Anwendung fällt auf die `VITE_*`-Variablen aus `.env` und dann auf eingebaute Standardwerte zurück.

Aufbau des Quellcodes:

```
src/views/         ein Ordner je Bereich: standesdb, archive, p4x, tracking, system, publicsite, auth, ...
src/components/    gemeinsame Bausteine
src/layouts/       AppLayout (angemeldet) und AuthLayout (Login)
src/services/      ein Modul je API-Bereich; die einzige Stelle, die die API aufruft
src/stores/        Pinia-Stores (Sitzung, Ladezustand, ...)
src/composables/   wiederverwendbare Logik ohne UI (Session-Manager, ...)
src/router/        Routen und Navigations-Wächter (Berechtigungen)
src/utils/         Formatierung und Helfer
src/types/         gemeinsame TypeScript-Typen
```

---

## Entwicklung

### Einrichtung

- Podman mit laufendem `vb-intern`-Entwicklungs-Container aus den lokalen Entwicklungs-Quadlets ([`vb-deploy` 5.7](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md#57-lokale-entwicklungsumgebung)). Er führt `npm run dev` (Vite-Dev-Server mit Hot-Reload) mit eingehängtem Quellordner aus, auf `127.0.0.1:20001`. Die API, mit der er spricht, wird über `VITE_API_BASE_URL` festgelegt.
- Node `^22.18.0` oder `>=24.12.0` (das Container-Image nutzt Node 24).
- Führe jeden Befehl über `podman exec vb-intern ...` aus; führe `npm install` nie auf dem Host aus.
- Editor: VS Code mit der offiziellen Vue-Erweiterung (Vetur deaktivieren) und den Vue.js-Devtools im Browser. Die Typprüfung nutzt `vue-tsc`, weil TypeScript allein `.vue`-Dateien nicht lesen kann.

```bash
# einmal pro Klon: die Git-Hooks installieren (sie spiegeln die CI-Prüfungen)
pre-commit install
```

Ohne die Hooks überspringen Commits ESLint, Prettier, Typprüfung und die Tests, und die CI schlägt später fehl. Die Hooks, die den Container brauchen, laufen über `podman exec`, er muss beim Commit also laufen.

### Befehle

```bash
podman exec vb-intern npm run dev            # Dev-Server (vom Container bereits gestartet)
podman exec vb-intern npm run build          # Typprüfung und Produktions-Build
podman exec vb-intern npm run type-check     # vue-tsc, streng
podman exec vb-intern npm run lint           # ESLint, keine Warnungen erlaubt
podman exec vb-intern npm run format:check   # Prettier (zum Beheben `npm run format`)
podman exec vb-intern npx vitest run         # alle Tests einmal
podman exec vb-intern npm run test:coverage  # Tests mit Coverage-Gate
```

### Tests

Vitest mit jsdom. Die Abdeckung wird für Statements, Branches, Funktionen und Zeilen gemessen, und jede muss bei **90 %** oder darüber bleiben (auch für die Stores allein); `npm run test:coverage` schlägt darunter fehl, ebenso die CI. Neue Logik kommt mit Tests; lege Logik ohne UI in ein Composable oder einen Store, damit sie sich ohne Rendern testen lässt.

### Umgebungsvariablen

Kopiere für die lokale Entwicklung `.env.example` nach `.env` und trage `VITE_APP_ENVIRONMENT`, `VITE_API_BASE_URL` und `VITE_PASSWORD_MIN_LENGTH` ein. `VITE_*`-Variablen werden ins Bundle einkompiliert und sind damit öffentlich: Lege nie ein Secret dort ab. Das Produktions-Image ignoriert sie und nutzt die vier Laufzeit-Variablen von oben. Eine Build-Zeit-Prüfung in `vite.env-check.ts` kontrolliert den Stage-Namen.

### Branching und Konventionen

- `main` ist geschützt und nimmt nur Pull Requests an. Gearbeitet wird auf `development`.
- Commit-Nachrichten folgen Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`) und sind auf Englisch geschrieben; ebenso Code-Kommentare.
- Komponenten nutzen `<script setup lang="ts">` mit typisierten `defineProps`/`defineEmits`, scoped Styles und ein Mobile-First-Layout (Basis-Styles für Handys, `min-width`-Media-Queries für größere Bildschirme).

### CI/CD

`.github/workflows/ci-cd.yml` läuft bei jedem Push auf und Pull Request gegen `main`, wöchentlich (um den CodeQL-Scan aufzufrischen) und bei manuellem Start:

1. **Lint und Format:** ESLint und Prettier.
2. **Typprüfung und Tests:** `vue-tsc` (streng) und Vitest mit den Coverage-Schwellen.
3. **CodeQL**-Sicherheitsscan.
4. **Read-only-Rootfs-Smoke-Test:** das Image, schreibgeschützt und ohne Capabilities gestartet, mit Prüfung dessen, was es ausliefert.
5. **Image bauen und veröffentlichen:** nur von `main` (Push oder manueller Start) und nur nachdem jeder andere Job bestanden hat.

Der Rollout ist nicht Teil der Pipeline: Der `podman-auto-update.timer` des Hosts holt das neue `:latest`-Image über Nacht, oder ein Betreiber deployt sofort mit `--tags deploy-intern` (siehe `vb-deploy` [1.7](https://github.com/K-O-St-V-Vindobona-II/vb-deploy/blob/main/README.de.md#17-wie-eine-änderung-in-produktion-kommt)).
