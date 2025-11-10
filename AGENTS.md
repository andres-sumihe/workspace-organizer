# Repository Guidelines

## Project Structure & Module Organization
Runtime code lives in `apps`, shared libraries in `packages`. `apps/api` hosts the Express + SQLite service plus Vitest suites in `src/__tests__`. `apps/web` is the Vite-powered React client with Tailwind utilities and UI primitives. Common TypeScript contracts, schemas, and helpers belong in `packages/shared` and should be the only path used for cross-app types. Desktop bootstrapping lives in `electron`, automation scripts reside in `scripts`, and long-form references belong in `docs`.

## Build, Test & Development Commands
- `npm install` — restore workspace dependencies.
- `npm run dev` — launches API on `:4000` and web client on `:5173`.
- `npm run dev:api` / `npm run dev:web` — focus mode for one surface.
- `npm run build` — type-checks and compiles both apps for shipping/Electron.
- `npm run lint` / `npm run format` — ESLint (flat) and Prettier checks; run pre-PR.
- `npm run typecheck` — runs the three `tsc --project` targets to catch path drift.
- `npm run test:api` — executes Vitest suites in `apps/api`; add `--runInBand` when watchers misbehave.

## Coding Style & Naming Conventions
Use TypeScript everywhere with strict settings from `tsconfig.base.json`. Follow Prettier defaults (2 spaces, double quotes, trailing commas). React components, providers, and hooks use PascalCase filenames (`WorkspaceList.tsx`, `useWorkspaceFilters.ts`); utility modules and Express routes stay camelCase. Keep imports path-based via the shared tsconfig paths and avoid relative climbs beyond `../..`. Run ESLint to enforce hook rules, a11y checks, and import ordering before pushing.

## Testing Guidelines
Vitest + Supertest cover the API; place specs under `apps/api/src/__tests__` mirroring the route or service (`workspaces.routes.test.ts`). Arrange cases by behavior (happy path, validation errors, edge cases) and reuse shared payload types to prevent contract drift. Favor integration tests around filesystem and SQLite flows; mock chokidar/file IO only when the suite becomes flaky. Block merges until `npm run test:api` passes locally and capture reproducible seeds inside `apps/api/data`.

## Commit & Pull Request Guidelines
Follow Conventional Commits as seen in history (`feat(api): ...`, `fix(lint): ...`). Scope multiple surfaces explicitly (`feat(api,ui): ...`) to keep release notes readable. Each PR should include: concise summary, linked issue or task, test plan output (commands + results), and screenshots/GIFs for UI-visible changes. Keep PRs focused on a single feature or bug; split refactors into separate commits so reviewers can parse intent quickly.
