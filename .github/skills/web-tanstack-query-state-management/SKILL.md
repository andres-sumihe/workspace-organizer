---
name: web-tanstack-query-state-management
description: 'Implement reactive, isolated server-state with TanStack Query (React Query) using centralized queryKeys and domain hooks. Use when adding a new data domain, building hooks/useQuery/useMutation, or preventing unrelated UI components from refetching.'
---

# Web – TanStack Query State Management

This repo’s TOP PRIORITY is reactive, component-isolated data fetching.

## When to Use This Skill

- “Add a hook for a new domain”, “create useQuery/useMutation hooks”
- “Fix cache invalidation”, “query keys”, “stale data”
- “Dashboard card refetches when it shouldn’t”
- “Convert useEffect fetching to React Query”

## Reference

- `docs/standarts/state-management-standards.md`

## Rules

- Query keys are centralized in `apps/web/src/lib/query-client.ts`.
- Each domain should have a single hook module (`apps/web/src/hooks/use-<domain>.ts`).
- Components “mind their own business”:
  - changing a filter in one component must NOT trigger refetches in unrelated components.

## Step-by-Step Workflow: Add a New Data Domain

1. Add `queryKeys.<domain>` in `apps/web/src/lib/query-client.ts`.
2. Add API wrapper functions in `apps/web/src/api/<domain>.ts` using `apiClient`.
3. Add hooks in `apps/web/src/hooks/use-<domain>.ts`:
   - `use<Domain>List`, `use<Domain>Detail`
   - `useCreate<Domain>`, `useUpdate<Domain>`, `useDelete<Domain>`
4. Invalidate narrowly:
   - After update, invalidate detail for that id and the relevant list key.
   - Avoid invalidating `all` unless necessary.

## Anti-Patterns (don’t do these)

- Don’t use `useEffect`+`useState` for server data.
- Don’t scatter `invalidateQueries` in random component callbacks.

## Troubleshooting

- “Everything refetches”: check that you aren’t invalidating a broad `queryKeys.<domain>.all` unnecessarily.
- “Stale UI after mutation”: add invalidation in the mutation hook `onSuccess`.
- “Hook refetches on every render”: ensure params objects are stable (serialize or pass plain records).
