# Workspace Organizer Master Plan

## Initiative 1 – Extend Shared Contracts

### Goals
- Establish comprehensive TypeScript interfaces for upcoming features.
- Keep API and web client in sync through the `@workspace/shared` package.

### Tasks
1. **Inventory Current Contracts**
   - Review `packages/shared/src/index.ts` to catalog existing entities.
   - Identify gaps for workspace listing, template application, job status, and future domains.
2. **Add/Update Interfaces**
   - Introduce DTOs such as `WorkspaceSummary`, `WorkspaceDetail`, `WorkspaceListResponse`, `TemplateRun`, `JobStatus`.
   - Annotate complex fields with inline comments for clarity.
3. **Validate Consumers**
   - Run `npm run lint` and `npm run typecheck` at the repo root to ensure both API and web compile.
   - Resolve breaking changes or document them in commit notes.
4. **Document Contracts**
   - Update standards docs with sample payloads or additional guidance when necessary.

### Deliverables
- Updated `packages/shared/src/index.ts` with new interfaces.
- Passing lint/typecheck.
- Standards docs revised if new conventions emerge.

---

## Initiative 2 – API Foundations

**Status: Completed – paginated workspace listing, migrations, middleware, and integration tests shipped.**

### Goals
- Build a structured Express service aligned with `docs/standarts/api-standards.md`.
- Deliver the first feature slice (`GET /api/v1/workspaces`).

### Tasks
1. **Scaffold API Structure**
   - Create folders: `routes`, `controllers`, `services`, `repositories`, `schemas`, `middleware`, `db`.
   - Add `/api/v1` router aggregator.
2. **Common Middleware**
   - Implement request logging, validation pipeline, and centralized error handler.
3. **Feature Slice Implementation**
   - Create workspace service returning `WorkspaceSummary[]` (stub or repository-backed).
   - Add controller + route to serve `/api/v1/workspaces` with pagination envelope.
   - Write integration tests (supertest) verifying success/error paths.
4. **Persistence Hookup**
   - Define SQLite schema/migration for workspaces.
   - Implement repository abstraction and wire service to database.
5. **Documentation & Observability**
   - Draft OpenAPI entry for the endpoint.
   - Ensure `/api/health` reports database connectivity.

### Deliverables
- Working Express API with versioned router and health endpoint.
- Tested `GET /api/v1/workspaces` route.
- Migration scripts and repository layer for workspaces.

---

## Initiative 3 – Frontend Shell & Dashboard

### Goals
- Build the desktop-first shell and initial dashboard cards following UI standards.
- Consume the workspace API slice from Initiative 2.

### Tasks
1. **Layout Scaffolding**
   - Implement persistent sidebar, header, and content canvas respecting `desktop-ui-standards` spacing rules.
2. **API Client & State Management**
   - Create shared fetch client with error normalization; optionally integrate React Query.
3. **Dashboard Components**
   - Refine health card styling; add workspace summary card using shared types.
   - Stub activity/alerts card to pave way for future features.
4. **Interaction Polish**
   - Ensure refresh actions have loading states and toasts on error.
   - Add keyboard accessibility and focus management.
5. **Testing & Stories**
   - Add RTL tests for loading/success/error states.
   - Capture Storybook entries (optional) for key components.

### Deliverables
- Shell and dashboard in `apps/web` using shadcn components.
- API integration with live data submission.
- Passing lint/tests for new components.

---

## Initiative 4 – Persistence & Integrations

### Goals
- Establish reliable SQLite persistence for core domains.
- Provide reproducible migrations and seeds.

### Tasks
1. **Migration Tooling**
   - Add migration runner script and instructions in README.
   - Create initial migrations for workspaces/templates/jobs tables.
2. **Repository Expansion**
   - Implement repositories for templates, tokens, and jobs.
   - Add transaction helper to guard multi-table operations (e.g., template application).
3. **Integration Tests**
   - Write tests hitting SQLite (memory DB) verifying CRUD workflows.
   - Ensure cleanup between tests to avoid state leakage.
4. **Monitoring Hooks**
   - Log DB errors with structured metadata.
   - Consider basic metrics (request count, latency) for future observability.

### Deliverables
- Migration scripts, seed data, and documentation.
- Repository layer covering key entities.
- Integration tests passing.

---

## Initiative 5 – Iterative Feature Build-Out

### Goals
- Expand functionality in slices while keeping standards aligned.
- Maintain tight coupling between shared types, API, and frontend.

### Tasks
1. **Workspace Explorer**
   - API: detail endpoint, naming rule retrieval.
   - UI: tree/table view with bulk actions and validation preview.
2. **Template Management**
   - API: CRUD + token metadata endpoints.
   - UI: template library with filters, detail dialogs.
3. **Template Application**
   - API: `POST /templates/:id/apply` with job tracking.
   - UI: wizard for project creation and live progress.
4. **Job Monitoring**
   - API: job status endpoints (polling now, potential SSE later).
   - UI: job list, status badges, log drill-down.
5. **Standards Upkeep**
   - Update UI/API/shared docs after each feature set.
   - Keep README current with new scripts and environment variables.

### Deliverables
- Feature slices shipped iteratively with updated documentation.
- Consistent contracts across layers validated by lint/typecheck/tests.

---

## Execution Sequence
1. Execute Initiative 1 Tasks 1–3 to prepare shared contracts.
2. Parallelize Initiative 2 Tasks 1–3 for API base; once stable, proceed to Initiative 3.
3. Loop through Initiatives 4 and 5 as new domains come online, ensuring each slice follows the established standards.

Review progress after each initiative, adjust priorities based on feedback, and update this plan as requirements evolve.
