import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useAnalyticsData, type TeamTab } from "@/hooks/useAnalyticsData";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

type SortMetric = "revenue" | "units" | "avg_price" | "sale_count";

interface GameRow {
  id: string;
  name: string;
  event_date: string | null;
  revenue: number;
  units: number;
  avg_price: number;
  sale_count: number;
  lft_rev: number;
  tix_rev: number;
  fanpass_rev?: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TopGamesPage() {
  const [teamTab, setTeamTab] = useState<TeamTab>("all");
  const [sortMetric, setSortMetric] = useState<SortMetric>("revenue");
  const { sales, loading, updatedAt, refetch } = useAnalyticsData(teamTab);

  const games: GameRow[] = useMemo(() => {
    const byEvent: Record<string, GameRow> = {};
    sales.forEach((s) => {
      const id = s.event_id ?? "unknown";
      if (!byEvent[id]) {
        byEvent[id] = {
          id, name: s.events?.name ?? "Unknown", event_date: s.events?.event_date ?? null,
          revenue: 0, units: 0, avg_price: 0, sale_count: 0, lft_rev: 0, tix_rev: 0, fanpass_rev: 0,
        };
      }
      const rev = s.ticket_price * s.quantity;
      byEvent[id].revenue += rev;
      byEvent[id].units += s.quantity;
      byEvent[id].sale_count += 1;
      if (s.platform === "LiveFootballTickets") byEvent[id].lft_rev += rev;
      else if (s.platform === "Fanpass") byEvent[id].fanpass_rev = (byEvent[id].fanpass_rev ?? 0) + rev;
      else byEvent[id].tix_rev += rev;
    });
    return Object.values(byEvent).map((g) => ({
      ...g,
      avg_price: g.units > 0 ? g.revenue / g.units : 0,
    })).sort((a, b) => b[sortMetric] - a[sortMetric]).slice(0, 10);
  }, [sales, sortMetric]);

  const chartData = games.map((g) => ({
    name: g.name.length > 16 ? g.name.slice(0, 14) + "…" : g.name,
    LFT: Math.round(g.lft_rev),
    Tixstock: Math.round(g.tix_rev),
    Fanpass: Math.round(g.fanpass_rev ?? 0),
  }));

  const metricBtns: { id: SortMetric; label: string }[] = [
    { id: "revenue", label: "Revenue" },
    { id: "units", label: "Units Sold" },
    { id: "avg_price", label: "Avg Price" },
    { id: "sale_count", label: "# Sales" },
  ];

  const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.fill }} className="font-semibold">{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Top 10 Games
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Best performing events ranked by key metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
            <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AnalyticsTabs active={teamTab} onChange={setTeamTab} />
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
            {metricBtns.map((b) => (
              <button key={b.id} onClick={() => setSortMetric(b.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sortMetric === b.id ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <>
            {/* Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue by Platform — Top 10</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="LFT" stackId="a" fill="hsl(142,72%,40%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Tixstock" stackId="a" fill="hsl(200,80%,50%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Fanpass" stackId="a" fill="hsl(280,70%,55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Ranking table */}
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Game</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Units</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg £</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sales</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Platform Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g, i) => {
                      const lftPct = g.revenue > 0 ? (g.lft_rev / g.revenue) * 100 : 0;
                      return (
                        <tr key={g.id} className={`border-b border-border/50 hover:bg-accent/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="px-4 py-3 text-center">
                            {i < 3 ? <span className="text-base">{MEDALS[i]}</span> : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{g.name}</p>
                            {g.event_date && <p className="text-xs text-muted-foreground">{format(new Date(g.event_date), "dd MMM yyyy")}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(g.revenue)}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{g.units}</td>
                          <td className="px-4 py-3 text-right text-foreground">{fmt(g.avg_price)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{g.sale_count}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${lftPct}%`, background: "hsl(142,72%,45%)" }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{lftPct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
