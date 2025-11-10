# Workspace Organizer – Agent Guide

- **Monorepo layout**: Root `package.json` manages npm workspaces for `apps/api`, `apps/web`, and `packages/shared`. Always run commands from the repo root so workspace resolution works.
- **Dev workflow**: Use `npm install` once, then `npm run dev` to launch API (port 4000) and Vite web client (port 5173) via `concurrently`. Individual targets exist as `npm run dev:api` and `npm run dev:web`. Build both with `npm run build`. There is no formal test suite yet.
- **Stack versions**: Target Node.js 22 (ESM/NodeNext), TypeScript 5.9, Express 4.x, tsx 4.x for API dev, SQLite (`sqlite`/`sqlite3`) for persistence, and React 19 with Vite 7 + Tailwind CSS 4.1 on the frontend. Keep dependencies pinned unless instructed otherwise.
- **TypeScript setup**: `tsconfig.base.json` is shared. Projects compile in `NodeNext` module mode; keep imports ESM-compatible and prefer extensionless relative paths resolved by TypeScript. Shared path aliases include `@workspace/shared/*` → `packages/shared/src/*` and `@/*` inside `apps/web` for UI code.
- **Linting/formatting**: ESLint is configured via `eslint.config.mjs` (TypeScript + React overrides). Run `npm run lint`. Prettier is configured via `.prettierrc.json`; `npm run format` verifies formatting.
- **Shared contracts**: Place cross-app interfaces in `packages/shared/src`. The current file defines template, token, and project metadata shapes used by both API and web apps. Update this package first when adjusting shared types, then rebuild dependents.
- **API service (`apps/api`)**: Express 4 app (TypeScript ESM) with entry `src/index.ts`, routes prefixed under `/api`. `src/config/env.ts` centralizes environment configuration. When adding modules, export routers from `src/routes` and mount them in `apiRouter`.
- **Environment variables**: Only `PORT` is configurable for the API. Workspace metadata and SQLite location are internal to the project structure.
- **Filesystem expectations**: All future file I/O should resolve paths under the workspace root determined above. Avoid hard-coding absolute paths in business logic; inject workspace context instead.
- **Web client (`apps/web`)**: Vite 7 + React 19 + Tailwind 4.1. Entry `src/main.tsx` hydrates a named `App` component that uses shadcn/ui primitives (e.g., `Button`) and hits `/api/health`. Keep API calls centralized, respect `import.meta.env.VITE_API_URL`, and load shared UI globals from `src/styles/globals.css`.
- **UI standards**: Follow the desktop-first design guide in `docs/standarts/desktop-ui-standards.md` (shell layout, cards, Tailwind tokens, shadcn components). Update the document when major UX patterns change.
- **API standards**: Keep Express endpoints aligned with `docs/standarts/api-standards.md` (versioning, validation, error contracts, persistence layout). Update the guide as the surface expands.
- **Shared contracts**: Define cross-app interfaces under `packages/shared/src` and follow `docs/standarts/shared-types-standards.md` so API + web stay in sync.
- **Configuration files**: `apps/web/vite.config.ts` proxies `/api` to the backend during development; adjust there if backend ports change. Add non-code assets under `apps/web/public` if needed.
- **Persistence & future work**: SQLite packages (`sqlite`, `sqlite3`) are already dependencies for the API but not yet wired. When implementing storage or watchers, keep the main DB file outside of `apps/api/dist` and ensure migrations/scripts live under `apps/api/src/db` (create this folder if needed).
- **General conventions**: Prefer small modules with explicit exports, avoid default exports unless matching existing patterns, and add succinct comments only for non-obvious logic. Maintain ASCII-only files unless extending existing Unicode content.

during development, use:
#console-ninja/* for check error
#context7/* for full context of tech stack do you use
#fetch for find best practices on the internet.

NOTE: DO NOT HALUCINATE SO DON'T ADD UNNECESSARY THINGS

If anything remains unclear or new conventions emerge, document them here after implementation to keep future agents aligned. Let me know which sections need refinement. 