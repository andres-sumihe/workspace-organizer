# Workspace Organizer

Monorepo scaffold for a general-purpose project file dashboard with an Express API and React frontend. 100% Vibe coding with GPT-5-Codex.

## Getting Started

```
npm install
npm run dev
```

- API server: http://localhost:4000
- Web client: http://localhost:5173

### Individual commands

```bash
# Development
npm run dev:api              # API server only
npm run dev:web              # Web client only
npm run dev:desktop          # Full desktop app (API + Web + Electron)

# Building
npm run build                # Build API + Web
npm run build:desktop        # Build desktop app for current platform
npm run build:desktop:win    # Build for Windows
npm run build:desktop:mac    # Build for macOS
npm run build:desktop:linux  # Build for Linux

# Quality checks
npm run lint                 # Lint all code
npm run typecheck            # Type check all packages
npm run test:api             # Run API tests
```

## Repository Layout

- `apps/api`: Express backend that will manage project templates, filesystem operations, and metadata.
- `apps/web`: React/Vite frontend for organizing projects and previewing files.
- `packages/shared`: Shared TypeScript interfaces for API contracts and template schemas.
- `electron`: Desktop shell with file system bridge and IPC handlers.
- `docs`: Documentation including [File Merge & Extract System](docs/file-merge-extract-system.md) for GPO bypass workflows.

## Desktop Application

This project is configured as an **Electron desktop application** with full build support for Windows, macOS, and Linux.

**Quick Start:**
```bash
npm run dev:desktop          # Run in development mode
npm run build:desktop        # Build for production
```

**Documentation:**
- [Desktop Build Guide](docs/DESKTOP-BUILD.md) - Complete build instructions
- [Build Summary](DESKTOP-BUILD-SUMMARY.md) - Configuration overview
- [Icon Integration](ICON-INTEGRATION.md) - Logo conversion & usage

**Application Icons:** ✅ Integrated across all platforms (Windows, macOS, Linux, Web)

## Immediate Next Steps

- Wire additional workspace endpoints (detail, filters) and template persistence flows.
- Add filesystem utilities for creating folder/file structures from templates.
- Build frontend navigation: application/team tree, project list, file preview panel.
- Introduce realtime updates via Server-Sent Events or WebSocket based on file watcher events.