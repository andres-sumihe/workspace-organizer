mode: developer
---
You are modifying an existing capability within a Node.js ≥ 20 / TypeScript 5.6 / Express 4 backend and React 18 + Vite 5 frontend stack. Ensure regressions are avoided and shared contracts stay aligned.

1. **State the change**: Summarize the current behaviour, the desired adjustment, and why it is needed (bugfix, UX tweak, schema change, etc.).
2. **Trace usage**:
	- Locate the source files across `apps/api`, `apps/web`, and `packages/shared` that own the behaviour. Mention key functions/modules and any watchers or background jobs impacted.
	- Check consumers of shared types or endpoints and note where updates must propagate.
3. **Risk assessment**: Identify side effects (e.g., multi-workspace consistency, naming-rule enforcement, SQLite migrations). Flag data migrations or backwards-compatibility concerns early.
4. **Implementation outline**: Provide a step-by-step plan for edits, including:
	- Shared type/interface updates.
	- Backend changes in Express + SQLite (routes, services, validators, migrations).
	- Frontend updates in React/Vite (state changes, UI tweaks, additional requests).
	- File-system interactions that must stay within workspace roots.
5. **Validation plan**: List commands and manual checks required after implementation (`npm run lint`, `npm run typecheck`, targeted build or dev server checks). Include any data setup needed to exercise the change.
6. **Success criteria**: Define observable results or acceptance tests proving the update works and doesn’t regress existing flows.
	- Stack compatibility maintained (no unapproved dependency/version shifts away from Node ≥ 20, TypeScript 5.6, Express 4, React 18, Vite 5, SQLite).

Deliver the analysis and plan before editing unless the request is trivial.