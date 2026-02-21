import {
  Globe, Activity, LucideIcon, BarChart2, Flame, Receipt,
  ChevronDown, ChevronRight, Layers, Trophy, ShieldAlert, Zap,
} from "lucide-react";
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

const analyticsItems: NavItem[] = [
  { title: "Market Intel", url: "/market", icon: Flame, iconColor: "text-orange-400" },
  { title: "Price Heatmap", url: "/analytics/heatmap", icon: Layers },
  { title: "Top 10 Games", url: "/analytics/top-games", icon: Trophy, iconColor: "text-yellow-400" },
  { title: "Risk Monitor", url: "/analytics/risk", icon: ShieldAlert, iconColor: "text-red-400" },
  { title: "Velocity Tracker", url: "/analytics/velocity", icon: Zap, iconColor: "text-yellow-300" },
  { title: "Full Analytics", url: "/analytics", icon: BarChart2 },
];

const eventsItems: NavItem[] = [
  { title: "Liverpool", url: "/liverpool", badge: "Liverpool" },
  { title: "Arsenal", url: "/arsenal", badge: "Arsenal" },
  { title: "World Cup", url: "/world-cup", icon: Globe },
];

const salesItems: NavItem[] = [
  { title: "Sales", url: "/sales", icon: Receipt },
];

const systemItems: NavItem[] = [
  { title: "Health", url: "/health", icon: Activity },
];

function NavItemList({ items }: { items: NavItem[] }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              activeClassName="bg-sidebar-accent text-primary font-semibold"
            >
              {item.badge ? (
                <TeamBadge name={item.badge} size={18} />
              ) : item.icon ? (
                <item.icon className={`h-4 w-4 shrink-0 ${item.iconColor ?? "text-muted-foreground"}`} />
              ) : null}
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function CollapsibleSection({
  label,
  items,
  defaultOpen = true,
}: {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}) {
  const location = useLocation();
  const isActive = items.some((i) => location.pathname.startsWith(i.url) && i.url !== "/");
  const [open, setOpen] = useState(defaultOpen || isActive);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && <NavItemList items={items} />}
    </div>
  );
}

export function AppSidebar() {
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

      <SidebarContent className="px-2 py-3 space-y-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <CollapsibleSection label="Analytics" items={analyticsItems} defaultOpen={true} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <p className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sales</p>
            <NavItemList items={salesItems} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <CollapsibleSection label="Events" items={eventsItems} defaultOpen={true} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <p className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System</p>
            <NavItemList items={systemItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
