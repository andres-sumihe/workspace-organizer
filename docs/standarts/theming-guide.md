# Theming System Guide

## Overview
This application uses the **shadcn/ui theming system** with CSS variables approach. The setup follows official shadcn/ui best practices for maximum extensibility and maintainability.

## Architecture

### Configuration Stack
1. **components.json** - shadcn/ui configuration
   - `cssVariables: true` - Enables CSS variables mode
   - `baseColor: "neutral"` - Base color palette
   - `style: "new-york"` - Component style variant

2. **tailwind.config.cjs** - Tailwind CSS configuration
   - Extends theme with semantic color tokens
   - Maps CSS variables to Tailwind utilities
   - Includes border radius, animations, and container configs

3. **globals.css** - CSS variable definitions
   - Defines colors in OKLCH color space
   - Provides `:root` (light mode) values
   - Provides `.dark` (dark mode) values
   - Uses `@theme inline` to expose variables to Tailwind

4. **theme-provider.tsx** - Runtime theme management
   - React context for theme state
   - localStorage persistence
   - System preference detection
   - Dark mode class application

## Color System

### Semantic Color Tokens
The system uses semantic tokens that automatically adapt to light/dark modes:

| Token | Purpose | Usage Example |
|-------|---------|---------------|
| `background` | Main background | `bg-background` |
| `foreground` | Main text | `text-foreground` |
| `card` | Card backgrounds | `bg-card` |
| `card-foreground` | Card text | `text-card-foreground` |
| `popover` | Popover backgrounds | `bg-popover` |
| `popover-foreground` | Popover text | `text-popover-foreground` |
| `primary` | Primary actions | `bg-primary` |
| `primary-foreground` | Primary action text | `text-primary-foreground` |
| `secondary` | Secondary actions | `bg-secondary` |
| `secondary-foreground` | Secondary action text | `text-secondary-foreground` |
| `muted` | Subtle backgrounds | `bg-muted` |
| `muted-foreground` | Subtle text | `text-muted-foreground` |
| `accent` | Accent backgrounds | `bg-accent` |
| `accent-foreground` | Accent text | `text-accent-foreground` |
| `destructive` | Destructive actions | `bg-destructive` |
| `destructive-foreground` | Destructive action text | `text-destructive-foreground` |
| `border` | Border colors | `border-border` |
| `input` | Input borders | `border-input` |
| `ring` | Focus rings | `ring-ring` |

### Sidebar Tokens
| Token | Purpose | Usage Example |
|-------|---------|---------------|
| `sidebar` | Sidebar background | `bg-sidebar` |
| `sidebar-foreground` | Sidebar text | `text-sidebar-foreground` |
| `sidebar-primary` | Sidebar primary actions | `bg-sidebar-primary` |
| `sidebar-primary-foreground` | Sidebar primary text | `text-sidebar-primary-foreground` |
| `sidebar-accent` | Sidebar hover states | `bg-sidebar-accent` |
| `sidebar-accent-foreground` | Sidebar accent text | `text-sidebar-accent-foreground` |
| `sidebar-border` | Sidebar borders | `border-sidebar-border` |
| `sidebar-ring` | Sidebar focus rings | `ring-sidebar-ring` |

### Chart Tokens
| Token | Purpose | Usage Example |
|-------|---------|---------------|
| `chart-1` through `chart-5` | Data visualization colors | `bg-chart-1` |

## Adding New Colors

### Step 1: Define CSS Variables
Add to `apps/web/src/styles/globals.css`:

```css
:root {
  /* Existing variables... */
  --success: oklch(0.65 0.20 145);
  --success-foreground: oklch(0.98 0 0);
}

.dark {
  /* Existing variables... */
  --success: oklch(0.55 0.18 145);
  --success-foreground: oklch(0.98 0 0);
}

@theme inline {
  /* Existing mappings... */
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

### Step 2: Extend Tailwind Config
Add to `apps/web/tailwind.config.cjs`:

```javascript
module.exports = {
  // ...existing config
  theme: {
    extend: {
      colors: {
        // ...existing colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        }
      }
    }
  }
};
```

### Step 3: Use in Components
```tsx
// Success button example
<Button className="bg-success text-success-foreground hover:bg-success/90">
  Save Changes
