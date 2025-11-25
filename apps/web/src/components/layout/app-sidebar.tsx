import { Database } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

import LogoMark from '@/assets/logo-rounded.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
        <div className="flex h-12 items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-sm font-semibold group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
          <div className="shrink-0">
            <img 
              src={LogoMark} 
              alt="Workspace Organizer" 
              className="h-9 w-9 rounded-lg object-cover group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:rounded-xl" 
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs text-muted-foreground">Workspace</span>
            <span>Organizer</span>
          </div>
        </div>
        {/* Search moved to the top header; remove redundant sidebar search */}
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
          <SidebarFooter>
            <div className="w-full px-3 pb-4">
              <div className="flex items-center">
                {/* full text shown when expanded */}
                <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {connectionLabel}
                </span>

                {/* compact icon shown when sidebar is collapsed to icons */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="hidden group-data-[collapsible=icon]:inline-flex ml-auto h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-primary-foreground">
                      <Database className="size-4" />
                      <span className="sr-only">{connectionLabel}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{connectionLabel}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarFooter>
        </>
      ) : null}
      <SidebarRail />
    </Sidebar>
  );
};
