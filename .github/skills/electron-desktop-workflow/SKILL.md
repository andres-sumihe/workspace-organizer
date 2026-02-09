---
name: electron-desktop-workflow
description: 'Develop and troubleshoot the Electron desktop shell that bundles the Express API and Vite web client. Use when editing electron/main.js or preload.js, changing desktop dev/build scripts, or diagnosing release/electron-builder issues.'
---

# Desktop – Electron Workflow

Workspace Organizer ships as an Electron app that runs the API + web UI together.

## When to Use This Skill

- “Electron main process change”, “preload IPC change”
- “Dev desktop doesn’t start”, “API health check fails”
- “electron-builder/release workflow failure”

## References

- `docs/technical-overview.md` (runtime responsibilities)
- `RELEASE-BUILD-GUIDE.md` (common build pitfalls)

## Dev & Build Commands
- User usually already run the dev:desktop by VS Code task, check and read the log from there if needed, so there is no duplicate dev servers running.
- Dev desktop: `pnpm dev:desktop`
- Build all: `pnpm build`
- Typecheck: `pnpm typecheck`

## Operational Expectations

- Dev mode expects API on port 4000; production uses a private port to avoid collisions.
- Production desktop starts the API in-process and uses a health check before loading UI.
- Avoid absolute filesystem paths in app logic; resolve under the workspace/userData context.

## Step-by-Step Workflow: Change Electron Main/Preload

1. Keep changes minimal and compatible with current preload exposure.
2. If adding new functionality, prefer sending normalized events (command ids) rather than many bespoke IPC channels.
3. Validate dev desktop:
   - start `pnpm dev:desktop`
   - confirm API health and UI loads

## Release/CI Checklist (avoid common failures)

- Ensure every script referenced in root `package.json` exists and is committed.
- Don’t add broad `.gitignore` rules that ignore required build scripts.
- Run `pnpm build` locally before tagging a release.

## Troubleshooting

- Desktop shows blank UI: check API health endpoint and dev/prod base URLs.
- Release build fails on Windows: verify native modules rebuild step and that required scripts/assets exist (see Release Build Guide).
