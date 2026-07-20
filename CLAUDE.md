# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Методический конструктор" — a system for building and managing templates of work programs of disciplines (РПД / Рабочая Программа Дисциплины) for University "Dubna". It imports curriculum data from the university's 1C system, lets staff edit per-discipline JSON templates, routes them through an approval workflow, and exports finished documents to PDF and Word.

The repo root (`/Users/xeueyysq/dev/rpd-app`) is a single git repo (monorepo, migrated from two polyrepos in July 2026 — history preserved via `git filter-repo --to-subdirectory-filter` + merge `--allow-unrelated-histories`). It contains two projects as subdirectories, plus `.study.docs/` for loose working documents (diploma drafts, JSON dumps, CSVs — gitignored, not part of the repo). The two projects:

- **`rpd-server/`** — Express + PostgreSQL backend
- **`rpd-client-ts/`** — React + TypeScript + Vite frontend, Feature-Sliced Design

`docker-compose.yml` (in `rpd-server/`) wires both plus a `postgres:16` db for production-like runs.

Package manager is **bun** (migrated from npm in July 2026). Each project has its own `bun.lock`.

## Commands

Run commands from inside the relevant project directory (each has its own `package.json`).

### rpd-server

```bash
bun run dev            # nodemon server.js (dev, auto-reload)
bun start              # node server.js
bun run migrate        # run app/migrations/migrations.js (idempotent CREATE TABLE IF NOT EXISTS)
bun run import-api-data # run app/modules/1cExchange.js (pull curriculum data from 1C)
bun run lint           # eslint .
bun run lint:fix
```

