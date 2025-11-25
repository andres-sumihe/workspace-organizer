# Desktop Build Guide

## Overview

Workspace Organizer is now fully configured as an Electron desktop application with production build capabilities for Windows, macOS, and Linux.

## Prerequisites

1. **Node.js** ≥ 20
2. **npm** (comes with Node.js)
3. All dependencies installed: `npm install`

## Building the Desktop App

### Quick Start

```bash
# Build for your current platform
npm run build:desktop
```

### Platform-Specific Builds

```bash
# Build for Windows (creates .exe installer and portable)
npm run build:desktop:win

# Build for macOS (creates .dmg and .zip)
npm run build:desktop:mac

# Build for Linux (creates AppImage and .deb)
npm run build:desktop:linux
```

### Development Testing (Without Packaging)

```bash
# Test the packaged app without creating installers
npm run package:desktop
```

## Build Outputs

All build artifacts are created in the `release/` directory:

- **Windows**: `Workspace Organizer Setup.exe`, `Workspace Organizer.exe` (portable)
- **macOS**: `Workspace Organizer.dmg`, `Workspace Organizer-mac.zip`
- **Linux**: `Workspace Organizer.AppImage`, `workspace-organizer_<version>_amd64.deb`

## Application Icons

⚠️ **Important**: Before building for distribution, add your application icons to `build-assets/`:

- `icon.ico` (Windows) - 256x256 multi-resolution
- `icon.icns` (macOS) - 1024x1024 icon set
- `icon.png` (Linux) - 512x512 or higher

See `build-assets/README.md` for detailed icon requirements and generation tools.

## Build Configuration

The electron-builder configuration is defined in `package.json` under the `build` key:

- **App ID**: `com.workspace.organizer`
- **Product Name**: Workspace Organizer
- **Output Directory**: `release/`
- **Build Resources**: `build-assets/`

### What Gets Packaged

- Electron shell (`electron/`)
- Built API server (`apps/api/dist/`)
- Built web client (`apps/web/dist/`)
- Shared packages (`packages/shared/dist/`)
- Library modules (`lib/`)
- Runtime data directory (`apps/api/data/`)
- Node modules and dependencies

## Development Workflow

```bash
# Start development mode (API + Web + Electron)
npm run dev:desktop

# Run tests
npm run test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Troubleshooting

### Build Fails with "Icon not found"

Add placeholder icons to `build-assets/` or temporarily remove icon references from `package.json` build config.

### SQLite Native Module Issues

electron-builder automatically rebuilds native modules like `better-sqlite3` for Electron. If issues persist:

```bash
npm rebuild better-sqlite3 --runtime=electron --target=33.2.0 --dist-url=https://electronjs.org/headers
```

### Vite Assets Not Loading

The `base: './'` configuration in `apps/web/vite.config.ts` ensures assets load correctly with Electron's `file://` protocol. Don't remove this.

## Architecture

- **Main Process**: `electron/main.js` - Window management, IPC handlers
- **Preload Script**: `electron/preload.js` - Secure context bridge for renderer
- **Renderer Process**: Vite React app loaded from `apps/web/dist/`
- **Backend Service**: Express API server embedded and launched from `apps/api/dist/`

## Publishing

For automatic updates and distribution:

1. Configure code signing certificates (platform-specific)
2. Set up update server or use services like electron-updater
3. Add publish configuration to `package.json` build section

See [electron-builder docs](https://www.electron.build/) for advanced publishing options.

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build Desktop App
on: [push]
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build:desktop
      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: release/*
```

## Next Steps

1. Add application icons to `build-assets/`
2. Run `npm run build:desktop` to create your first build
3. Test the packaged application
4. Configure code signing for production distribution
5. Set up auto-update mechanism if needed

---

**Ready to build!** Run `npm run build:desktop` when you have your icons ready.
