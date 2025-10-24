mode: developer
---
Design a verification plan for recent changes in the Workspace Organizer project (Express 4 + SQLite backend, React 18 + Vite 5 frontend, TypeScript 5.6 across the stack).

1. **Scope recap**: List the features or fixes under test, including relevant workspace IDs, templates, or filesystem operations.
2. **Automated checks**:
	- Specify the exact npm scripts to run (e.g., `npm run lint`, `npm run typecheck`, `npm run build`) and note if additional TypeScript builds (`tsc --build`) or Vite build previews are required.
	- Note any workspace-specific commands or script arguments if only part of the monorepo is affected.
3. **Manual validation**:
	- Describe steps to exercise API endpoints (HTTP verbs, payload samples, expected JSON) and verify filesystem side effects under each workspace root.
	- Outline frontend interactions in `apps/web` (navigation, form submissions, live updates) and expected UI states.
4. **Data & environment prep**: Document required environment variables, seed data, or workspace root directories needed before testing. Mention how to reset state (e.g., clearing SQLite, removing temp folders).
5. **Regression guardrails**: Call out adjacent features that could break (multi-root selection, template enforcement, naming-rule toggles) and include spot-checks for them.
6. **Exit criteria**: Define what must pass for the change to be considered verified, including log review or watcher events if relevant.
	- Confirm the change runs cleanly under the expected toolchain (Node ≥ 20 runtime, TypeScript 5.6 builds, React/Vite dev server, SQLite migrations).

Summarize findings or outstanding risks once the checks are complete.