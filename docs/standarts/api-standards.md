# Workspace Organizer API Standards

## Guiding Principles
- **Single REST surface**: All Express routes mount under `/api`. Version new capabilities via `/api/v1`, `/api/v2`, etc., avoiding silent contract changes.
- **Consistent shapes**: Use camelCase JSON, wrap collections inside an object (e.g., `{ items: [...] }`), and stamp timestamps in ISO-8601 UTC (`2025-10-28T10:24:00Z`).
- **Separation of concerns**: Keep request validation, business logic, and persistence isolated in dedicated modules. Routes should stay thin.
- **Predictable errors**: Return typed error payloads with machine-friendly codes. Never expose raw stack traces.

## Project Structure Expectations
- Files live in `apps/api/src` with the following conventions:
  - `routes/` – Express routers grouped by resource (`workspaces.router.ts`, `templates.router.ts`).
  - `controllers/` – Request handlers orchestrating service calls.
  - `services/` – Domain logic manipulating data models.
  - `db/` – SQLite schema, migrations, and query builders.
  - `schemas/` – Validation contracts (recommend `zod`, but keep validators framework-agnostic).
  - `types/` – Shared TypeScript types that are API-only. When used across apps, promote to `packages/shared`.

## Routing & Versioning
- Register routers in `apps/api/src/routes/index.ts` and mount them in the root Express app under `/api/v1`.
- Keep resource paths plural (`/workspaces`, `/projects`, `/templates`).
- Support filtering via query params (`GET /api/v1/workspaces?status=active&search=Finance`).
- Use nested routes for resource membership (e.g., `/api/v1/workspaces/:workspaceId/projects`).
- Surface pagination controls with `page` and `pageSize` query parameters. Reject non-numeric or out-of-range values with `400 Bad Request`.

## Request & Response Contracts
- Validate all input at the boundary. Reject bad payloads with `400 Bad Request` and include a `details` array explaining violations.
- Response envelope examples:
  - **Success (single resource)**
    ```json
    {
      "data": {
        "id": "ws_123",
        "name": "Finance Team",
        "createdAt": "2025-10-28T07:41:00Z"
      }
    }
    ```
  - **Success (paginated collection)**
    ```json
    {
      "data": {
        "items": [/* ... */],
        "meta": {
          "total": 120,
          "page": 1,
          "pageSize": 50
        }
      }
    }
    ```
  - **Success (paginated workspaces)**
    ```json
    {
      "data": {
        "items": [
          {
            "id": "ws_123",
            "name": "Finance Ops",
            "application": "claris",
            "team": "Finance",
            "status": "healthy",
            "projectCount": 24,
            "templateCount": 6,
            "lastIndexedAt": "2025-10-27T21:15:00Z"
          }
        ],
        "meta": {
          "total": 120,
          "page": 1,
          "pageSize": 50,
          "hasNextPage": true,
          "hasPreviousPage": false
        }
      }
    }
    ```
  - **Error**
    ```json
    {
      "error": {
        "code": "WORKSPACE_NOT_FOUND",
        "message": "Workspace ws_999 does not exist.",
        "details": []
      }
    }
    ```


### Workspace Collection Endpoint

- **Route**: `GET /api/v1/workspaces`
- **Purpose**: Return a paginated list of workspace summaries backed by SQLite.
- **Query Parameters**:
  - `page` *(optional, default: 1)* – 1-indexed page number. Must be ≥ 1.
  - `pageSize` *(optional, default: 20)* – Items per page. Valid range: 1–100.
- **Responses**:
  - `200 OK` with a `WorkspaceListResponse` payload from `@workspace/shared`.
  - `400 BAD_REQUEST` when pagination parameters fail validation.
- **Notes**:
  - Controller lives at `apps/api/src/controllers/workspaces.controller.ts` and delegates to the service/repository layer.
  - Integration coverage resides in `apps/api/src/__tests__/workspaces.routes.test.ts` using Vitest + Supertest.

## Error Handling
- Map common error types:
  - `ValidationError` → `400 Bad Request`
  - `NotFoundError` → `404 Not Found`
  - `ConflictError` → `409 Conflict`
  - `UnauthorizedError` → `401 Unauthorized`
  - Anything else → `500 Internal Server Error`
- Centralize the error middleware (`apps/api/src/middleware/error-handler.ts`) to serialize the structure above.

## Persistence & Transactions
- SQLite lives under `apps/api/data/` (exclude from build output). Use migrations inside `apps/api/src/db/migrations`.
- Interact via a data access layer (e.g., `repositories/`). Encapsulate raw SQL and keep the rest of the app using typed helpers.
- Guard multi-step operations with transactions when mutating multiple tables.

## Observability & Logging
- Log structured JSON (at minimum `{ level, timestamp, event, metadata }`).
- Include `requestId` and `workspaceId` (if available) in logs for traceability.
- Expose a lightweight `/api/health` endpoint returning service status, build metadata, and database connectivity (returns `503` when SQLite is unreachable).

## Testing & Tooling
- Prefer integration-style tests using supertest against the Express app.
- Run `npm run lint` and `npm run typecheck` before committing server changes.
- Document any new endpoints in OpenAPI (`docs/openapi.yaml`) when defined. Keep descriptions synchronized with shared types.

Keep this document up to date as the API surface grows so every contributor understands the expected patterns.
