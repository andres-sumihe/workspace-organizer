import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleThemeToggle = React.useCallback(
    (e: React.MouseEvent) => {
      const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
      const root = document.documentElement;

      // Check if View Transition API is supported
      if (!document.startViewTransition) {
        setTheme(newTheme);
        return;
      }

      // Set coordinates from the click event for circular reveal effect
      root.style.setProperty('--x', `${e.clientX}px`);
      root.style.setProperty('--y', `${e.clientY}px`);

      // Use View Transition API for smooth theme change
      document.startViewTransition(() => {
        setTheme(newTheme);
      });
    },
    [resolvedTheme, setTheme]
  );

  return (
    <Button 
      variant="outline" 
      size="icon"
      onClick={handleThemeToggle}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
