import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, TrendingDown, ShieldAlert, CheckCircle2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useAnalyticsData, type TeamTab, type AnalyticsSale } from "@/hooks/useAnalyticsData";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

type RiskLevel = "high" | "medium" | "watch";

interface RiskGame {
  id: string;
  name: string;
  event_date: string | null;
  risk: RiskLevel;
  reasons: string[];
  units_7d: number;
  units_prev7d: number;
  avg_price_7d: number;
  avg_price_prev7d: number;
  revenue: number;
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles = {
    high: "bg-red-950/50 text-red-400 border border-red-800",
    medium: "bg-orange-950/50 text-orange-400 border border-orange-800",
    watch: "bg-yellow-950/50 text-yellow-400 border border-yellow-800",
  };
  const labels = { high: "🔴 High Risk", medium: "🟠 Medium Risk", watch: "🟡 Watch" };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles[level]}`}>{labels[level]}</span>;
}

export default function RiskPage() {
  const [teamTab, setTeamTab] = useState<TeamTab>("all");
  const { sales, loading, updatedAt, refetch } = useAnalyticsData(teamTab);

  const now = new Date();
  const start7d = startOfDay(subDays(now, 7));
  const start14d = startOfDay(subDays(now, 14));

  const { riskGames, safeGames } = useMemo(() => {
    const byEvent: Record<string, AnalyticsSale[]> = {};
    sales.forEach((s) => {
      const id = s.event_id ?? "unknown";
      if (!byEvent[id]) byEvent[id] = [];
      byEvent[id].push(s);
    });

    const riskGames: RiskGame[] = [];
    const safeGames: { name: string; revenue: number }[] = [];

    Object.entries(byEvent).forEach(([id, evSales]) => {
      const name = evSales[0].events?.name ?? "Unknown";
      const event_date = evSales[0].events?.event_date ?? null;
      const revenue = evSales.reduce((a, s) => a + s.ticket_price * s.quantity, 0);

      const s7d = evSales.filter((s) => new Date(s.sold_at) >= start7d);
      const sPrev = evSales.filter((s) => { const d = new Date(s.sold_at); return d >= start14d && d < start7d; });

      const units_7d = s7d.reduce((a, s) => a + s.quantity, 0);
      const units_prev7d = sPrev.reduce((a, s) => a + s.quantity, 0);
      const u7_count = s7d.reduce((a, s) => a + s.quantity, 0);
      const avg_price_7d = u7_count > 0 ? s7d.reduce((a, s) => a + s.ticket_price * s.quantity, 0) / u7_count : 0;
      const uprev_count = sPrev.reduce((a, s) => a + s.quantity, 0);
      const avg_price_prev7d = uprev_count > 0 ? sPrev.reduce((a, s) => a + s.ticket_price * s.quantity, 0) / uprev_count : 0;

      const salesDrop = units_prev7d > 0 ? pct(units_7d, units_prev7d) : 0;
      const priceDrop = avg_price_prev7d > 0 ? pct(avg_price_7d, avg_price_prev7d) : 0;

      const reasons: string[] = [];
      let riskScore = 0;

      if (salesDrop < -30 && units_prev7d > 0) { reasons.push(`Sales down ${Math.abs(salesDrop).toFixed(0)}% vs prev 7d`); riskScore += 3; }
      else if (salesDrop < -15 && units_prev7d > 0) { reasons.push(`Sales slowing (${salesDrop.toFixed(0)}%)`); riskScore += 1; }

      if (priceDrop < -10 && avg_price_prev7d > 0) { reasons.push(`Price dropping ${Math.abs(priceDrop).toFixed(0)}% (${fmt(avg_price_prev7d)} → ${fmt(avg_price_7d)})`); riskScore += 2; }

      if (units_7d === 0 && revenue > 0) { reasons.push("Zero sales in last 7 days — stalled"); riskScore += 2; }

      if (event_date) {
        const daysToEvent = Math.ceil((new Date(event_date).getTime() - now.getTime()) / 86400000);
        if (daysToEvent > 0 && daysToEvent <= 14 && units_7d < 2) {
          reasons.push(`Event in ${daysToEvent}d — very low recent sales`);
          riskScore += 3;
        }
      }

      if (riskScore >= 4) riskGames.push({ id, name, event_date, risk: "high", reasons, units_7d, units_prev7d, avg_price_7d, avg_price_prev7d, revenue });
      else if (riskScore >= 2) riskGames.push({ id, name, event_date, risk: "medium", reasons, units_7d, units_prev7d, avg_price_7d, avg_price_prev7d, revenue });
      else if (riskScore >= 1) riskGames.push({ id, name, event_date, risk: "watch", reasons, units_7d, units_prev7d, avg_price_7d, avg_price_prev7d, revenue });
      else safeGames.push({ name, revenue });
    });

    riskGames.sort((a, b) => {
      const order = { high: 0, medium: 1, watch: 2 };
      return order[a.risk] - order[b.risk];
    });

    return { riskGames, safeGames: safeGames.sort((a, b) => b.revenue - a.revenue) };
  }, [sales, start7d, start14d]);

  const highCount = riskGames.filter((g) => g.risk === "high").length;
  const medCount = riskGames.filter((g) => g.risk === "medium").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Risk Monitor
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Declining events, price drops, slow sellers · flags issues automatically</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
            <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <AnalyticsTabs active={teamTab} onChange={setTeamTab} />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "High Risk", count: highCount, color: "hsl(0,75%,55%)", bg: "hsl(0,75%,10%)", border: "hsl(0,75%,30%)" },
                { label: "Medium Risk", count: medCount, color: "hsl(32,95%,55%)", bg: "hsl(32,95%,10%)", border: "hsl(32,95%,30%)" },
                { label: "Healthy", count: safeGames.length, color: "hsl(142,72%,55%)", bg: "hsl(142,72%,8%)", border: "hsl(142,72%,25%)" },
              ].map((s) => (
                <Card key={s.label} style={{ borderColor: s.border, background: s.bg }}>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</p>
                    <p className="text-xs font-medium mt-1" style={{ color: s.color }}>{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Risk cards */}
            {riskGames.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "hsl(142,72%,55%)" }} />
                  <p className="font-semibold text-foreground">All events look healthy!</p>
                  <p className="text-xs text-muted-foreground mt-1">No risk signals detected in the current data.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {riskGames.map((g) => (
                  <Card key={g.id} className={`border ${g.risk === "high" ? "border-red-800/50" : g.risk === "medium" ? "border-orange-800/50" : "border-yellow-800/50"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <RiskBadge level={g.risk} />
                            <span className="font-semibold text-foreground truncate">{g.name}</span>
                            {g.event_date && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {format(new Date(g.event_date), "dd MMM yyyy")}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {g.reasons.map((r, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <AlertTriangle className="h-3 w-3 shrink-0 text-orange-400" />
                                <span className="text-muted-foreground">{r}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">7d units</p>
                              <p className="font-bold text-foreground flex items-center justify-end gap-1">
                                {g.units_7d}
                                {g.units_prev7d > 0 && g.units_7d < g.units_prev7d && (
                                  <TrendingDown className="h-3 w-3 text-red-400" />
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg price</p>
                              <p className="font-bold text-foreground">{g.avg_price_7d > 0 ? fmt(g.avg_price_7d) : "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Prev 7d</p>
                              <p className="font-medium text-muted-foreground">{g.units_prev7d} units</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Revenue</p>
                              <p className="font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(g.revenue)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Safe events */}
            {safeGames.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(142,72%,55%)" }} />
                    Healthy Events ({safeGames.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {safeGames.map((g) => (
                      <div key={g.name} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-green-800/40 bg-green-950/20 text-green-300">
                        {g.name} · {fmt(g.revenue)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
