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

```
npm run dev:api
npm run dev:web
npm run build
npm run lint
npm run test:api
```

## Repository Layout

- `apps/api`: Express backend that will manage project templates, filesystem operations, and metadata.
- `apps/web`: React/Vite frontend for organizing projects and previewing files.
- `packages/shared`: Shared TypeScript interfaces for API contracts and template schemas.

## Immediate Next Steps

- Wire additional workspace endpoints (detail, filters) and template persistence flows.
- Add filesystem utilities for creating folder/file structures from templates.
- Build frontend navigation: application/team tree, project list, file preview panel.
- Introduce realtime updates via Server-Sent Events or WebSocket based on file watcher events.