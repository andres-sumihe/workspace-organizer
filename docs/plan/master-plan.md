# Workspace Organizer Master Plan — Desktop-first (Electron) edition

This document replaces the prior, higher-level master plan with a pragmatic, Windows-first execution plan that aligns with the project goal: let users define folder/file templates and apply them to create *real* folders and files on disk, open files in their default applications, and track workspace folder contents.

TL;DR
- Runtime: Electron + React + Node (recommended for fastest integration with the existing `apps/web` renderer). Tauri is an alternative if you prefer smaller binaries and you are comfortable with Rust.
- Template format: ZIP + manifest (manifest.json inside ZIP). Tokenized files and filename placeholders supported. Templates import/exportable as zip bundles.
- Apply semantics: full transactional apply with staging, backup, atomic replace, and rollback on failure.

Decisions you approved
- Electron: keep `apps/web` as the renderer and add `electron/` (main + preload) to host native FS operations. This minimizes refactor and reuses existing UI work.
- ZIP + Manifest: portable and user-friendly format for template sharing and import/export.
- Full transactional rollback: template application must either complete fully or revert the filesystem to the pre-apply state.

Quick project adaptation summary
- Keep `apps/web` as the renderer. Add an `electron/` layer with `main.ts` and `preload.ts` that expose a small, safe IPC surface (`window.api.*`) to the renderer.
- Implement native services under `lib/` (or `apps/desktop/lib/`): `template-zip.ts`, `template-engine.ts`, `fs-executor.ts`, `watcher-service.ts`.
- Use `better-sqlite3` to keep a local metadata index (files table) and template registry; extend migrations under `apps/api` or add `db/migrations` under the desktop app if you want packaging isolated.

Guiding principles
1. Explicit user consent — user chooses workspace roots via native directory picker. No background scanning of drives without opt-in.
2. Minimal but safe renderer API — disable nodeIntegration, use contextIsolation, expose limited, validated APIs via `preload.ts`.
3. Dry-run before modify — always present a preview/diff and require user confirmation for destructive operations.
4. Atomic / transactional applies — staging + backup + atomic move/rename; rollback on error.
5. Keep templates editable on disk + registered in DB (hybrid storage). Store templates under a user templates folder and register metadata in SQLite.

High-level milestones (what, why, acceptance criteria)

1) Scaffold Electron + renderer integration — small (1–2 days)
- What: Add `electron/main.ts`, `electron/preload.ts`, dev scripts, and an electron-builder config.
- Why: Rapidly convert the web UI into a desktop app without rewriting UI code.
- Acceptance: `npm run dev:desktop` opens a desktop window that loads the dev server UI and `window.api` is available from renderer.

2) Template ZIP + manifest import/export — small (1–2 days)
- What: Implement import/export helpers (`lib/template-zip.ts`) and define `manifest.json` schema in `lib/template-format.md`.
- Why: Portable format for template sharing and developer ergonomics.
- Acceptance: App can import `.zip` and register templates; exported `.zip` re-imports successfully.

3) Template engine & dry-run — medium (3–5 days)
- What: `lib/template-engine.ts` that parses manifest, resolves tokens in filenames and file contents, and produces a dry-run plan (list of operations).
- Why: Preview and safe validation before applying templates.
- Acceptance: `dryRun(template, root, tokens)` returns full plan and detects conflicts without touching FS.

4) Transactional apply engine & backups — medium (5–9 days)
- What: `lib/fs-executor.ts` or main-process service implementing staging, backup, atomic move, and rollback.
- Why: Ensure either full success or restore to pre-apply state.
- Acceptance: Simulated failure tests restore original files; policy modes (overwrite/skip/makeCopy) work as expected.

5) Watcher & indexer — medium (4–8 days)
- What: `lib/watcher-service.ts` using `chokidar` + DB schema (files table); initial scan (`indexer`) and event-based updates.
- Why: Track real filesystem changes and reflect them in UI.
- Acceptance: Add workspace root -> initial scan populates DB; external edits are detected and UI updates after debounce.

6) Packaging, tests, CI and docs — medium (5–8 days)
- What: `electron-builder` configuration, Playwright E2E, Windows packaging CI job, README updates.
- Why: Deliverable installers and reliable automated tests for the critical flows.
- Acceptance: CI produces an installer; packaged smoke test runs (apply + open file) pass in Windows runner.

Concrete files & API surface to add (first cut)
- electron/main.ts — create BrowserWindow, register IPC handlers that call into `lib` services.
- electron/preload.ts — expose minimal, validated API via `contextBridge`:
  - `listTemplates()`
  - `importTemplateFromZip(zipPath)`
  - `dryRunApply(templateId, rootPath, tokens)`
  - `applyTemplate(templateId, rootPath, tokens, policy)`
  - `registerWorkspace(rootPath)`
  - `openPath(path)`
- lib/template-zip.ts — unzip/import and zip-export helpers.
- lib/template-engine.ts — parse manifest, token replacement, dry-run generator.
- lib/fs-executor.ts — transactional apply + backup + rollback logic.
- lib/watcher-service.ts — chokidar watcher + DB update logic.
- packages/shared/src/index.ts — extend with `TemplateManifest`, `TemplateFileEntry`, `TemplateToken` types.

Command snippets (for local setup)
- Install Electron + helper libs (examples):
```bash
npm install --save-dev electron electron-builder concurrently wait-on
npm install fs-extra chokidar better-sqlite3 extract-zip archiver mustache uuid
```
- Dev flow pattern (example):
```bash
# terminal 1: renderer dev
npm run dev --workspace @workspace/web
# terminal 2: wait for renderer and start electron
npx wait-on http://localhost:5173 && npx electron ./electron/main.ts
```

Testing strategy (rollback-focused)
- Unit tests: template parser, token replacement, filename token edge cases.
- Integration: apply engine in temp directory; simulate partial failure and assert rollback.
- E2E: Playwright runs packaged or dev app: import template, dry-run, apply, open file, simulate failure path and verify rollback.

Risk & mitigations (short)
- AV triggers on bulk writes — mitigate by showing dry-run and require explicit confirmation; optionally batch writes.
- UAC/elevation — avoid writing to protected locations by default; prompt only when necessary.
- Security in renderer — contextIsolation, no nodeIntegration, validate all IPC inputs.

Mapping to current repo
- Reuse `apps/web` as renderer (no rewrite). Add `electron/` and `lib/` at repo root. Extend `packages/shared` for template types and extend migrations (or add new migrations under a desktop-specific `db/`) for the files table.

Next concrete choices you already made
1. Electron — will implement main/preload + native services.
2. ZIP+manifest — manifest schema and zip import/export.
3. Full transactional rollback — implement staging + backup + atomic replace + restore on error.

What I will do next if you say “Yes, scaffold now”
1. Create `electron/main.ts` and `electron/preload.ts` (minimal safe API). Run typecheck and adjust `apps/web` dev flow to open in Electron in dev mode.
2. Add `lib/template-zip.ts` import helper and `packages/shared` template types.
3. Add unit tests for `dryRun` behavior.

If you want me to save this as the repo master plan, it is now written here. If you want me to begin scaffolding (create the Electron files and scripts), say “Scaffold Electron and template engine” and I will implement the changes incrementally and run the checks/tests.

---
Last updated: 2025-10-30
