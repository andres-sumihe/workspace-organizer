---
name: shared-types-contracts
description: 'Maintain cross-app TypeScript contracts in packages/shared so API and web stay in sync. Use when adding/changing DTOs, response envelopes, enums, pagination/error types, or when fixing type drift between apps/api and apps/web.'
---

# Shared – TypeScript Contracts (`packages/shared`)

Use this skill when a type crosses the API boundary.

## When to Use This Skill

- “Add/change response DTO”, “add new shared interface”
- “Fix API/web type mismatch”, “contract drift”
- “Add pagination/error envelope types”

## Reference

- `docs/standarts/shared-types-standards.md`
- `docs/technical-overview.md` (type groups and consumers)

## Rules

- Keep shared types framework-agnostic (no Express/React types).
- Prefer `interface` for objects.
- Use union literals for string enums.
- Re-export public API from `packages/shared/src/index.ts` (avoid deep imports).

## Step-by-Step Workflow: Change a Shared Contract

1. Update/add types in `packages/shared/src/index.ts` (or a submodule re-exported through it).
2. Update API to produce the new shape.
3. Update web to consume the new shape.
4. Run:
   - `pnpm typecheck`
   - `pnpm lint`

## Versioning Guidance

- Bump the shared package version for breaking TypeScript changes (even if not published).

## Troubleshooting

- TS errors in consumers: confirm you are importing from `@workspace/shared` and not deep paths.
- Response mismatch: verify API response envelope (`{ data: ... }`) matches the shared DTO.
