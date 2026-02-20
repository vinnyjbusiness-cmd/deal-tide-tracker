import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamBadge, parseTeams } from "@/components/TeamBadge";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import {
  Download, Search, RefreshCw, ArrowLeft,
  ChevronUp, ChevronDown, ChevronsUpDown, Calendar, X,
} from "lucide-react";

type Tab = "games" | "all" | "lft" | "tixstock";
type HomeAwayFilter = "all" | "home" | "away";
type TimeRange = "all" | "today" | "7d" | "30d" | "90d" | "custom";


interface EventWithStats {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  revenue: number;
  tickets: number;
  saleCount: number;
}

interface Sale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  event_id: string | null;
  events: { name: string } | null;
}

type SortKey = "sold_at" | "ticket_price" | "quantity";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 30;
const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "LiveFootballTickets")
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(142,72%,15%)", color: "hsl(142,72%,55%)", border: "1px solid hsl(142,72%,30%)" }}>LFT</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(200,80%,12%)", color: "hsl(200,80%,60%)", border: "1px solid hsl(200,80%,25%)" }}>TIXSTOCK</span>;
}

function EventCard({ ev, onClick, homeTeam }: { ev: EventWithStats; onClick: () => void; homeTeam?: string }) {
  const [home, away] = parseTeams(ev.name);
  const slug = ev.name.toUpperCase().replace(/\s+VS\.?\s+/i, "-VS-").replace(/\s/g, "-").slice(0, 22);

  // Determine home/away for club pages
  const isHome = homeTeam
    ? home.toLowerCase().includes(homeTeam.toLowerCase())
    : null;

  // Card highlight styles
  const cardStyle = isHome === true
    ? { borderColor: "hsl(32,95%,50%)", boxShadow: "0 0 0 1px hsl(32,95%,50%), inset 0 0 40px hsl(32,95%,50%,0.08)" }
    : isHome === false
    ? { borderColor: "hsl(220,85%,55%)", boxShadow: "0 0 0 1px hsl(220,85%,55%), inset 0 0 40px hsl(220,85%,55%,0.08)" }
    : {};

  const cardBg = isHome === true
    ? "bg-orange-950/30"
    : isHome === false
    ? "bg-blue-950/30"
    : "";

  return (
    <Card
      onClick={onClick}
      style={cardStyle}
      className={`cursor-pointer transition-all hover:shadow-lg group border ${cardBg} ${
        isHome === true
          ? "hover:border-orange-400/80"
          : isHome === false
          ? "hover:border-blue-400/80"
          : "hover:border-primary/50 hover:shadow-primary/5"
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider px-2 py-0.5 rounded bg-secondary">
              {slug}
            </span>
            {isHome === true && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "hsl(32,95%,15%)", color: "hsl(32,95%,60%)", border: "1px solid hsl(32,95%,35%)" }}>
                HOME
              </span>
            )}
            {isHome === false && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "hsl(220,85%,15%)", color: "hsl(220,85%,65%)", border: "1px solid hsl(220,85%,35%)" }}>
                AWAY
              </span>
            )}
          </div>
          {ev.revenue > 0 && (
            <span className="text-[12px] font-bold" style={{ color: "hsl(142,72%,55%)" }}>
              +{fmt(ev.revenue)}
            </span>
          )}
        </div>

        {/* Team Badges */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex flex-col items-center gap-1">
            <TeamBadge name={home} size={40} />
            <span className="text-[9px] text-muted-foreground font-semibold">HOME</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm leading-tight group-hover:text-primary transition-colors">
              {ev.name}
            </p>
            {ev.event_date && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(ev.event_date), "dd MMM yyyy, HH:mm")}
              </p>
            )}
          </div>
          {away && (
            <div className="flex flex-col items-center gap-1">
              <TeamBadge name={away} size={40} />
              <span className="text-[9px] text-muted-foreground font-semibold">AWAY</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
          <div>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
            <p className="text-sm font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(ev.revenue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Tickets</p>
            <p className="text-sm font-bold text-foreground">{ev.tickets} sold</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Sales</p>
            <p className="text-sm font-bold text-foreground">{ev.saleCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CategorySalesPage({
  categoryKeyword,
  title,
  homeTeam,
}: {
  categoryKeyword: string;
  title: string;
  homeTeam?: string;
}) {
  const [tab, setTab] = useState<Tab>("games");
  const [homeAwayFilter, setHomeAwayFilter] = useState<HomeAwayFilter>("all");
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Advanced filters
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", `%${categoryKeyword}%`);

    const catIds = (cats ?? []).map((c) => c.id);
    if (catIds.length === 0) { setLoading(false); return; }

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, name, event_date, venue")
      .in("category_id", catIds)
      .order("event_date", { ascending: true });

    const eventIds = (eventsData ?? []).map((e) => e.id);

    const { data: salesData } = await supabase
      .from("sales")
      .select("id, sold_at, ticket_price, quantity, platform, section, event_id, events(name)")
      .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"])
      .order("sold_at", { ascending: false });

    const salesList = (salesData as Sale[]) ?? [];
    setSales(salesList);

    const eventsWithStats: EventWithStats[] = (eventsData ?? []).map((ev) => {
      const evSales = salesList.filter((s) => s.event_id === ev.id);
      return {
        ...ev,
        revenue: evSales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
        tickets: evSales.reduce((acc, s) => acc + s.quantity, 0),
        saleCount: evSales.length,
      };
    });

    setEvents(eventsWithStats);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [categoryKeyword]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`cat-${categoryKeyword}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, categoryKeyword]);

  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  const getTimeRangeBounds = useCallback((): [Date | null, Date | null] => {
    const now = new Date();
    if (timeRange === "today") return [startOfDay(now), endOfDay(now)];
    if (timeRange === "7d") return [startOfDay(subDays(now, 7)), null];
    if (timeRange === "30d") return [startOfDay(subDays(now, 30)), null];
    if (timeRange === "90d") return [startOfDay(subMonths(now, 3)), null];
    if (timeRange === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? endOfDay(new Date(customTo)) : null;
      return [from, to];
    }
    return [null, null];
  }, [timeRange, customFrom, customTo]);

  const filteredSales = useMemo(() => {
    let result = [...sales];
    if (selectedEventId) result = result.filter((s) => s.event_id === selectedEventId);
    if (tab === "lft") result = result.filter((s) => s.platform === "LiveFootballTickets");
    if (tab === "tixstock") result = result.filter((s) => s.platform === "Tixstock");
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.events?.name?.toLowerCase().includes(q) || s.section?.toLowerCase().includes(q)
      );
    }
    // Section filter
    if (sectionFilter.trim()) {
      const sq = sectionFilter.trim().toLowerCase();
      result = result.filter((s) => s.section?.toLowerCase().includes(sq));
    }
    // Qty filters
    if (minQty !== "") result = result.filter((s) => s.quantity >= Number(minQty));
    if (maxQty !== "") result = result.filter((s) => s.quantity <= Number(maxQty));
    // Price filters
    if (minPrice !== "") result = result.filter((s) => s.ticket_price >= Number(minPrice));
    if (maxPrice !== "") result = result.filter((s) => s.ticket_price <= Number(maxPrice));
    // Time range
    const [from, to] = getTimeRangeBounds();
    if (from) result = result.filter((s) => new Date(s.sold_at) >= from);
    if (to) result = result.filter((s) => new Date(s.sold_at) <= to);

    result.sort((a, b) => {
      const av = sortKey === "sold_at" ? new Date(a[sortKey]).getTime() : Number(a[sortKey]);
      const bv = sortKey === "sold_at" ? new Date(b[sortKey]).getTime() : Number(b[sortKey]);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return result;
  }, [sales, selectedEventId, tab, search, sortKey, sortDir, sectionFilter, minQty, maxQty, minPrice, maxPrice, getTimeRangeBounds]);

  const activeFilterCount = [
    minQty, maxQty, minPrice, maxPrice, sectionFilter,
    timeRange !== "all" ? "t" : "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setMinQty(""); setMaxQty(""); setMinPrice(""); setMaxPrice("");
    setSectionFilter(""); setTimeRange("all"); setCustomFrom(""); setCustomTo("");
    setPage(1);
  };

  const paginated = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);
  const totalTickets = filteredSales.reduce((acc, s) => acc + s.quantity, 0);
  const lftCount = filteredSales.filter((s) => s.platform === "LiveFootballTickets").length;
  const tixCount = filteredSales.filter((s) => s.platform === "Tixstock").length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-0.5 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5 inline" /> : <ChevronDown className="h-3 w-3 ml-0.5 inline" />;
  };

  const exportCSV = () => {
    const rows = [
      ["#", "Platform", "Event", "Section", "Qty", "Price", "Total", "Date"],
      ...filteredSales.map((s, i) => [
        i + 1,
        s.platform,
        s.events?.name ?? "",
        s.section ?? "",
        s.quantity,
        s.ticket_price,
        (s.ticket_price * s.quantity).toFixed(2),
        format(new Date(s.sold_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/ /g, "-")}-sales.csv`;
    a.click();
  };

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  // Games grid — search + home/away filter
  const filteredEvents = events.filter((ev) => {
    if (search && !ev.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (homeTeam && homeAwayFilter !== "all") {
      const [home] = parseTeams(ev.name);
      const isHome = home.toLowerCase().includes(homeTeam.toLowerCase());
      if (homeAwayFilter === "home" && !isHome) return false;
      if (homeAwayFilter === "away" && isHome) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedEvent && tab !== "games" && (
            <button
              onClick={() => { setSelectedEventId(null); setTab("games"); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              All Games
            </button>
          )}
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {selectedEvent && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-foreground font-medium">{selectedEvent.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Updated: {format(updatedAt, "HH:mm")}</span>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-border mt-4 flex gap-0">
        <button className={tabCls("games")} onClick={() => { setTab("games"); setSelectedEventId(null); }}>
          Games ({events.length})
        </button>
        <button className={tabCls("all")} onClick={() => setTab("all")}>All Sales</button>
        <button className={tabCls("lft")} onClick={() => setTab("lft")} style={{ color: tab === "lft" ? "hsl(142,72%,55%)" : undefined, borderColor: tab === "lft" ? "hsl(142,72%,55%)" : undefined }}>LFT</button>
        <button className={tabCls("tixstock")} onClick={() => setTab("tixstock")} style={{ color: tab === "tixstock" ? "hsl(200,80%,60%)" : undefined, borderColor: tab === "tixstock" ? "hsl(200,80%,60%)" : undefined }}>Tixstock</button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Games Grid */}
        {tab === "games" && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 max-w-xs"
                />
              </div>
              {homeTeam && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border p-0.5">
                  {(["all", "home", "away"] as HomeAwayFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setHomeAwayFilter(f)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        homeAwayFilter === f
                          ? f === "home"
                            ? "text-orange-300 bg-orange-950/60 border border-orange-500/40"
                            : f === "away"
                            ? "text-blue-300 bg-blue-950/60 border border-blue-500/40"
                            : "text-foreground bg-secondary border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{filteredEvents.length} events</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}
              </div>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-16 text-sm">No events found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    homeTeam={homeTeam}
                    onClick={() => { setSelectedEventId(ev.id); setTab("all"); setSearch(""); setPage(1); }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Sales Table View */}
        {tab !== "games" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: "TOTAL SALES", value: filteredSales.length },
                { label: "TOTAL TICKETS", value: totalTickets },
                { label: "REVENUE", value: fmt(totalRevenue) },
                { label: "LFT", value: lftCount },
                { label: "TIXSTOCK", value: tixCount },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground font-semibold tracking-widest">{s.label}</p>
                    <p className="text-xl font-bold mt-0.5 text-foreground">{loading ? "…" : s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters — always visible */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {/* Section */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Section</label>
                  <Input
                    placeholder="e.g. Block M3"
                    value={sectionFilter}
                    onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quantity</label>
                  <div className="flex gap-1.5 items-center">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minQty}
                      min={1}
                      onChange={(e) => { setMinQty(e.target.value); setPage(1); }}
                      className="h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-xs shrink-0">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxQty}
                      min={1}
                      onChange={(e) => { setMaxQty(e.target.value); setPage(1); }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Price (£)</label>
                  <div className="flex gap-1.5 items-center">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      min={0}
                      onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                      className="h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-xs shrink-0">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      min={0}
                      onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Time Range */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time Range</label>
                  <div className="flex flex-wrap gap-1">
                    {(["all", "today", "7d", "30d", "90d", "custom"] as TimeRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => { setTimeRange(r); setPage(1); }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors border ${
                          timeRange === r
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r === "all" ? "All" : r === "today" ? "Today" : r === "7d" ? "7d" : r === "30d" ? "30d" : r === "90d" ? "90d" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom date range */}
              {timeRange === "custom" && (
                <div className="flex gap-3 items-center pt-2 border-t border-border/50">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex gap-2 items-center flex-wrap">
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                      className="h-8 text-sm w-36"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                      className="h-8 text-sm w-36"
                    />
                  </div>
                </div>
              )}

              {/* Footer: count + clear + export */}
              <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                <span className="text-xs text-muted-foreground">{filteredSales.length} of {sales.length} sales</span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground hover:text-foreground h-7 px-2 text-xs">
                    <X className="h-3 w-3" /> Clear filters
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto gap-1.5">
                  <Download className="h-3.5 w-3.5" />Export CSV
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : paginated.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-sm">No sales found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-10">#</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Platform</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Event</th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Section</th>
                          <th onClick={() => handleSort("quantity")} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                            Qty<SortIcon col="quantity" />
                          </th>
                          <th onClick={() => handleSort("ticket_price")} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                            Price<SortIcon col="ticket_price" />
                          </th>
                          <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Total</th>
                          <th onClick={() => handleSort("sold_at")} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:text-foreground select-none">
                            Sold/Seen<SortIcon col="sold_at" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((sale, i) => {
                          const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                          const [home] = parseTeams(sale.events?.name ?? "");
                          return (
                            <tr key={sale.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{rowNum}</td>
                              <td className="px-4 py-3"><PlatformBadge platform={sale.platform} /></td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <TeamBadge name={home} size={24} />
                                  <span className="font-medium text-foreground text-xs truncate max-w-[160px]">{sale.events?.name ?? "—"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{sale.section ?? "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{sale.quantity}</td>
                              <td className="px-4 py-3 font-mono text-xs" style={{ color: "hsl(142,72%,55%)" }}>{fmt(sale.ticket_price)}</td>
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{fmt(sale.ticket_price * sale.quantity)}</td>
                              <td className="px-4 py-3 text-xs" style={{ color: "hsl(142,72%,55%)" }}>{format(new Date(sale.sold_at), "dd MMM HH:mm")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
