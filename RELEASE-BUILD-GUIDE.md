# Release Build Guide

This document explains the fixes applied to resolve the GitHub Actions release workflow failures and provides guidelines for maintaining successful builds.

## Issue Summary

The release workflow (`.github/workflows/release.yml`) was failing with multiple errors during the electron-builder step on Windows runners.

---

## Root Causes & Fixes

### 1. Missing `ScriptActivityLog` Component

**Cause:** The file `apps/web/src/features/scripts/components/script-activity-log.tsx` was imported but never existed in the repository.

**Fix:** Created the component with proper TypeScript types matching the `AuditAction` enum (uppercase: `CREATE`, `UPDATE`, `DELETE`, etc.).

**Prevention:** 
- Always verify imports resolve before committing
- Run `npm run build` locally before pushing

---

### 2. Incorrect `.gitignore` Pattern

**Cause:** The pattern `scripts/` in `.gitignore` was ignoring ALL directories named `scripts` throughout the project, including:
- `apps/api/scripts/` (needed for API bundling)
- `apps/web/src/features/scripts/` (feature components)

**Fix:** Changed to `/scripts/` which only ignores the root-level scripts folder.

**Prevention:**
- Use leading `/` for patterns that should only match at the repository root
- Test gitignore changes with `git status` after modifications

---

### 3. Missing Build Scripts for electron-builder

**Cause:** The `package.json` referenced scripts that were gitignored and never committed:
- `scripts/afterPack.js` - Required by electron-builder's `afterPack` hook
- `scripts/validate-desktop-build.js` - Referenced in `prebuild:desktop`
- `scripts/wait-for-http.js` - Referenced in `dev:desktop`
- `scripts/convert-icon.js` - Referenced in npm scripts

**Fix:** 
1. Removed `/scripts/` from `.gitignore`
2. Created all required scripts with proper implementations

**Prevention:**
- Never add paths to `.gitignore` that contain files referenced in `package.json`
- Verify all script paths exist before pushing

---

### 4. Windows Runner Configuration

**Cause:** Earlier attempts used Linux runners with Docker/Wine for cross-compilation, which caused native module compatibility issues with `better-sqlite3`.

**Fix:** Use `windows-latest` runner with Node.js 20 for native Windows builds.

**Current Workflow Configuration:**
```yaml
runs-on: windows-latest
node-version: 20
```

---

## Pre-Release Checklist

Before creating a new release tag, verify:

- [ ] `npm run build` succeeds locally
- [ ] `npm run typecheck` passes
- [ ] All scripts referenced in `package.json` exist
- [ ] `.gitignore` doesn't exclude required files
- [ ] `build-assets/icon.ico` and `build-assets/icon.png` exist

---

## Creating a Release

1. **Update version in `package.json`**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Push changes**
   ```bash
   git push origin main
   git push origin --tags
   ```

3. **Monitor the workflow**
   - Check GitHub Actions for the "Build and Release" workflow
   - Verify all steps complete successfully

4. **Verify release assets**
   - `Workspace-Organizer-X.X.X.exe` (portable)
   - `Workspace-Organizer-Setup-X.X.X.exe` (NSIS installer)
   - `latest.yml` (for auto-updates)

---

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Release Workflow                          │
├─────────────────────────────────────────────────────────────┤
│  Trigger: Push tag matching 'v*'                            │
│  Runner: windows-latest                                      │
│  Node: 20                                                    │
├─────────────────────────────────────────────────────────────┤
│  Steps:                                                      │
│  1. Checkout code                                            │
│  2. Setup Node.js                                            │
│  3. npm install                                              │
│  4. Build shared package (@workspace/shared)                 │
│  5. Build application (API + Web)                            │
│  6. Rebuild native modules for Electron                      │
│  7. Run electron-builder --win --publish always              │
│  8. Extract and update release notes from CHANGELOG.md       │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Build fails at "Install Dependencies"
- Check if `package-lock.json` is committed (should NOT be in `.gitignore` for CI)
- Verify npm registry access

### Build fails at "Build shared package"
- Ensure `packages/shared/tsconfig.json` has `"composite": true`
- Check for TypeScript errors in shared package

### Build fails at "Rebuild native modules"
- `better-sqlite3` requires native compilation
- Node version must match Electron's Node version
- Use `@electron/rebuild` package

### Build fails at "electron-builder"
- Verify `scripts/afterPack.js` exists and exports a function
- Check `build-assets/` contains required icons
- Ensure `build` config in `package.json` is valid

---

## Files Critical for Release

```
/
├── .github/workflows/release.yml    # Workflow definition
├── package.json                      # Build config under "build" key
├── scripts/
│   ├── afterPack.js                 # Post-pack hook for electron-builder
│   ├── validate-desktop-build.js    # Pre-build validation
│   ├── wait-for-http.js             # Dev helper
│   └── convert-icon.js              # Icon generation
├── build-assets/
│   ├── icon.ico                     # Windows icon
│   ├── icon.png                     # Linux/Mac icon
│   └── icon-1024.png                # Mac high-res icon
└── electron/
    ├── main.js                      # Electron main process
    └── preload.js                   # Preload script
```

---

## Version History

| Version | Date       | Status  | Notes                                    |
|---------|------------|---------|------------------------------------------|
| v0.1.0  | 2026-01-09 | Success | First successful release after fixes     |

---

*Last updated: January 9, 2026*
