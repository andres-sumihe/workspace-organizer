---
name: api-dual-database-architecture
description: 'Work within the dual-database backend (local SQLite + shared PostgreSQL) including migrations, shared route gating, and audit/RBAC expectations. Use when adding features that touch SQLite migrations, shared-migrations, requireSharedDb, installation setup, or dual-mode (solo/shared) planning.'
---

# API – Dual-Database Architecture

Workspace Organizer uses two persistence layers:

- Local SQLite: personal/workspace data
- Shared PostgreSQL: team data (users, RBAC, audit logs, scripts, Control-M)

## When to Use This Skill

- “Add a migration”, “change DB schema”, “new table”
- “Feature should be shared/team only”
- “requireSharedDb”, “installation wizard”, “shared DB unavailable handling”
- “Audit log every change”, “RBAC permissions”
- “Dual-mode solo/shared” discussions or implementation

## Key References (repo-local)

- `docs/technical-overview.md` (DB clients, gating, installation service)
- `docs/database-schema.md`
- `docs/architecture/dual-mode-implementation-plan.md`
- `docs/architecture/dual-mode-implementation-guide.md`

## Rules of the Road

- SQLite migrations live in `apps/api/src/db/migrations/` and run on startup.
- Shared Postgres migrations live in `apps/api/src/db/shared-migrations/` and run during installation/startup when configured.
- Team features must be guarded:
  - `requireSharedDb` returns `503` with `NOT_CONFIGURED` or `SHARED_DB_UNAVAILABLE` when needed.
  - Protected endpoints must also use `authMiddleware` + RBAC (`requirePermission`).
- Shared resource mutations must be audited via the audit service (when the resource is in Postgres).

## Step-by-Step Workflow: Add a SQLite Migration

1. Create a new migration file under `apps/api/src/db/migrations/`.
2. Make it idempotent and safe for existing installs (avoid destructive changes unless explicitly planned).
3. Ensure foreign keys/indexes are included.
4. Run `pnpm dev:api` and confirm migrations apply cleanly.

## Step-by-Step Workflow: Add a Shared (Postgres) Migration

1. Add a migration file under `apps/api/src/db/shared-migrations/`.
2. Keep migration IDs strictly increasing and deterministic.
3. Update any shared feature repositories/services to use the new table/column.
4. Ensure installation flow still works:
   - `installationService.configure()` must run migrations successfully.
   - `installationService.initializeOnStartup()` must tolerate missing config and report status.

## Step-by-Step Workflow: Add a Shared-Only Feature

1. Put types into `packages/shared` if the UI consumes them.
2. Add shared migration(s) if needed.
3. Implement repository/service/controller.
4. Mount router under v1 and gate it:
   - `requireSharedDb` at router level
   - `authMiddleware` + RBAC at endpoint level
5. Add audit logging for create/update/delete.
6. Add API integration tests for:
   - 503 when not configured
   - 503 when disconnected
   - 401/403 for auth/RBAC

## Troubleshooting

- Getting `NOT_CONFIGURED`: the shared DB connection string hasn’t been stored in local settings yet.
- Getting `SHARED_DB_UNAVAILABLE`: config exists but connection is down or not initialized.
- Breaking changes: update `packages/shared` first and run `pnpm typecheck` to catch cross-app drift.

## Notes for Dual-Mode (Solo → Shared)

- Keep HTTP boundary stable (web talks to API over HTTP).
- Prefer mode-aware providers/middleware instead of duplicating routes.
- Solo should remain fully functional offline; Shared is optional.