Server listens on `PORT` (default 8000). Requires a reachable PostgreSQL — config falls back to `localhost:5432` db `Rpd` (see `config/db.js`). Env in `.env` (`DB_*`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CLIENT_URL`, `API_URL`). There is no automated test runner; `tests/1cTests.js` is a standalone script.

### rpd-client-ts

```bash
bun run dev             # vite dev server on :5173, proxies /api and /auth to VITE_API_URL (default http://localhost:8000)
bun run build           # vite build
bun run preview
bun run lint            # eslint --ext ts,tsx --max-warnings 0 (zero-warning gate)
bun run lint:fix
bun run format          # prettier --write .
bun run generate-schema # fsd-cruise src — regenerate the FSD dependency graph
```

## Architecture

### Backend (`rpd-server`)

Layered, class-based Express app. `server.js` configures CORS (explicit localhost allowlist + `CLIENT_URL`/`API_URL`), cookie parsing, `express-fileupload`, and a fingerprint middleware, then connects the PG pool **before** mounting routers.

Request flow: `app/routes/routes.js` (mounted at `/api`) and `app/routes/Auth.js` (at `/auth`) → **controllers** (`app/controllers/*`, instantiated with the shared `pool` and bound per-route) → **services** (`app/services/*`: `Token`, `Auth`, `Complects`) and **repositories** (`app/repositories/*`: `User`, `RefreshSession`) → PostgreSQL via the `pg` pool. `app/models/*` hold table/column constants and query helpers (raw SQL, not an ORM — `mongoose`/`mongodb` are in deps but PostgreSQL is the live store).

Controllers map to domains (use as a "where does this live" index): `rpdProfileTemplatesController` (profile templates), `rpdChangeableValuesController` (the editable per-discipline JSON), `rpdComplectsController` + `complectSyncController` (комплекты / complects and their sync), `templateStatusController` (the approval workflow), `teacherTemplatesController` (teacher interface), `rpd1cExchangeController` + `specProfilesController` (1C import), `usersController` + `Auth` (users/auth).

Auth: JWT access (30 min) + refresh (15 day) tokens in `services/Token.js`. `TokenService.checkAccess` is the route guard — note it is applied to **only some** routes (e.g. complects, user-protected template ops), so don't assume every `/api` endpoint is authenticated. Roles drive authorization: `anonymous | teacher | rop | admin` (rop = руководитель образовательной программы).

Schema: managed entirely by `app/migrations/migrations.js` — a single imperative script of `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` statements run in FK-dependency order (`rpd_complects` before `planned_results_sets`, etc.). To change the schema, edit this script and re-run `npm run migrate`; there is no migration framework or down-migrations.

1C integration: `app/modules/1cExchange.js` + the `normalizeDisciplineFrom1c.js` / `specProfilesMapping.js` / `specProfilesTransformer.js` / `disciplineScope.js` / `disciplineRecordType.js` modules transform raw 1C curriculum payloads into the internal profile-template JSON shape. The core editable unit is a per-discipline JSON document ("changeable values" / "profile template") stored in PG and patched via `/api/update-json-value/:id`.

#### Document generation (`app/pdf-generator/`) — high-friction area

Both PDF and Word are produced from the **same HTML**, built in `page-generator.js` from a template's JSON (cover page, approval page, content page). A `forWord` flag branches the content table for the two targets.

- **PDF** (`document-generator.js`): renders the HTML through headless **Puppeteer** (`--no-sandbox` etc.). High fidelity.
- **Word** (`word-generator.js`): converts the HTML with **`@turbodocx/html-to-docx`**, which has **significant CSS/HTML fidelity limits**. Before touching Word output, read the memory file `turbodocx-html-to-docx-quirks` — key traps: `text-align` works on `<p>`/headings/cells but **not `<div>`**; `<style>` blocks and CSS classes are ignored (inline `style=""` only); `<colgroup>`/cell widths ignored (columns split equally); merged cells emit invalid `gridSpan="0"` and broken rowspan-after-colspan, requiring a **jszip post-process** of the `.docx` XML. There is a related `vkr-formatting-checklist` memory cataloguing downstream formatting defects.

Endpoints: `GET /api/generate-pdf?id=`, `GET /api/generate-docx?id=`, and `POST /api/generate-assessment-funds-docx`.

### Frontend (`rpd-client-ts`)

**Feature-Sliced Design (FSD).** Layers, from low to high: `shared → entities → features → widgets → pages → app`. Imports may only point **downward** (a feature may use entities/shared, never another feature or a page). The `@feature-sliced/eslint-config` enforces this; `npm run generate-schema` (`fsd-cruise`) regenerates `fsd-high-level-dependencies.html`. Path aliases (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`, `@`) are defined in **both** `vite.config.ts` and `tsconfig.json` — keep them in sync.

- **`app/`** — `index.tsx` entry, `providers/` (`AppProviders`, `AuthProvider`, `CaslProvider`), `routers/` (`AppRouter`, `ProtectedRoute`, `routeConfig`), global styles.
- **`entities/`** — `auth`, `template`, `rpd-complect`.
- **`features/`** — user actions: `create-rpd-template`, `create-rpd-template-from-year`, `change-rpd-template`, `complect-sync`, `select-template-data`, `discipline-evaluations-funds`.
- **`pages/`** — `sign-in`, `manager`, `rpd-template`, `rpd-complect(s)`, `teacher-interface(-templates)`, `planned-results`, `user-management`.

Cross-cutting tech:
- **Authorization** uses **CASL** (`src/ability/CaslAbility.ts`): `buildAbilityFor(role)` maps `anonymous|teacher|rop|admin` to `can('get'|'edit', subject)` rules, consumed via `CaslProvider`/`@casl/react` to gate routes and UI. This mirrors the backend roles — keep the two role models aligned when changing permissions.
- **API** (`src/shared/api/index.ts`): two axios instances. `axiosBase` (`/api`) attaches the in-memory access token and, on 401/403, transparently calls `axiosAuth.post('/refresh')` once (`_retry` guard) and replays the request. `axiosAuth` (`/auth`, `withCredentials`) carries the refresh cookie. The access token lives in module memory (`setAccessToken`), not localStorage.
- **State**: Zustand (`src/shared/hooks/useStore.tsx`, `entities/auth/lib/useAuth.ts`) + `@tanstack/react-query` for server state. No Redux despite `react-redux` being present in deps.
- **UI**: MUI v6 + Emotion (note `jsxImportSource: "@emotion/react"` and the `@emotion/styled → @emotion/styled/base` alias), `material-react-table`, `draft-js` rich-text editor, `react-pdf`/`@react-pdf/renderer` for in-browser PDF preview.

Production build is served by nginx (`nginx.conf`, `Dockerfile`); dev uses the Vite proxy. The `develop` branch is the active integration branch (also `master`, plus feature branches like `PRI-71`).

## Working notes

- Single repo now — commit from the root. `rpd-server/` and `rpd-client-ts/` are plain subdirectories, not nested git repos.
- `.env` files with real-looking secrets exist in both projects' git history (from before the polyrepo→monorepo migration) and are currently gitignored at HEAD; the repo is private. Don't propagate secrets into new files.
- Russian is the primary language for UI text, commit messages, comments, and the domain vocabulary (РПД, комплект/complect, профиль/profile, направление/direction). Match it.
- The pre-migration polyrepos (with intact original `.git`/GitHub remotes) are preserved untouched at `/Users/xeueyysq/dev/rpd-app-polyrepo-backup/` as a fallback — safe to delete once the monorepo is confirmed working end-to-end.
