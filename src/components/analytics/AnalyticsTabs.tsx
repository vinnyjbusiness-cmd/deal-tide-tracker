import type { TeamTab } from "@/hooks/useAnalyticsData";
import { TeamBadge } from "@/components/TeamBadge";
import { Globe } from "lucide-react";

const TABS: { id: TeamTab; label: string; badge?: string; icon?: React.ElementType }[] = [
  { id: "all", label: "All Events" },
  { id: "liverpool", label: "Liverpool", badge: "Liverpool" },
  { id: "arsenal", label: "Arsenal", badge: "Arsenal" },
  { id: "world-cup", label: "World Cup", icon: Globe },
];

export function AnalyticsTabs({
  active,
  onChange,
}: {
  active: TeamTab;
  onChange: (t: TeamTab) => void;
}) {
  return (
    <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active === t.id
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.badge ? (
            <TeamBadge name={t.badge} size={16} />
          ) : t.icon ? (
            <t.icon className="h-3.5 w-3.5" />
          ) : null}
          {t.label}
        </button>
      ))}
    </div>
  );
}
