import { Globe, Activity, LucideIcon, BarChart2, Flame, ChevronDown, ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useState } from "react";
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
  badge?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { title: "Market Intelligence", url: "/market", icon: Flame, iconColor: "text-orange-400" },
      { title: "Analytics", url: "/analytics", icon: BarChart2 },
    ],
  },
  {
    label: "Events",
    collapsible: true,
    items: [
      { title: "Liverpool", url: "/liverpool", badge: "Liverpool" },
      { title: "Arsenal", url: "/arsenal", badge: "Arsenal" },
      { title: "World Cup", url: "/world-cup", icon: Globe },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Health", url: "/health", icon: Activity },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const [eventsOpen, setEventsOpen] = useState(true);

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
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupContent>
              {group.collapsible ? (
                <div>
                  <button
                    onClick={() => setEventsOpen((o) => !o)}
                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
                  >
                    <span>{group.label}</span>
                    {eventsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {eventsOpen && (
                    <SidebarMenu>
                      {group.items.map((item) => (
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
                                <item.icon className={`h-4 w-4 shrink-0 ${item.iconColor ?? ""}`} />
                              ) : null}
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )}
                </div>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group.label}</p>
                  <SidebarMenu>
                    {group.items.map((item) => (
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
                              <item.icon className={`h-4 w-4 shrink-0 ${item.iconColor ?? ""}`} />
                            ) : null}
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
