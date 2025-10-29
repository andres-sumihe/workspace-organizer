import type { LucideIcon } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface AppSidebarProps {
  items: SidebarNavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  connectionLabel?: string;
}

export const AppSidebar = ({ items, activeKey, onNavigate, connectionLabel }: AppSidebarProps) => {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex h-12 items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-sm font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">WO</div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Workspace</span>
            <span>Organizer</span>
          </div>
        </div>
        <SidebarInput placeholder="Search" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    type="button"
                    isActive={item.key === activeKey}
                    onClick={() => onNavigate(item.key)}
                    tooltip={item.label}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {connectionLabel ? (
        <>
          <SidebarSeparator className="mx-2" />
          <div className="px-3 pb-4 text-xs text-muted-foreground">{connectionLabel}</div>
        </>
      ) : null}
      <SidebarRail />
    </Sidebar>
  );
};
