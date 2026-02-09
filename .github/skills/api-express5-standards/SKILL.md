---
name: api-express5-standards
description: 'Design and implement Express 5 API endpoints in apps/api with versioned routing, validation, typed response envelopes, centralized error handling, and Vitest+Supertest coverage. Use when adding or changing /api/v1 routes, controllers/services/repositories, or error middleware.'
---

# API – Express 5 Standards

Use this skill when you are implementing or modifying backend HTTP endpoints in `apps/api`.

## When to Use This Skill

- “Add a new API endpoint”, “add router”, “add controller/service”
- “Add validation / pagination”, “standardize response shape”
- “Fix error responses”, “add integration tests for routes”

## Prerequisites

- Run commands from the repo root (workspaces rely on it)
- User usually already run the dev:desktop by VS Code task, check and read the log from there if needed, so there is no duplicate dev servers running.
- Useful commands:
  - `pnpm dev:api`
  - `pnpm test:api`
  - `pnpm lint`
  - `pnpm typecheck`

## Project Conventions (must follow)

- All routes mount under `/api` and version under `/api/v1`.
- Keep routes thin: route → controller → service → repository.
- Use camelCase JSON.
- Wrap success payloads in a `data` envelope; wrap collections as `{ data: { items, meta } }`.
- Never expose raw stack traces; errors must serialize predictably.

References:
- `docs/standarts/api-standards.md`
- `docs/technical-overview.md` (API structure, shared gating)

## Step-by-Step Workflow: Add a New Endpoint

1. Decide where the contract lives
   - Cross-app DTOs go in `packages/shared/src/index.ts`.
   - API-only types stay in `apps/api/src/types`.

2. Add/extend shared types first (if they cross the boundary)
   - Prefer `interface` for object shapes.
   - Use ISO-8601 UTC strings for timestamps.

3. Add validation at the boundary
   - Validate `params`, `query`, and `body` before calling services.
   - Reject with `400` and include a machine-friendly error code plus `details` array.

4. Implement repository/service/controller
   - Repository: raw SQL + mapping DB rows → shared types.
   - Service: business logic, pagination/transactions, cross-table ops.
   - Controller: translate HTTP → service inputs and service outputs → envelopes.

5. Add the router and mount it
   - Create router in `apps/api/src/routes/v1/<resource>.ts`.
   - Register router in `apps/api/src/routes/v1/index.ts`.
   - Ensure `apps/api/src/routes/index.ts` mounts `/v1`.

6. Wire auth/RBAC when needed
   - Protected/shared features must use `authMiddleware` and `requirePermission`.
   - Shared-only routes must also be gated with `requireSharedDb`.

7. Add integration tests
   - Place tests in `apps/api/src/__tests__`.
   - Use Supertest against the Express app; cover happy path + validation errors + not found.

## Error Handling Checklist

- Use the centralized error middleware to serialize:
  - `400` validation
  - `404` not found
  - `409` conflict
  - `401` unauthorized
  - `500` unexpected
- Error payload shape must match the API standards doc (`{ error: { code, message, details } }`).

## Troubleshooting

- 404 for a new route: confirm it’s mounted under `/api/v1` in the v1 router.
- Type drift: update `packages/shared` first, then run `pnpm typecheck`.
- Failing tests due to DB state: use test env DB conventions (often `:memory:`) and clean up via DB helpers.
