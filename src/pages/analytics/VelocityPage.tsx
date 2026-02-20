import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { useAnalyticsData, type TeamTab } from "@/hooks/useAnalyticsData";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

const COLORS = [
  "hsl(142,72%,55%)", "hsl(200,80%,60%)", "hsl(32,95%,55%)",
  "hsl(280,70%,65%)", "hsl(0,75%,60%)", "hsl(60,80%,55%)",
];

export default function VelocityPage() {
  const [teamTab, setTeamTab] = useState<TeamTab>("all");
  const [days, setDays] = useState(30);
  const { sales, loading, updatedAt, refetch } = useAnalyticsData(teamTab);

  const { chartData, eventNames, overallVelocity, fastestEvent, slowestEvent } = useMemo(() => {
    const now = new Date();
    const start = startOfDay(subDays(now, days));
    const range = eachDayOfInterval({ start, end: now });

    // Get top 6 events by volume in range
    const inRange = sales.filter((s) => new Date(s.sold_at) >= start);
    const evUnits: Record<string, { name: string; units: number }> = {};
    inRange.forEach((s) => {
      const id = s.event_id ?? "";
      const name = s.events?.name ?? "Unknown";
      if (!evUnits[id]) evUnits[id] = { name, units: 0 };
      evUnits[id].units += s.quantity;
    });
    const topEvents = Object.entries(evUnits)
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 6);
    const eventNames = topEvents.map(([, v]) => v.name);
    const eventIds = topEvents.map(([id]) => id);

    // Build daily data for each event
    const byDayEv: Record<string, Record<string, number>> = {};
    range.forEach((d) => {
      const key = format(d, "dd MMM");
      byDayEv[key] = {};
      eventNames.forEach((name) => { byDayEv[key][name] = 0; });
    });

    inRange.forEach((s) => {
      const evIdx = eventIds.indexOf(s.event_id ?? "");
      if (evIdx === -1) return;
      const name = eventNames[evIdx];
      const key = format(new Date(s.sold_at), "dd MMM");
      if (byDayEv[key]) byDayEv[key][name] = (byDayEv[key][name] ?? 0) + s.quantity;
    });

    const chartData = Object.entries(byDayEv).map(([date, vals]) => ({ date, ...vals }));

    // Overall velocity
    const totalUnits = inRange.reduce((a, s) => a + s.quantity, 0);
    const overallVelocity = +(totalUnits / days).toFixed(2);

    // Fastest / slowest
    const sorted = [...topEvents].sort((a, b) => b[1].units - a[1].units);
    const fastestEvent = sorted[0] ? { name: sorted[0][1].name, velocity: +(sorted[0][1].units / days).toFixed(1) } : null;
    const slowestEvent = sorted.length > 1 ? { name: sorted[sorted.length - 1][1].name, velocity: +(sorted[sorted.length - 1][1].units / days).toFixed(1) } : null;

    return { chartData, eventNames, overallVelocity, fastestEvent, slowestEvent };
  }, [sales, days]);

  const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.filter((p: any) => p.value > 0).map((p: any, i: number) => (
          <p key={i} style={{ color: p.stroke }} className="font-semibold">{p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}: {p.value} units</p>
        ))}
      </div>
    );
  };

  const dayBtns = [7, 14, 30, 60, 90];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Velocity Tracker
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Units/day trend per event — shows momentum and demand spikes</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
            <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AnalyticsTabs active={teamTab} onChange={setTeamTab} />
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
            {dayBtns.map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === d ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">Overall Velocity</p>
                  <p className="text-2xl font-bold text-foreground">{overallVelocity}<span className="text-sm text-muted-foreground font-normal ml-1">/day</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Last {days} days</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Fastest</p>
                  {fastestEvent ? (
                    <>
                      <p className="text-lg font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fastestEvent.velocity}/day</p>
                      <p className="text-xs text-muted-foreground truncate">{fastestEvent.name}</p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Slowest</p>
                  {slowestEvent ? (
                    <>
                      <p className="text-lg font-bold" style={{ color: "hsl(0,75%,60%)" }}>{slowestEvent.velocity}/day</p>
                      <p className="text-xs text-muted-foreground truncate">{slowestEvent.name}</p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </CardContent>
              </Card>
            </div>

            {/* Main chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Units Sold — Top 6 Events</CardTitle>
                <p className="text-xs text-muted-foreground">Each line = one event · spikes show demand surges</p>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">No sales data in this time range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false}
                        interval={Math.floor(chartData.length / 6)} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Legend
                        formatter={(v) => <span style={{ fontSize: 11 }}>{v.length > 24 ? v.slice(0, 22) + "…" : v}</span>}
                        wrapperStyle={{ paddingTop: 8 }}
                      />
                      {eventNames.map((name, i) => (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Per-event velocity table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Event Velocity Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Event", "Total Units", "Units/Day", "Trend"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eventNames.map((name, i) => {
                      const dayData = chartData.map((d) => (d as any)[name] ?? 0);
                      const total = dayData.reduce((a, v) => a + v, 0);
                      const vel = +(total / days).toFixed(2);
                      const half = Math.floor(dayData.length / 2);
                      const firstHalf = dayData.slice(0, half).reduce((a, v) => a + v, 0);
                      const secondHalf = dayData.slice(half).reduce((a, v) => a + v, 0);
                      const trending = secondHalf >= firstHalf;
                      return (
                        <tr key={name} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="font-medium text-foreground">{name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">{total}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: COLORS[i % COLORS.length] }}>{vel}/day</td>
                          <td className="px-4 py-3">
                            {trending
                              ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "hsl(142,72%,55%)" }}><TrendingUp className="h-3 w-3" />Accelerating</span>
                              : <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "hsl(0,75%,60%)" }}><TrendingDown className="h-3 w-3" />Slowing</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                    {eventNames.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">No data in this time range.</td></tr>
                    )}
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
