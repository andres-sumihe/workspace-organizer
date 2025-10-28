# Workspace Organizer Shared Types Standards

## Purpose
`packages/shared` centralizes TypeScript contracts reused across the stack. Keep it framework-agnostic so both the Express API (`apps/api`) and Vite web client (`apps/web`) consume identical, versioned shapes.

## Scope
- Resource metadata (workspaces, templates, projects, tokens).
- Request/response DTOs shared between API and web.
- Enumerations and utility types not tied to a specific runtime.
- **Exclude** API-only handlers, database entities, or UI-specific props—leave those in their respective packages.

## Directory Layout
```
packages/shared/
├── package.json      # workspace manifest
├── tsconfig.json     # emits declaration files for consumers
└── src/
    ├── index.ts      # single entry point exporting public types
    └── (submodules)  # optional, re-exported through index.ts
```

## Authoring Guidelines
- Export interfaces instead of types for objects (`export interface Workspace { ... }`).
- Name items in PascalCase and suffix DTOs with a descriptive noun (`ApplyTemplateRequest`, `FilePreviewResponse`).
- String enums should use union literals (e.g., `'folder' | 'file'`).
- Prefer ISO-8601 UTC strings for time fields (`createdAt`, `updatedAt`).
- Keep optional fields explicit (`?`) and document intent via comments when non-obvious.
- Reuse shared helpers like `PaginatedData`, `PaginationMeta`, `ErrorPayload`, and `JobStatus` to keep API responses consistent.
- Re-export everything through `src/index.ts`; do not rely on deep imports.

## Versioning & Consumption
- Bump the package version field whenever breaking TypeScript changes land (even if unpublished to npm).
- API routes should import from `@workspace/shared` to serialize responses that match front-end expectations.
- Front-end code should rely on these interfaces for typing hooks, API clients, and form schemas.

## Tooling & Quality Gates
- Run `npm run lint` and `npm run typecheck` after modifying shared contracts to ensure downstream packages remain healthy.
- If adding runtime validation (e.g., `zod` schemas) mirroring these types, co-locate factories in consumer code, not in `packages/shared`.

## Change Workflow
1. Update or add interfaces in `packages/shared/src/index.ts` (create submodules if the file grows too large).
2. Adjust API controllers/services to produce the new structure.
3. Update the web client to consume the revised types.
4. Run lint, typecheck, and document the change (e.g., in API/UI standards docs if relevant).

Maintain this file alongside major additions to keep expectations clear for future contributors and AI agents.