</Button>

// Success alert example
<Alert className="bg-success/10 text-success border-success">
  <CheckCircle className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Operation completed successfully.</AlertDescription>
</Alert>
```

## Color Space: OKLCH

### Why OKLCH?
- **Perceptually uniform**: Equal numeric changes = equal visual changes
- **Better interpolation**: Smooth gradients without muddy middle tones
- **Wider gamut**: Access to more vibrant colors
- **Accessibility**: Easier to maintain consistent contrast ratios

### OKLCH Format
```
oklch(L C H)
  L = Lightness (0-1)
  C = Chroma (saturation, 0-0.4 typical)
  H = Hue (0-360 degrees)
```

### Converting from HSL
Use tools like:
- [OKLCH Color Picker](https://oklch.com/)
- [Color.js](https://colorjs.io/apps/convert/)
- Chrome DevTools (supports OKLCH directly)

### Example Values
```css
/* Primary colors */
--primary-light: oklch(0.205 0 0);      /* Near-black */
--primary-dark: oklch(0.985 0 0);       /* Near-white */

/* Destructive (red) */
--destructive-light: oklch(0.577 0.245 27.325);
--destructive-dark: oklch(0.396 0.141 25.723);

/* Success (green) - example */
--success: oklch(0.65 0.20 145);
```

## Border Radius System

Uses CSS custom property for consistency:

```css
:root {
  --radius: 0.625rem; /* 10px base */
}
```

Tailwind utilities:
- `rounded-lg` = `var(--radius)` (10px)
- `rounded-md` = `calc(var(--radius) - 2px)` (8px)
- `rounded-sm` = `calc(var(--radius) - 4px)` (6px)

## Best Practices

### DO ✅
- Always use semantic tokens (`bg-card`, `text-foreground`)
- Follow the background/foreground pairing pattern
- Test colors in both light and dark modes
- Use OKLCH for new color definitions
- Keep contrast ratios WCAG AA compliant (4.5:1 for text)
- Document new tokens in this guide

### DON'T ❌
- Never use hard-coded color values (`bg-white`, `text-gray-900`)
- Don't use HSL/RGB for new colors (use OKLCH)
- Avoid skipping the foreground variant
- Don't modify Tailwind's default color scale directly
- Never bypass CSS variables with inline styles

## Testing Checklist

When adding new colors:
- [ ] Light mode appearance verified
- [ ] Dark mode appearance verified
- [ ] Hover states work in both modes
- [ ] Focus rings are visible
- [ ] Text contrast meets WCAG AA
- [ ] Color works with system theme preference
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] No hard-coded fallbacks in components

## Common Patterns

### Status Colors
```css
/* Success */
--success: oklch(0.65 0.20 145);
--success-foreground: oklch(0.98 0 0);

/* Warning */
--warning: oklch(0.75 0.15 85);
--warning-foreground: oklch(0.20 0 0);

/* Info */
--info: oklch(0.60 0.18 240);
--info-foreground: oklch(0.98 0 0);
```

### Interactive States
```tsx
// Use opacity modifiers for hover/active states
<Button className="bg-primary hover:bg-primary/90 active:bg-primary/80">
  Click Me
</Button>
```

### Gradient Overlays
```tsx
<div className="bg-gradient-to-b from-background/0 to-background">
  {/* Content */}
</div>
```

## Troubleshooting

### Colors not appearing
1. Check CSS variable is defined in both `:root` and `.dark`
2. Verify `@theme inline` mapping exists
3. Ensure Tailwind config includes the color
4. Run `npm run dev:web` to rebuild

### Wrong colors in dark mode
1. Verify `.dark` selector has correct values
2. Check ThemeProvider is wrapping the app in `main.tsx`
3. Ensure `html` or `body` has `dark` class applied

### TypeScript errors
1. Run `npm run typecheck` to identify issues
2. Ensure all paths in `tailwind.config.cjs` are correct
3. Verify no circular dependencies in imports

## References

- [shadcn/ui Theming Docs](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Dark Mode Guide](https://ui.shadcn.com/docs/dark-mode/vite)
- [OKLCH Color Picker](https://oklch.com/)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
