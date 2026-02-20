import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay, differenceInDays } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Download, RefreshCw, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, Zap, AlertTriangle,
} from "lucide-react";

interface RawSale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  event_id: string | null;
  events: { name: string; event_date: string | null; categories: { name: string } | null } | null;
}

interface EnrichedSale extends RawSale {
  revenue: number;
  gross_profit: number;
  margin_pct: number;
  days_to_event: number | null;
  competition: string;
  match_name: string;
}

type DateRange = "7d" | "30d" | "90d" | "all";
type SortKey = "sold_at" | "revenue" | "gross_profit" | "margin_pct" | "quantity";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;
const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const fmtFull = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const CHART_COLORS = ["hsl(142,72%,50%)", "hsl(200,80%,60%)", "hsl(32,95%,55%)", "hsl(280,70%,60%)"];

function mockCostFactor(platform: string) { return platform === "LiveFootballTickets" ? 0.62 : 0.68; }
function mockFees(platform: string, price: number) { return platform === "LiveFootballTickets" ? price * 0.035 : price * 0.045; }

function KpiCard({ label, value, sub, trend, loading }: { label: string; value: string; sub?: string; trend?: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        {loading ? (<><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-7 w-28" /></>) : (
          <>
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {(sub || trend !== undefined) && (
              <div className="flex items-center gap-1.5 mt-1">
                {trend !== undefined && (trend > 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-400" />)}
                <p className="text-xs text-muted-foreground">
                  {trend !== undefined && <span style={{ color: trend > 0 ? "hsl(142,72%,55%)" : "hsl(0,75%,60%)" }}>{trend > 0 ? "+" : ""}{trend.toFixed(0)}% </span>}
                  {sub}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InsightPanel({ sales }: { sales: EnrichedSale[] }) {
  const insights = useMemo(() => {
    if (!sales.length) return [];
    const result: { type: "good" | "warn" | "info"; text: string }[] = [];
    const byMatch: Record<string, EnrichedSale[]> = {};
    sales.forEach((s) => { if (!byMatch[s.match_name]) byMatch[s.match_name] = []; byMatch[s.match_name].push(s); });

    const [topMatch] = Object.entries(byMatch).sort((a, b) => b[1].reduce((s, x) => s + x.revenue, 0) - a[1].reduce((s, x) => s + x.revenue, 0));
    if (topMatch) {
      const rev = topMatch[1].reduce((s, x) => s + x.revenue, 0);
      const avgM = topMatch[1].reduce((s, x) => s + x.margin_pct, 0) / topMatch[1].length;
      if (avgM > 28) result.push({ type: "good", text: `${topMatch[0]} is your top earner (${fmt(rev)}) with ${fmtPct(avgM)} avg margin — consider raising prices.` });
    }

    Object.entries(byMatch).forEach(([name, s]) => {
      const avgM = s.reduce((acc, x) => acc + x.margin_pct, 0) / s.length;
      const rev = s.reduce((acc, x) => acc + x.revenue, 0);
      if (avgM < 22 && rev > 400) result.push({ type: "warn", text: `${name} has good volume (${fmt(rev)}) but low margin (${fmtPct(avgM)}). Review cost or fees.` });
    });

    const recent = sales.filter((s) => new Date(s.sold_at) >= subDays(new Date(), 7));
    const byMatchR: Record<string, number> = {};
    recent.forEach((s) => { byMatchR[s.match_name] = (byMatchR[s.match_name] ?? 0) + s.quantity; });
    const [hotMatch] = Object.entries(byMatchR).sort((a, b) => b[1] - a[1]);
    if (hotMatch && hotMatch[1] >= 3) result.push({ type: "info", text: `${hotMatch[0]} has a spike in last 7 days (${hotMatch[1]} tickets). High demand — check your listings.` });

    const upcoming = sales.filter((s) => s.days_to_event !== null && s.days_to_event >= 0 && s.days_to_event <= 14);
    if (upcoming.length > 0) {
      const names = [...new Set(upcoming.map((s) => s.match_name))].slice(0, 2).join(", ");
      result.push({ type: "warn", text: `${names} — within 14 days. Ensure fulfillment is on track.` });
    }

    const byPlat: Record<string, number> = {};
    sales.forEach((s) => { byPlat[s.platform] = (byPlat[s.platform] ?? 0) + s.gross_profit; });
    const [bestPlat] = Object.entries(byPlat).sort((a, b) => b[1] - a[1]);
    if (bestPlat) result.push({ type: "good", text: `${bestPlat[0] === "LiveFootballTickets" ? "LFT" : bestPlat[0]} is your most profitable platform (${fmt(bestPlat[1])} gross profit).` });

    return result.slice(0, 5);
  }, [sales]);

  if (!insights.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" />Actionable Insights</CardTitle></CardHeader>
      <CardContent className="space-y-2.5">
        {insights.map((ins, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${ins.type === "good" ? "border-green-700/40 bg-green-950/30 text-green-200" : ins.type === "warn" ? "border-orange-700/40 bg-orange-950/30 text-orange-200" : "border-blue-700/40 bg-blue-950/30 text-blue-200"}`}>
            {ins.type === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> : ins.type === "good" ? <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" /> : <Zap className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{ins.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {["Revenue", "Profit", "Gross Profit"].includes(p.name) ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [allSales, setAllSales] = useState<EnrichedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeMetric, setActiveMetric] = useState<"revenue" | "gross_profit" | "quantity">("revenue");
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("id, sold_at, ticket_price, quantity, platform, section, event_id, events(name, event_date, categories(name))")
      .order("sold_at", { ascending: false })
      .limit(2000);

    const raw = (data ?? []) as unknown as RawSale[];
    const enriched: EnrichedSale[] = raw.map((s) => {
      const rev = s.ticket_price * s.quantity;
      const cost = s.ticket_price * mockCostFactor(s.platform) * s.quantity;
      const fees = mockFees(s.platform, s.ticket_price) * s.quantity;
      const profit = rev - cost - fees;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      const eventDate = s.events?.event_date ? new Date(s.events.event_date) : null;
      const daysToEvent = eventDate ? differenceInDays(eventDate, new Date(s.sold_at)) : null;
      return { ...s, revenue: rev, gross_profit: profit, margin_pct: margin, days_to_event: daysToEvent, competition: s.events?.categories?.name ?? "Other", match_name: s.events?.name ?? "Unknown" };
    });
    setAllSales(enriched);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cutoffDate = useMemo(() => {
    if (dateRange === "all") return null;
    return startOfDay(subDays(new Date(), dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90));
  }, [dateRange]);

  const filtered = useMemo(() => {
    let r = [...allSales];
    if (cutoffDate) r = r.filter((s) => new Date(s.sold_at) >= cutoffDate);
    if (platformFilter !== "all") r = r.filter((s) => s.platform === platformFilter);
    if (matchFilter !== "all") r = r.filter((s) => s.match_name === matchFilter);
    if (search) { const q = search.toLowerCase(); r = r.filter((s) => s.match_name.toLowerCase().includes(q) || s.competition.toLowerCase().includes(q) || (s.section?.toLowerCase().includes(q) ?? false)); }
    return r;
  }, [allSales, cutoffDate, platformFilter, matchFilter, search]);

  const prevFiltered = useMemo(() => {
    if (dateRange === "all") return [];
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const start = startOfDay(subDays(new Date(), days * 2));
    return allSales.filter((s) => { const d = new Date(s.sold_at); return d >= start && d < cutoffDate! && (platformFilter === "all" || s.platform === platformFilter); });
  }, [allSales, dateRange, cutoffDate, platformFilter]);

  const trend = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  const totalRevenue = filtered.reduce((s, x) => s + x.revenue, 0);
  const totalProfit = filtered.reduce((s, x) => s + x.gross_profit, 0);
  const totalUnits = filtered.reduce((s, x) => s + x.quantity, 0);
  const avgMargin = filtered.length ? filtered.reduce((s, x) => s + x.margin_pct, 0) / filtered.length : 0;
  const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
  const dayCount = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const velocity = +(totalUnits / dayCount).toFixed(1);
  const prevRevenue = prevFiltered.reduce((s, x) => s + x.revenue, 0);
  const prevProfit = prevFiltered.reduce((s, x) => s + x.gross_profit, 0);
  const prevUnits = prevFiltered.reduce((s, x) => s + x.quantity, 0);

  const timeSeriesData = useMemo(() => {
    const byDay: Record<string, { revenue: number; gross_profit: number; quantity: number }> = {};
    filtered.forEach((s) => {
      const day = format(new Date(s.sold_at), "dd MMM");
      if (!byDay[day]) byDay[day] = { revenue: 0, gross_profit: 0, quantity: 0 };
      byDay[day].revenue += s.revenue; byDay[day].gross_profit += s.gross_profit; byDay[day].quantity += s.quantity;
    });
    return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  }, [filtered]);

  const topMatches = useMemo(() => {
    const by: Record<string, { revenue: number; gross_profit: number; quantity: number }> = {};
    filtered.forEach((s) => { if (!by[s.match_name]) by[s.match_name] = { revenue: 0, gross_profit: 0, quantity: 0 }; by[s.match_name].revenue += s.revenue; by[s.match_name].gross_profit += s.gross_profit; by[s.match_name].quantity += s.quantity; });
    return Object.entries(by).map(([name, v]) => ({ name: name.length > 24 ? name.slice(0, 24) + "…" : name, ...v })).sort((a, b) => b[activeMetric] - a[activeMetric]).slice(0, 8);
  }, [filtered, activeMetric]);

  const platformData = useMemo(() => {
    const by: Record<string, { revenue: number; gross_profit: number }> = {};
    filtered.forEach((s) => { if (!by[s.platform]) by[s.platform] = { revenue: 0, gross_profit: 0 }; by[s.platform].revenue += s.revenue; by[s.platform].gross_profit += s.gross_profit; });
    return Object.entries(by).map(([name, v]) => ({ name: name === "LiveFootballTickets" ? "LFT" : name, ...v }));
  }, [filtered]);

  const dteData = useMemo(() => {
    const b: Record<string, { margin: number; count: number; quantity: number }> = { "0–3d": { margin: 0, count: 0, quantity: 0 }, "4–7d": { margin: 0, count: 0, quantity: 0 }, "8–14d": { margin: 0, count: 0, quantity: 0 }, "15–30d": { margin: 0, count: 0, quantity: 0 }, "30d+": { margin: 0, count: 0, quantity: 0 } };
    filtered.forEach((s) => { const d = s.days_to_event; if (d === null || d < 0) return; const k = d <= 3 ? "0–3d" : d <= 7 ? "4–7d" : d <= 14 ? "8–14d" : d <= 30 ? "15–30d" : "30d+"; b[k].margin += s.margin_pct; b[k].count++; b[k].quantity += s.quantity; });
    return Object.entries(b).map(([name, v]) => ({ name, avgMargin: v.count ? +(v.margin / v.count).toFixed(1) : 0, units: v.quantity }));
  }, [filtered]);

  const sortedSales = useMemo(() => {
    const r = [...filtered];
    r.sort((a, b) => { const av = sortKey === "sold_at" ? new Date(a.sold_at).getTime() : Number(a[sortKey]); const bv = sortKey === "sold_at" ? new Date(b.sold_at).getTime() : Number(b[sortKey]); return sortDir === "asc" ? av - bv : bv - av; });
    return r;
  }, [filtered, sortKey, sortDir]);

  const paginatedSales = sortedSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sortedSales.length / PAGE_SIZE);
  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("desc"); } setPage(1); };
  const SortIcon = ({ col }: { col: SortKey }) => { if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-0.5 inline opacity-40" />; return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5 inline" /> : <ChevronDown className="h-3 w-3 ml-0.5 inline" />; };
  const allMatches = useMemo(() => [...new Set(allSales.map((s) => s.match_name))].sort(), [allSales]);

  const exportCSV = () => {
    const rows = [["Date", "Match", "Competition", "Platform", "Section", "Qty", "Price", "Revenue", "Profit", "Margin %", "DTE"],
      ...sortedSales.map((s) => [format(new Date(s.sold_at), "yyyy-MM-dd HH:mm"), s.match_name, s.competition, s.platform, s.section ?? "", s.quantity, fmtFull(s.ticket_price), fmtFull(s.revenue), fmtFull(s.gross_profit), fmtPct(s.margin_pct), s.days_to_event ?? ""])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics-export.csv"; a.click();
  };

  const btnCls = (active: boolean) => `px-3 py-1.5 rounded-md text-xs font-bold transition-colors border ${active ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`;
  const metricLabel = { revenue: "Revenue", gross_profit: "Profit", quantity: "Units" };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Updated {format(updatedAt, "HH:mm:ss")}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(["7d", "30d", "90d", "all"] as DateRange[]).map((r) => (
              <button key={r} onClick={() => { setDateRange(r); setPage(1); }} className={btnCls(dateRange === r)}>{r === "all" ? "All Time" : r.toUpperCase()}</button>
            ))}
          </div>
          <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground">
            <option value="all">All Platforms</option><option value="LiveFootballTickets">LFT</option><option value="Tixstock">Tixstock</option>
          </select>
          <select value={matchFilter} onChange={(e) => { setMatchFilter(e.target.value); setPage(1); }} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground max-w-[180px]">
            <option value="all">All Matches</option>
            {allMatches.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Revenue" value={fmt(totalRevenue)} trend={trend(totalRevenue, prevRevenue)} sub="vs prev" loading={loading} />
          <KpiCard label="Gross Profit" value={fmt(totalProfit)} trend={trend(totalProfit, prevProfit)} sub="vs prev" loading={loading} />
          <KpiCard label="Avg Margin" value={fmtPct(avgMargin)} loading={loading} />
          <KpiCard label="Units Sold" value={String(totalUnits)} trend={trend(totalUnits, prevUnits)} sub="vs prev" loading={loading} />
          <KpiCard label="Velocity" value={dateRange !== "all" ? `${velocity}/day` : "—"} sub="tickets/day" loading={loading} />
          <KpiCard label="Avg Sell Price" value={fmt(avgPrice)} loading={loading} />
        </div>

        {!loading && <InsightPanel sales={filtered} />}

        {/* Time series + Platform */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Sales Over Time</CardTitle>
                <div className="flex gap-1">{(["revenue", "gross_profit", "quantity"] as const).map((m) => <button key={m} onClick={() => setActiveMetric(m)} className={btnCls(activeMetric === m)}>{metricLabel[m]}</button>)}</div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-52 w-full" /> : timeSeriesData.length === 0 ? <p className="text-center text-muted-foreground text-sm py-16">No data for this period.</p> : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142,72%,50%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(142,72%,50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => activeMetric === "quantity" ? String(v) : `£${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey={activeMetric} name={metricLabel[activeMetric]} stroke="hsl(142,72%,50%)" fill="url(#grad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Platform Mix</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-52 w-full" /> : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={platformData} dataKey="gross_profit" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {platformData.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i] }} /><span className="text-muted-foreground">{p.name}</span></div>
                        <span className="font-semibold text-foreground">{fmt(p.gross_profit)} <span className="text-muted-foreground font-normal">profit</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Matches + Days to Event */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-bold">Top Matches</CardTitle>
                <div className="flex gap-1">{(["revenue", "gross_profit", "quantity"] as const).map((m) => <button key={m} onClick={() => setActiveMetric(m)} className={btnCls(activeMetric === m)}>{metricLabel[m]}</button>)}</div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topMatches} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => activeMetric === "quantity" ? String(v) : `£${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={115} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey={activeMetric} name={metricLabel[activeMetric]} fill="hsl(142,72%,50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Margin vs Days to Event</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dteData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="avgMargin" name="Avg Margin %" fill="hsl(32,95%,55%)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="units" name="Units Sold" fill="hsl(200,80%,55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sales Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold">Sales Detail <span className="text-muted-foreground font-normal text-xs">({filtered.length} records)</span></CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs w-48" />
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8 text-xs"><Download className="h-3.5 w-3.5" />CSV</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {([
                      { label: "#" }, { label: "Date", key: "sold_at" as SortKey }, { label: "Match" }, { label: "Competition" }, { label: "Platform" }, { label: "Section" },
                      { label: "Qty", key: "quantity" as SortKey }, { label: "Price" }, { label: "Revenue", key: "revenue" as SortKey },
                      { label: "Profit", key: "gross_profit" as SortKey }, { label: "Margin", key: "margin_pct" as SortKey }, { label: "DTE" },
                    ] as { label: string; key?: SortKey }[]).map(({ label, key }) => (
                      <th key={label} onClick={key ? () => handleSort(key) : undefined}
                        className={`text-left px-3 py-3 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap ${key ? "cursor-pointer hover:text-foreground select-none" : ""}`}>
                        {label}{key && <SortIcon col={key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">{Array.from({ length: 12 }).map((_, j) => <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                  )) : paginatedSales.map((s, i) => {
                    const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                    const mc = s.margin_pct >= 30 ? "hsl(142,72%,55%)" : s.margin_pct >= 20 ? "hsl(32,95%,55%)" : "hsl(0,75%,60%)";
                    return (
                      <tr key={s.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                        <td className="px-3 py-2.5 text-muted-foreground">{rowNum}</td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{format(new Date(s.sold_at), "dd MMM HH:mm")}</td>
                        <td className="px-3 py-2.5 font-medium text-foreground max-w-[150px] truncate">{s.match_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{s.competition}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={s.platform === "LiveFootballTickets"
                            ? { background: "hsl(142,72%,15%)", color: "hsl(142,72%,55%)", border: "1px solid hsl(142,72%,30%)" }
                            : { background: "hsl(200,80%,12%)", color: "hsl(200,80%,60%)", border: "1px solid hsl(200,80%,25%)" }}>
                            {s.platform === "LiveFootballTickets" ? "LFT" : "TIXSTOCK"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{s.section ?? "—"}</td>
                        <td className="px-3 py-2.5 text-foreground">{s.quantity}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmtFull(s.ticket_price)}</td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">{fmtFull(s.revenue)}</td>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: "hsl(142,72%,55%)" }}>{fmtFull(s.gross_profit)}</td>
                        <td className="px-3 py-2.5 font-bold" style={{ color: mc }}>{fmtPct(s.margin_pct)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{s.days_to_event !== null ? `${s.days_to_event}d` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {filtered.length} records</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
