import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay } from "date-fns";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowLeft, Zap,
  Trophy, DollarSign, Flame, AlertTriangle,
} from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

interface RawSale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  event_id: string | null;
  events: { id: string; name: string; event_date: string | null } | null;
}

interface EventStats {
  id: string;
  name: string;
  event_date: string | null;
  units_7d: number;
  units_prev7d: number;
  revenue_total: number;
  avg_price: number;
  avg_price_7d: number;
  avg_price_prev7d: number;
  sales_7d: number;
  sales_prev7d: number;
  all_sales: RawSale[];
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function KpiCard({
  label, value, sub, trend, icon: Icon, loading,
}: {
  label: string; value: string; sub?: string; trend?: number; icon: React.ElementType; loading: boolean;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        {loading ? (
          <><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-8 w-24 mb-1" /><Skeleton className="h-3 w-16" /></>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">{label}</p>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {(sub || trend !== undefined) && (
              <div className="flex items-center gap-1 mt-1">
                {trend !== undefined && (
                  trend > 0
                    ? <TrendingUp className="h-3 w-3" style={{ color: "hsl(142,72%,55%)" }} />
                    : <TrendingDown className="h-3 w-3" style={{ color: "hsl(0,75%,60%)" }} />
                )}
                {trend !== undefined && (
                  <span className="text-xs font-semibold" style={{ color: trend > 0 ? "hsl(142,72%,55%)" : "hsl(0,75%,60%)" }}>
                    {trend > 0 ? "+" : ""}{trend.toFixed(0)}%
                  </span>
                )}
                {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EventDrilldown({ ev, onBack }: { ev: EventStats; onBack: () => void }) {
  // Build daily series
  const dailyData = useMemo(() => {
    const byDay: Record<string, { date: string; units: number; avg_price: number; listings: number }> = {};
    ev.all_sales.forEach((s) => {
      const day = format(new Date(s.sold_at), "dd MMM");
      if (!byDay[day]) byDay[day] = { date: day, units: 0, avg_price: 0, listings: 0 };
      byDay[day].units += s.quantity;
      byDay[day].avg_price += s.ticket_price * s.quantity;
      byDay[day].listings += 1;
    });
    // Calculate avg price per day
    Object.values(byDay).forEach((d) => {
      d.avg_price = d.units > 0 ? d.avg_price / d.units : 0;
    });
    return Object.values(byDay).sort((a, b) => new Date("1 " + a.date).getTime() - new Date("1 " + b.date).getTime());
  }, [ev]);

  // Velocity (cumulative units/day)
  const velocityData = useMemo(() => {
    let cumulative = 0;
    return dailyData.map((d, i) => {
      cumulative += d.units;
      return { ...d, velocity: +(cumulative / (i + 1)).toFixed(1) };
    });
  }, [dailyData]);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.name.toLowerCase().includes("price") ? fmt(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  const charts = [
    {
      title: "📊 Daily Units Sold",
      desc: "Demand curve — are sales accelerating?",
      key: "units",
      color: "hsl(142,72%,55%)",
      isCurrency: false,
    },
    {
      title: "💵 Avg Sale Price Over Time",
      desc: "Price momentum — is the market rising?",
      key: "avg_price",
      color: "hsl(32,95%,55%)",
      isCurrency: true,
    },
    {
      title: "📦 Listings (Sales Activity) Over Time",
      desc: "Supply pressure — fewer listings = compression",
      key: "listings",
      color: "hsl(200,80%,60%)",
      isCurrency: false,
    },
    {
      title: "⚡ Velocity Curve",
      desc: "Units/day trend — sales momentum",
      key: "velocity",
      color: "hsl(280,70%,65%)",
      isCurrency: false,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rankings
        </button>
        <span className="text-muted-foreground">/</span>
        <div>
          <span className="text-sm font-bold text-foreground">{ev.name}</span>
          {ev.event_date && (
            <span className="text-xs text-muted-foreground ml-2">
              {format(new Date(ev.event_date), "dd MMM yyyy")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: fmt(ev.revenue_total) },
            { label: "Avg Sale Price", value: fmt(ev.avg_price) },
            { label: "Units Sold (7d)", value: String(ev.units_7d) },
            { label: "Sales Velocity", value: ev.all_sales.length > 0 ? `${(ev.units_7d / 7).toFixed(1)}/day` : "—" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">{s.label}</p>
                <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 4 Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {charts.map((c) => (
            <Card key={c.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">{c.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {dailyData.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">No data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={c.key === "velocity" ? velocityData : dailyData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={c.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false}
                        tickFormatter={c.isCurrency ? (v) => `£${Math.round(v)}` : undefined} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={c.key}
                        name={c.key === "avg_price" ? "Avg Price" : c.key === "units" ? "Units" : c.key === "listings" ? "Listings" : "Velocity"}
                        stroke={c.color}
                        fill={`url(#grad-${c.key})`}
                        strokeWidth={2}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sale log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All Sales ({ev.all_sales.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Section", "Qty", "Price", "Platform"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ev.all_sales.map((s, i) => (
                    <tr key={s.id} className={`border-b border-border/50 hover:bg-accent/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(s.sold_at), "dd MMM yy, HH:mm")}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.section ?? "—"}</td>
                      <td className="px-4 py-2.5 font-medium">{s.quantity}</td>
                      <td className="px-4 py-2.5 font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(s.ticket_price)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.platform === "LiveFootballTickets" ? "text-green-400 bg-green-950/50 border border-green-800" : "text-blue-400 bg-blue-950/50 border border-blue-800"}`}>
                          {s.platform === "LiveFootballTickets" ? "LFT" : "TIXSTOCK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  if (rank <= 3) return <span className="text-lg">{medals[rank - 1]}</span>;
  return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
}

interface RankingCardProps {
  title: string;
  icon: React.ElementType;
  color: string;
  events: EventStats[];
  getValue: (ev: EventStats) => string;
  getSub: (ev: EventStats) => string;
  getTrend?: (ev: EventStats) => number;
  onSelect: (ev: EventStats) => void;
}

function RankingCard({ title, icon: Icon, color, events, getValue, getSub, getTrend, onSelect }: RankingCardProps) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {events.slice(0, 5).map((ev, i) => {
            const trend = getTrend ? getTrend(ev) : undefined;
            return (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors text-left"
              >
                <div className="w-8 flex items-center justify-center shrink-0">
                  <RankBadge rank={i + 1} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">{getSub(ev)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color }}>{getValue(ev)}</p>
                  {trend !== undefined && (
                    <p className="text-xs font-semibold" style={{ color: trend > 0 ? "hsl(142,72%,55%)" : "hsl(0,75%,60%)" }}>
                      {trend > 0 ? "+" : ""}{trend.toFixed(0)}%
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {events.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">No data available</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketPage() {
  const [allSales, setAllSales] = useState<RawSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<EventStats | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("id, sold_at, ticket_price, quantity, platform, section, event_id, events(id, name, event_date)")
      .order("sold_at", { ascending: false })
      .limit(2000);
    setAllSales((data ?? []) as unknown as RawSale[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = new Date();
  const start7d = startOfDay(subDays(now, 7));
  const start14d = startOfDay(subDays(now, 14));
  const start24h = subDays(now, 1);

  // Build per-event stats
  const eventStats: EventStats[] = useMemo(() => {
    const byEvent: Record<string, RawSale[]> = {};
    allSales.forEach((s) => {
      const id = s.event_id ?? "unknown";
      if (!byEvent[id]) byEvent[id] = [];
      byEvent[id].push(s);
    });

    return Object.entries(byEvent).map(([id, sales]) => {
      const first = sales[0];
      const units_7d = sales.filter((s) => new Date(s.sold_at) >= start7d).reduce((a, s) => a + s.quantity, 0);
      const units_prev7d = sales.filter((s) => { const d = new Date(s.sold_at); return d >= start14d && d < start7d; }).reduce((a, s) => a + s.quantity, 0);
      const sales_7d = sales.filter((s) => new Date(s.sold_at) >= start7d).length;
      const sales_prev7d = sales.filter((s) => { const d = new Date(s.sold_at); return d >= start14d && d < start7d; }).length;
      const revenue_total = sales.reduce((a, s) => a + s.ticket_price * s.quantity, 0);
      const total_units = sales.reduce((a, s) => a + s.quantity, 0);
      const avg_price = total_units > 0 ? revenue_total / total_units : 0;

      const sales_7d_list = sales.filter((s) => new Date(s.sold_at) >= start7d);
      const units_7d_count = sales_7d_list.reduce((a, s) => a + s.quantity, 0);
      const avg_price_7d = units_7d_count > 0 ? sales_7d_list.reduce((a, s) => a + s.ticket_price * s.quantity, 0) / units_7d_count : 0;

      const prev_list = sales.filter((s) => { const d = new Date(s.sold_at); return d >= start14d && d < start7d; });
      const units_prev_count = prev_list.reduce((a, s) => a + s.quantity, 0);
      const avg_price_prev7d = units_prev_count > 0 ? prev_list.reduce((a, s) => a + s.ticket_price * s.quantity, 0) / units_prev_count : 0;

      return {
        id,
        name: first.events?.name ?? "Unknown",
        event_date: first.events?.event_date ?? null,
        units_7d,
        units_prev7d,
        revenue_total,
        avg_price,
        avg_price_7d,
        avg_price_prev7d,
        sales_7d,
        sales_prev7d,
        all_sales: [...sales].sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()),
      };
    }).filter((e) => e.name !== "Unknown");
  }, [allSales, start7d, start14d]);

  // KPI aggregations
  const units_24h = allSales.filter((s) => new Date(s.sold_at) >= start24h).reduce((a, s) => a + s.quantity, 0);
  const units_7d_total = allSales.filter((s) => new Date(s.sold_at) >= start7d).reduce((a, s) => a + s.quantity, 0);
  const units_prev7d_total = allSales.filter((s) => { const d = new Date(s.sold_at); return d >= start14d && d < start7d; }).reduce((a, s) => a + s.quantity, 0);
  const total_units_all = allSales.reduce((a, s) => a + s.quantity, 0);
  const avg_price_all = total_units_all > 0 ? allSales.reduce((a, s) => a + s.ticket_price * s.quantity, 0) / total_units_all : 0;
  const velocity = +(units_7d_total / 7).toFixed(1);

  // Rankings
  const mostSold = [...eventStats].sort((a, b) => b.units_7d - a.units_7d);
  const highestRevenue = [...eventStats].sort((a, b) => b.revenue_total - a.revenue_total);
  const fastestGrowth = [...eventStats].filter((e) => e.units_prev7d > 0).sort((a, b) => pct(b.units_7d, b.units_prev7d) - pct(a.units_7d, a.units_prev7d));
  const declining = [...eventStats].filter((e) => e.units_prev7d > 0 && e.units_7d < e.units_prev7d).sort((a, b) => pct(a.units_7d, a.units_prev7d) - pct(b.units_7d, b.units_prev7d));

  if (selectedEvent) {
    return <EventDrilldown ev={selectedEvent} onBack={() => setSelectedEvent(null)} />;
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-400" />
            Market Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live rankings · Click any event to drill down</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-3 w-20 mb-3" /><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-3 w-16" /></CardContent></Card>
            ))
          ) : (
            <>
              <KpiCard label="Units Sold (7d)" value={String(units_7d_total)} sub="vs prev 7d" trend={pct(units_7d_total, units_prev7d_total)} icon={Trophy} loading={loading} />
              <KpiCard label="Units Sold (24h)" value={String(units_24h)} sub="last 24 hours" icon={Zap} loading={loading} />
              <KpiCard label="Avg Market Price" value={fmt(avg_price_all)} sub="all platforms" icon={DollarSign} loading={loading} />
              <KpiCard label="Sales Velocity" value={`${velocity}/day`} sub="units per day (7d)" icon={TrendingUp} loading={loading} />
            </>
          )}
        </div>

        {/* Rankings grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Most Sold */}
          <RankingCard
            title="🥇 Most Sold (Last 7 Days)"
            icon={Trophy}
            color="hsl(142,72%,55%)"
            events={mostSold}
            getValue={(ev) => `${ev.units_7d} units`}
            getSub={(ev) => ev.event_date ? format(new Date(ev.event_date), "dd MMM yyyy") : ""}
            getTrend={(ev) => pct(ev.units_7d, ev.units_prev7d)}
            onSelect={setSelectedEvent}
          />

          {/* Highest Revenue */}
          <RankingCard
            title="💰 Highest Revenue"
            icon={DollarSign}
            color="hsl(32,95%,55%)"
            events={highestRevenue}
            getValue={(ev) => fmt(ev.revenue_total)}
            getSub={(ev) => `Avg ${fmt(ev.avg_price)} · ${ev.all_sales.length} sales`}
            onSelect={setSelectedEvent}
          />

          {/* Fastest Growth */}
          <RankingCard
            title="📈 Fastest Growth"
            icon={TrendingUp}
            color="hsl(200,80%,60%)"
            events={fastestGrowth.length > 0 ? fastestGrowth : mostSold}
            getValue={(ev) => fastestGrowth.length > 0 ? `+${pct(ev.units_7d, ev.units_prev7d).toFixed(0)}%` : `${ev.units_7d} units`}
            getSub={(ev) => `${ev.units_prev7d} → ${ev.units_7d} units (7d)`}
            getTrend={(ev) => pct(ev.units_7d, ev.units_prev7d)}
            onSelect={setSelectedEvent}
          />

          {/* Declining Events */}
          <RankingCard
            title="📉 Declining Events"
            icon={AlertTriangle}
            color="hsl(0,75%,60%)"
            events={declining.length > 0 ? declining : []}
            getValue={(ev) => `${pct(ev.units_7d, ev.units_prev7d).toFixed(0)}%`}
            getSub={(ev) => `${ev.units_prev7d} → ${ev.units_7d} units · Avg ${fmt(ev.avg_price)}`}
            onSelect={setSelectedEvent}
          />
        </div>

        {/* Action signals */}
        {!loading && (
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                Action Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mostSold.slice(0, 1).map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border border-green-700/40 bg-green-950/20 text-sm text-green-200">
                  <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
                  <span><strong>Buy more:</strong> {ev.name} is the hottest right now with {ev.units_7d} units sold in 7d. Average price: {fmt(ev.avg_price)}.</span>
                </div>
              ))}
              {declining.slice(0, 1).map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-700/40 bg-red-950/20 text-sm text-red-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span><strong>Avoid / Monitor:</strong> {ev.name} is down {Math.abs(pct(ev.units_7d, ev.units_prev7d)).toFixed(0)}% vs last 7d. Sales dropping from {ev.units_prev7d} to {ev.units_7d} units.</span>
                </div>
              ))}
              {fastestGrowth.slice(0, 1).map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg border border-blue-700/40 bg-blue-950/20 text-sm text-blue-200">
                  <Flame className="h-4 w-4 shrink-0 mt-0.5" />
                  <span><strong>Monitor closely:</strong> {ev.name} is growing fast (+{pct(ev.units_7d, ev.units_prev7d).toFixed(0)}%). Price trend: {fmt(ev.avg_price_prev7d)} → {fmt(ev.avg_price_7d)}.</span>
                </div>
              ))}
              {mostSold.length === 0 && <p className="text-xs text-muted-foreground">Not enough data to generate signals yet.</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
