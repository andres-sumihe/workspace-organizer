import { ChevronRight} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

import { LogoMark } from '@/components/layout/logo-mark';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';

export interface SidebarNavSubItem {
  key: string;
  label: string;
}

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  subItems?: SidebarNavSubItem[];
}

interface AppSidebarProps {
  items: SidebarNavItem[];
  activeKey: string;
  activeSubKey?: string;
  onNavigate: (key: string, subKey?: string) => void;
}

export const AppSidebar = ({ items, activeKey, activeSubKey, onNavigate }: AppSidebarProps) => {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex h-12 items-center gap-2 text-sm font-semibold transition-all duration-200 ease-linear group-data-[collapsible=icon]:bg-transparent ">
          <LogoMark className="h-7 w-7 shrink-0" />
          <div className="flex min-w-0 flex-col overflow-hidden transition-all duration-200 ease-linear opacity-100 max-w-48 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="truncate whitespace-nowrap text-sm font-semibold tracking-[-0.01em] text-sidebar-accent-foreground">Workspace Organizer</span>
          </div>
        </div>
        <SidebarSeparator className="mx-0" />
        {/* Search moved to the top header; remove redundant sidebar search */}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                item.subItems && item.subItems.length > 0 ? (
                  <Collapsible
                    key={item.key}
                    asChild
                    defaultOpen={item.key === activeKey}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          type="button"
                          isActive={item.key === activeKey}
                          tooltip={item.label}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-linear opacity-100 max-w-48 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">{item.label}</span>
                          <ChevronRight className="ml-auto size-4 transition-all duration-200 group-data-[state=open]/collapsible:rotate-90 max-w-4 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.key}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={item.key === activeKey && subItem.key === activeSubKey}
                                onClick={() => onNavigate(item.key, subItem.key)}
                              >
                                <button type="button" className="w-full text-left">
                                  <span>{subItem.label}</span>
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                      {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      type="button"
                      isActive={item.key === activeKey}
                      onClick={() => onNavigate(item.key)}
                      tooltip={item.label}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-linear opacity-100 max-w-48 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
