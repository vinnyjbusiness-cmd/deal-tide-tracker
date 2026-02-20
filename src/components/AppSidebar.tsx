import { Globe, Activity, LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { TeamBadge } from "@/components/TeamBadge";

interface NavItem {
  title: string;
  url: string;
  badge?: string; // team name for TeamBadge
  icon?: LucideIcon;
}

const navItems: NavItem[] = [
  { title: "Liverpool", url: "/liverpool", badge: "Liverpool" },
  { title: "World Cup", url: "/world-cup", icon: Globe },
  { title: "Health", url: "/health", icon: Activity },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <TeamBadge name="Liverpool" size={32} />
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-none">TicketTrack</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Sales Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="mt-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-semibold"
                    >
                      {item.badge ? (
                        <TeamBadge name={item.badge} size={20} />
                      ) : item.icon ? (
                        <item.icon className="h-4 w-4 shrink-0" />
                      ) : null}
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
