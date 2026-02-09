---
name: web-react-vite-shadcn-ui
description: 'Build desktop-first React 19 + Vite UI using Tailwind semantic tokens and shadcn/ui primitives, including theme-aware (light/dark/system) styling. Use when creating screens/cards/layout, adding shadcn components, or fixing styling/theming issues in apps/web.'
---

# Web – React + Vite + Tailwind + shadcn/ui

Use this skill when implementing UI in `apps/web`.

## When to Use This Skill

- “Add a page / card / layout”, “desktop-first shell”
- “Add shadcn component”, “update components.json”
- “Fix dark mode”, “semantic tokens”, “Tailwind styling”

## References

- `docs/standarts/desktop-ui-standards.md`
- `docs/standarts/theming-guide.md`
- `docs/proxy-config.md` (corp proxy env vars)
- `docs/technical-overview.md` (UI shell + providers)

## Hard Requirements

- Desktop-first: design for ≥1280px, graceful down to 1024px.
- Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `border-border`) instead of hard-coded colors.
- Prefer shadcn/ui primitives; do not hand-roll new components if a shadcn equivalent exists.
- New components must work in light + dark mode.

## Where Things Live

- shadcn components: `apps/web/src/components/ui/*`
- Shared UI helpers: `apps/web/src/lib/*`
- Global theme tokens: `apps/web/src/styles/globals.css`
- Theme control: `ThemeProvider` and `useTheme()`

## Step-by-Step Workflow: Add a shadcn/ui Component (with proxy)

1. Set proxy env vars (PowerShell) using `docs/proxy-config.md` values.
2. From repo root, run:
   - `pnpm shadcn@latest add <component> -y`
3. Confirm files land under `apps/web/src/components/ui`.
4. Run `pnpm lint` to catch import/style issues.

## Step-by-Step Workflow: Build a New Screen/Card

1. Start from existing layout primitives (sidebar/top nav) and follow the desktop UI standards.
2. Compose using shadcn components (Card, Tabs, Table, Dialog/Sheet, Button).
3. Add loading and error states inside the card using semantic classes (`text-destructive`, `text-muted-foreground`).
4. Validate in light + dark mode using the mode toggle.

## Troubleshooting

- UI looks wrong in dark mode: remove hard-coded `bg-white`, `text-gray-*`, etc.; use semantic tokens.
- shadcn CLI fails behind proxy: re-check `HTTP_PROXY`, `HTTPS_PROXY`, and `NODE_EXTRA_CA_CERTS` from `docs/proxy-config.md`.
- Import path issues: keep `@/*` alias patterns consistent with the existing Vite/TS config.
