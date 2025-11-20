# Workspace Organizer Desktop UI Standards

## Guiding Principles
- **Desktop-first**: Optimize layouts for viewports ≥1280px with comfortable spacing and multi-column content. Responsive behavior is optional but keep breakpoints graceful down to 1024px.
- **Information density**: Prefer card groupings and split panes to surface multiple data sources (health, workspace tree, activity feeds) simultaneously.
- **Predictable interactions**: Multi-select, keyboard shortcuts, and quick actions should be available wherever practical.
- **Composable components**: Build new UI using Tailwind CSS utilities and shadcn/ui primitives for consistency and maintainability.

## Layout Expectations
- **Application shell**:
  - Persistent left sidebar for navigation between Dashboard, File Explorer, Templates, Reports, and Settings.
  - Top utility bar with breadcrumbs, global search, and system/user status.
- **Primary canvas**:
  - Upper section: Workspace overview cards (service health, job queues, storage usage, quick actions).
  - Lower section: Switchable detail area (folder tree/table, activity timeline, favorites board).
- **Spacing**: Page content constrained to a max width of 1440px with `px-6` horizontal padding and `py-10` vertical rhythm.

## Styling Conventions
- Global styles live in `apps/web/src/styles/globals.css` and must import `tailwindcss` and `tw-animate-css`.
- Use the provided OKLCH CSS variables for color tokens. Prefer semantic Tailwind classes such as `bg-card`, `text-muted-foreground`, and `border-border`.
- Cards should use rounded corners (`rounded-xl`), subtle borders (`border border-border`), and light shadows (`shadow-sm`).
- Favor Tailwind spacing utilities (`gap-*`, `px-*`, `py-*`) over manual CSS.
- **Dark mode support**: All components must use semantic color tokens from `globals.css` that automatically adapt to light/dark themes. Avoid hard-coded color values like `bg-white`, `text-gray-800`, `bg-slate-50`. Use `bg-card`, `text-foreground`, `bg-muted` instead. When theme-specific styling is required, use Tailwind's `dark:` variant (e.g., `dark:bg-muted dark:text-foreground`).

## Component Library
- Leverage shadcn/ui components sourced through the CLI (e.g., `Button`, `Tabs`, `DataTable`, `Sheet`, `Dialog`).
- Place shared UI exports under `apps/web/src/components/ui` and helper utilities (like `cn`) under `apps/web/src/lib`.
- When adding components, ensure `components.json` stays in sync and run `npm run lint` afterward.

## Dark Mode
- **Theme Provider**: The app uses a React context-based theme provider (`ThemeProvider`) that supports three modes: `light`, `dark`, and `system` (follows OS preference).
- **Theme Toggle**: A `ModeToggle` component in the top navigation allows users to switch themes. The preference is persisted to localStorage.
- **Theme-aware Components**: Use the `useTheme()` hook from `@/components/theme-provider` when components need to respond to theme changes (e.g., CodeMirror editor).
- **CSS Variables**: All color tokens in `globals.css` have both light (`:root`) and dark (`.dark`) variants. The `ThemeProvider` automatically applies the `.dark` class to `document.documentElement`.
- **Third-party Libraries**: When integrating external libraries (Monaco, CodeMirror, charts), ensure they receive the current theme value and update when the theme changes.

## Interaction Patterns
- Support explicit refresh actions for data-driven cards (see `App.tsx` refresh button example).
- Busy states should toggle button labels (e.g., "Refreshing…") and disable interactions while pending.
- Surface errors inline inside cards using semantic colors (`text-destructive`) and muted supporting copy.

## Responsiveness & Accessibility
- Minimal responsive requirements: collapse sidebar below 1024px and ensure cards stack vertically with consistent padding.
- Maintain keyboard accessibility: use Radix primitives (`@radix-ui/react-slot`, dialogs, etc.) and ensure focus-visible rings remain (`focus-visible:ring-ring`).
- Include ARIA labels or descriptive text for non-textual controls (icon buttons, toggles).

## Implementation Checklist
- ✅ Use named exports for React components (`export function App()`), matching ESLint rules.
- ✅ Import Tailwind globals in `src/main.tsx` and register the `@` alias via `tsconfig.json` + Vite config.
- ✅ Use semantic color tokens (`bg-card`, `text-foreground`, etc.) instead of hard-coded colors to ensure dark mode compatibility.
- ✅ Test all new UI in both light and dark modes using the theme toggle in the top navigation.
- ✅ When integrating external components (code editors, charts), ensure they support theme switching via the `useTheme()` hook.
- ✅ Run `npm run lint` and resolve warnings before committing.

Refer back to this document whenever adding new screens or components to keep the UI cohesive.
