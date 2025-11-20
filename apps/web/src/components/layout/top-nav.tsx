import { Bell, Menu, Search, Settings2 } from 'lucide-react';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const TopNav = () => {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
      <div className="flex items-center gap-2">
        {/* Mobile trigger (visible on small screens) */}
        <SidebarTrigger className="md:hidden" />
        <Separator orientation="vertical" className="hidden h-6 md:block" />

        {/* Desktop trigger positioned to the left of the header search */}
        <SidebarTrigger className="hidden md:inline-flex" />
        <div className="relative hidden w-64 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search anything..." />
        </div>

        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="size-4" />
        </Button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Bell className="size-4" />
              <span className="sr-only">Notifications</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings2 className="size-4" />
              <span className="sr-only">Preferences</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Preferences</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};
