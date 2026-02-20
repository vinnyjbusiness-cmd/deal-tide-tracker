import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamBadge, parseTeams, resolveTeamColors, getTeamFlag } from "@/components/TeamBadge";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ChevronDown, RefreshCw, Calendar, MapPin, Trophy, X, ArrowLeft, Download, Search, ChevronUp, ChevronsUpDown } from "lucide-react";

interface WCEvent {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  notes: string | null;
  revenue: number;
  tickets: number;
  saleCount: number;
  matchNumber: number;
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

type SalesTab = "all" | "lft" | "tixstock" | "fanpass";
type SortKey = "sold_at" | "ticket_price" | "quantity";
type SortDir = "asc" | "desc";
type TimeRange = "all" | "today" | "7d" | "30d" | "90d" | "custom";

const ALL_ROUNDS = [
  "All",
  "Group Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-Final",
  "Semi-Final",
  "3rd Place",
  "Final",
];

const ROUND_COLORS: Record<string, { border: string; glow: string; badge: string }> = {
  "Group A":    { border: "hsl(200,80%,50%)", glow: "hsl(200,80%,50%,0.12)", badge: "hsl(200,80%,20%)" },
  "Group B":    { border: "hsl(160,70%,45%)", glow: "hsl(160,70%,45%,0.12)", badge: "hsl(160,70%,18%)" },
  "Group C":    { border: "hsl(280,70%,55%)", glow: "hsl(280,70%,55%,0.12)", badge: "hsl(280,70%,20%)" },
  "Group D":    { border: "hsl(340,80%,55%)", glow: "hsl(340,80%,55%,0.12)", badge: "hsl(340,80%,20%)" },
  "Group E":    { border: "hsl(30,90%,55%)",  glow: "hsl(30,90%,55%,0.12)",  badge: "hsl(30,90%,20%)" },
  "Group F":    { border: "hsl(60,85%,50%)",  glow: "hsl(60,85%,50%,0.12)",  badge: "hsl(60,85%,18%)" },
  "Group G":    { border: "hsl(180,70%,45%)", glow: "hsl(180,70%,45%,0.12)", badge: "hsl(180,70%,18%)" },
  "Group H":    { border: "hsl(240,70%,60%)", glow: "hsl(240,70%,60%,0.12)", badge: "hsl(240,70%,22%)" },
  "Group I":    { border: "hsl(20,90%,55%)",  glow: "hsl(20,90%,55%,0.12)",  badge: "hsl(20,90%,20%)" },
  "Group J":    { border: "hsl(130,65%,45%)", glow: "hsl(130,65%,45%,0.12)", badge: "hsl(130,65%,18%)" },
  "Group K":    { border: "hsl(310,70%,55%)", glow: "hsl(310,70%,55%,0.12)", badge: "hsl(310,70%,20%)" },
  "Group L":    { border: "hsl(50,90%,50%)",  glow: "hsl(50,90%,50%,0.12)",  badge: "hsl(50,90%,18%)" },
  "Round of 32":{ border: "hsl(200,85%,55%)", glow: "hsl(200,85%,55%,0.15)", badge: "hsl(200,85%,18%)" },
  "Round of 16":{ border: "hsl(260,80%,65%)", glow: "hsl(260,80%,65%,0.15)", badge: "hsl(260,80%,22%)" },
  "Quarter-Final":{ border: "hsl(35,95%,55%)", glow: "hsl(35,95%,55%,0.18)", badge: "hsl(35,95%,20%)" },
  "Semi-Final":  { border: "hsl(15,95%,60%)", glow: "hsl(15,95%,60%,0.18)", badge: "hsl(15,95%,22%)" },
  "3rd Place":   { border: "hsl(200,60%,55%)", glow: "hsl(200,60%,55%,0.2)", badge: "hsl(200,60%,20%)" },
  "Final":       { border: "hsl(45,100%,55%)", glow: "hsl(45,100%,55%,0.25)", badge: "hsl(45,100%,18%)" },
};

const PAGE_SIZE = 30;
const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

function getRoundGroup(notes: string | null): string {
  if (!notes) return "Other";
  if (notes.startsWith("Group")) return "Group Stage";
  return notes;
}

function getMatchGradient(home: string, away: string): { bg: string } {
  const hc = resolveTeamColors(home);
  const ac = resolveTeamColors(away);
  return { bg: `linear-gradient(135deg, ${hc.bg}22 0%, transparent 50%, ${ac.bg}22 100%)` };
}

function RoundBadge({ round }: { round: string }) {
  const isFinal = round === "Final";
  const isQFPlus = ["Quarter-Final", "Semi-Final", "Final"].includes(round);
  return (
    <span
      className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase"
      style={{
        background: ROUND_COLORS[round]?.badge ?? "hsl(220,20%,20%)",
        color: ROUND_COLORS[round]?.border ?? "hsl(220,20%,70%)",
        border: `1px solid ${ROUND_COLORS[round]?.border ?? "hsl(220,20%,40%)"}`,
        boxShadow: isQFPlus ? `0 0 8px ${ROUND_COLORS[round]?.border}55` : undefined,
      }}
    >
      {isFinal ? "🏆 FINAL" : round}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "LiveFootballTickets")
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(142,72%,15%)", color: "hsl(142,72%,55%)", border: "1px solid hsl(142,72%,30%)" }}>LFT</span>;
  if (platform === "Fanpass")
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(280,70%,15%)", color: "hsl(280,70%,65%)", border: "1px solid hsl(280,70%,30%)" }}>FANPASS</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(200,80%,12%)", color: "hsl(200,80%,60%)", border: "1px solid hsl(200,80%,25%)" }}>TIXSTOCK</span>;
}

function MatchCard({ ev, onClick }: { ev: WCEvent; onClick: () => void }) {
  const [home, away] = parseTeams(ev.name);
  const round = ev.notes ?? "Group Stage";
  const roundStyle = ROUND_COLORS[round] ?? ROUND_COLORS["Group A"];
  const grad = getMatchGradient(home, away);
  const isFinal = round === "Final";
  const isKnockout = !round.startsWith("Group");

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all hover:scale-[1.01] group border overflow-hidden relative"
      style={{
        borderColor: roundStyle.border,
        boxShadow: isKnockout
          ? `0 0 0 1px ${roundStyle.border}66, 0 4px 20px ${roundStyle.glow}`
          : `0 0 0 1px ${roundStyle.border}44`,
        background: "hsl(var(--card))",
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: grad.bg, opacity: 0.6 }} />
      {isFinal && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, hsl(45,100%,60%,0.08) 0%, transparent 60%)" }} />
      )}

      <CardContent className="p-4 relative z-10">
        {/* Top row: match number + round badge + revenue */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider px-2 py-0.5 rounded bg-secondary">
              M{ev.matchNumber}
            </span>
            <RoundBadge round={round} />
          </div>
          {ev.saleCount > 0 && (
            <span className="text-[11px] font-bold" style={{ color: "hsl(142,72%,55%)" }}>
              {fmt(ev.revenue)}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex flex-col items-center gap-1 min-w-0">
            <TeamBadge name={home} size={44} />
            <span className="text-[9px] font-semibold text-muted-foreground truncate max-w-[60px] text-center leading-tight">
              {home}
            </span>
          </div>

          <div className="flex-1 text-center min-w-0">
            <div className="text-xs font-black text-muted-foreground tracking-widest">VS</div>
            {ev.event_date && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5 mt-1">
                <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
                {format(new Date(ev.event_date), "d MMM")}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 min-w-0">
            <TeamBadge name={away} size={44} />
            <span className="text-[9px] font-semibold text-muted-foreground truncate max-w-[60px] text-center leading-tight">
              {away}
            </span>
          </div>
        </div>

        {/* Venue */}
        {ev.venue && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{ev.venue}</span>
          </p>
        )}

        {/* Stats */}
        {ev.saleCount > 0 ? (
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/40">
            <div>
              <p className="text-[9px] text-muted-foreground">Revenue</p>
              <p className="text-[11px] font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(ev.revenue)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Tickets</p>
              <p className="text-[11px] font-bold text-foreground">{ev.tickets}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Sales</p>
              <p className="text-[11px] font-bold text-foreground">{ev.saleCount}</p>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground text-center">Click to view sales</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorldCupPage() {
  const [events, setEvents] = useState<WCEvent[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState("All");
  const [teamSearch, setTeamSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detail view state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [salesTab, setSalesTab] = useState<SalesTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [openDropdown, setOpenDropdown] = useState<"section" | "qty" | "time" | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", "%World Cup%");

    const catIds = (cats ?? []).map((c) => c.id);
    if (catIds.length === 0) { setLoading(false); return; }

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, name, event_date, venue, notes")
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

    const enriched: WCEvent[] = (eventsData ?? []).map((ev, idx) => {
      const evSales = salesList.filter((s) => s.event_id === ev.id);
      return {
        ...ev,
        revenue: evSales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
        tickets: evSales.reduce((acc, s) => acc + s.quantity, 0),
        saleCount: evSales.length,
        matchNumber: idx + 1,
      };
    });

    setEvents(enriched);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    events.forEach((ev) => {
      const [h, a] = parseTeams(ev.name);
      if (h) teams.add(h);
      if (a) teams.add(a);
    });
    return Array.from(teams).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const roundGroup = getRoundGroup(ev.notes);
      if (roundFilter !== "All" && roundGroup !== roundFilter && ev.notes !== roundFilter) return false;
      if (teamSearch) {
        const q = teamSearch.toLowerCase();
        if (!ev.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [events, roundFilter, teamSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, WCEvent[]>();
    filteredEvents.forEach((ev) => {
      const key = ev.notes ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [filteredEvents]);

  const roundOrder = [
    "Group A","Group B","Group C","Group D","Group E","Group F",
    "Group G","Group H","Group I","Group J","Group K","Group L",
    "Round of 32","Round of 16","Quarter-Final","Semi-Final","3rd Place","Final",
  ];
  const sortedGroups = Array.from(grouped.entries()).sort(
    ([a], [b]) => roundOrder.indexOf(a) - roundOrder.indexOf(b)
  );

  const totalRevenue = events.reduce((a, e) => a + e.revenue, 0);
  const totalTickets = events.reduce((a, e) => a + e.tickets, 0);

  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  // Sales filtering for detail view
  const getTimeRangeBounds = useCallback((): [Date | null, Date | null] => {
    const now = new Date();
    if (timeRange === "today") return [startOfDay(now), endOfDay(now)];
    if (timeRange === "7d") return [startOfDay(subDays(now, 7)), null];
    if (timeRange === "30d") return [startOfDay(subDays(now, 30)), null];
    if (timeRange === "90d") return [startOfDay(subMonths(now, 3)), null];
    if (timeRange === "custom") {
      return [customFrom ? new Date(customFrom) : null, customTo ? endOfDay(new Date(customTo)) : null];
    }
    return [null, null];
  }, [timeRange, customFrom, customTo]);

  const filteredSales = useMemo(() => {
    let result = sales.filter((s) => s.event_id === selectedEventId);
    if (salesTab === "lft") result = result.filter((s) => s.platform === "LiveFootballTickets");
    if (salesTab === "tixstock") result = result.filter((s) => s.platform === "Tixstock");
    if (salesTab === "fanpass") result = result.filter((s) => s.platform === "Fanpass");
    if (salesSearch) {
      const q = salesSearch.toLowerCase();
      result = result.filter((s) => s.section?.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q));
    }
    if (sectionFilter.trim()) result = result.filter((s) => s.section?.toLowerCase().includes(sectionFilter.trim().toLowerCase()));
    if (minQty !== "") result = result.filter((s) => s.quantity >= Number(minQty));
    if (maxQty !== "") result = result.filter((s) => s.quantity <= Number(maxQty));
    if (minPrice !== "") result = result.filter((s) => s.ticket_price >= Number(minPrice));
    const [from, to] = getTimeRangeBounds();
    if (from) result = result.filter((s) => new Date(s.sold_at) >= from);
    if (to) result = result.filter((s) => new Date(s.sold_at) <= to);
    result.sort((a, b) => {
      const av = sortKey === "sold_at" ? new Date(a[sortKey]).getTime() : Number(a[sortKey]);
      const bv = sortKey === "sold_at" ? new Date(b[sortKey]).getTime() : Number(b[sortKey]);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return result;
  }, [sales, selectedEventId, salesTab, salesSearch, sectionFilter, minQty, maxQty, minPrice, sortKey, sortDir, getTimeRangeBounds]);

  const paginated = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);

  const detailRevenue = filteredSales.reduce((a, s) => a + s.ticket_price * s.quantity, 0);
  const detailTickets = filteredSales.reduce((a, s) => a + s.quantity, 0);
  const lftCount = filteredSales.filter((s) => s.platform === "LiveFootballTickets").length;
  const tixCount = filteredSales.filter((s) => s.platform === "Tixstock").length;
  const fanpassCount = filteredSales.filter((s) => s.platform === "Fanpass").length;

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
      ["#", "Platform", "Match", "Section", "Qty", "Price", "Total", "Date"],
      ...filteredSales.map((s, i) => [
        i + 1, s.platform, selectedEvent?.name ?? "", s.section ?? "",
        s.quantity, s.ticket_price, (s.ticket_price * s.quantity).toFixed(2),
        format(new Date(s.sold_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wc-match-${selectedEvent?.matchNumber}-sales.csv`;
    a.click();
  };

  const tabCls = (t: SalesTab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      salesTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const openDetail = (ev: WCEvent) => {
    setSelectedEventId(ev.id);
    setSalesTab("all");
    setSalesSearch("");
    setPage(1);
    setSectionFilter("");
    setMinPrice("");
    setMinQty("");
    setMaxQty("");
    setTimeRange("all");
  };

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (selectedEvent) {
    const [home, away] = parseTeams(selectedEvent.name);
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedEventId(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
            >
              <ArrowLeft className="h-4 w-4" />
              All Matches
            </button>
            <div className="p-1.5 rounded-lg" style={{ background: "hsl(45,100%,50%,0.15)", border: "1px solid hsl(45,100%,50%,0.3)" }}>
              <Trophy className="h-4 w-4" style={{ color: "hsl(45,100%,60%)" }} />
            </div>
            <h1 className="text-xl font-bold text-foreground">World Cup 2026</h1>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-foreground font-medium">
              Match {selectedEvent.matchNumber} · {selectedEvent.name}
            </span>
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
          <button className={tabCls("all")} onClick={() => { setSalesTab("all"); setPage(1); }}>All Sales</button>
          <button className={tabCls("lft")} onClick={() => { setSalesTab("lft"); setPage(1); }} style={{ color: salesTab === "lft" ? "hsl(142,72%,55%)" : undefined, borderColor: salesTab === "lft" ? "hsl(142,72%,55%)" : undefined }}>LFT</button>
          <button className={tabCls("tixstock")} onClick={() => { setSalesTab("tixstock"); setPage(1); }} style={{ color: salesTab === "tixstock" ? "hsl(200,80%,60%)" : undefined, borderColor: salesTab === "tixstock" ? "hsl(200,80%,60%)" : undefined }}>Tixstock</button>
          <button className={tabCls("fanpass")} onClick={() => { setSalesTab("fanpass"); setPage(1); }} style={{ color: salesTab === "fanpass" ? "hsl(280,70%,65%)" : undefined, borderColor: salesTab === "fanpass" ? "hsl(280,70%,65%)" : undefined }}>Fanpass</button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "TOTAL SALES", value: filteredSales.length },
              { label: "TOTAL TICKETS", value: detailTickets },
              { label: "REVENUE", value: fmt(detailRevenue) },
              { label: "LFT", value: lftCount },
              { label: "TIXSTOCK", value: tixCount },
              { label: "FANPASS", value: fanpassCount },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground font-semibold tracking-widest">{s.label}</p>
                  <p className="text-xl font-bold mt-0.5 text-foreground">{loading ? "…" : s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Match info strip */}
          <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card/50">
            <div className="flex items-center gap-2">
              <TeamBadge name={home} size={32} />
              <span className="font-semibold text-sm text-foreground">{home}</span>
            </div>
            <span className="text-muted-foreground font-black text-xs tracking-widest">VS</span>
            <div className="flex items-center gap-2">
              <TeamBadge name={away} size={32} />
              <span className="font-semibold text-sm text-foreground">{away}</span>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
              {selectedEvent.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selectedEvent.event_date), "dd MMM yyyy, HH:mm")}
                </span>
              )}
              {selectedEvent.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedEvent.venue}
                </span>
              )}
              {selectedEvent.notes && <RoundBadge round={selectedEvent.notes} />}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2" ref={filterRef}>
            {/* Section */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "section" ? null : "section")}
                className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${sectionFilter ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-accent/40"}`}
              >
                Section{sectionFilter ? `: ${sectionFilter}` : ""}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {openDropdown === "section" && (
                <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-md border border-border bg-card shadow-lg">
                  <div className="p-2 border-b border-border">
                    <Input autoFocus placeholder="Type section…" value={sectionFilter}
                      onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }} className="h-7 text-sm" />
                  </div>
                  <ul className="py-1 max-h-52 overflow-y-auto">
                    <li>
                      <button onClick={() => { setSectionFilter(""); setOpenDropdown(null); setPage(1); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                        All sections
                      </button>
                    </li>
                    {Array.from(new Set(sales.filter(s => s.event_id === selectedEventId).map((s) => s.section).filter(Boolean))).sort().map((sec) => (
                      <li key={sec}>
                        <button onClick={() => { setSectionFilter(sec!); setOpenDropdown(null); setPage(1); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 hover:text-foreground ${sectionFilter === sec ? "text-primary font-semibold" : "text-foreground"}`}>
                          {sec}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Qty */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "qty" ? null : "qty")}
                className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${minQty || maxQty ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-accent/40"}`}
              >
                Qty{minQty || maxQty ? `: ${minQty || "any"}–${maxQty || "any"}` : ""}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {openDropdown === "qty" && (
                <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-md border border-border bg-card shadow-lg p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quantity range</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4,5,6].map((n) => (
                      <button key={n} onClick={() => { setMinQty(String(n)); setMaxQty(String(n)); setPage(1); }}
                        className={`px-2 py-1.5 rounded text-sm font-medium border transition-colors ${minQty === String(n) && maxQty === String(n) ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-foreground hover:bg-accent/50"}`}>
                        {n} ticket{n > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border pt-2 space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">Custom range</p>
                    <div className="flex gap-1.5 items-center">
                      <Input type="number" placeholder="Min" value={minQty} min={1} onChange={(e) => { setMinQty(e.target.value); setPage(1); }} className="h-7 text-sm" />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input type="number" placeholder="Max" value={maxQty} min={1} onChange={(e) => { setMaxQty(e.target.value); setPage(1); }} className="h-7 text-sm" />
                    </div>
                  </div>
                  {(minQty || maxQty) && (
                    <button onClick={() => { setMinQty(""); setMaxQty(""); setPage(1); }} className="w-full text-xs text-muted-foreground hover:text-foreground pt-1">Clear</button>
                  )}
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card">
              <span className="text-xs text-muted-foreground font-medium">£ min</span>
              <Input type="number" placeholder="Price…" value={minPrice} min={0}
                onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                className="h-6 w-20 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
              {minPrice && (
                <button onClick={() => { setMinPrice(""); setPage(1); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Time Range */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === "time" ? null : "time")}
                className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${timeRange !== "all" ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-accent/40"}`}
              >
                {timeRange === "all" ? "Time Range" : timeRange === "today" ? "Today" : timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : timeRange === "90d" ? "Last 90 days" : "Custom range"}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {openDropdown === "time" && (
                <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-md border border-border bg-card shadow-lg py-1">
                  {(["all", "today", "7d", "30d", "90d", "custom"] as TimeRange[]).map((r) => (
                    <button key={r} onClick={() => { setTimeRange(r); setPage(1); if (r !== "custom") setOpenDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/50 hover:text-foreground transition-colors ${timeRange === r ? "text-primary font-semibold" : "text-foreground"}`}>
                      {r === "all" ? "All time" : r === "today" ? "Today" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : "Custom range"}
                    </button>
                  ))}
                  {timeRange === "custom" && (
                    <div className="px-3 pb-2 pt-1 border-t border-border space-y-1.5">
                      <Input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }} className="h-7 text-sm" />
                      <Input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }} className="h-7 text-sm" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="text-xs text-muted-foreground ml-1">{filteredSales.length} of {sales.filter(s => s.event_id === selectedEventId).length}</span>
            <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto gap-1.5">
              <Download className="h-3.5 w-3.5" />Export CSV
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : paginated.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm">No sales found for this match.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">Platform</th>
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
                        return (
                          <tr key={sale.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{rowNum}</td>
                            <td className="px-4 py-3"><PlatformBadge platform={sale.platform} /></td>
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
        </div>
      </div>
    );
  }

  // ── GRID VIEW ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: "hsl(45,100%,50%,0.15)", border: "1px solid hsl(45,100%,50%,0.3)" }}>
              <Trophy className="h-5 w-5" style={{ color: "hsl(45,100%,60%)" }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">World Cup 2026</h1>
              <p className="text-xs text-muted-foreground">{events.length} matches · {format(updatedAt, "HH:mm")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] text-muted-foreground">TOTAL REV</p>
                <p className="text-sm font-bold" style={{ color: "hsl(142,72%,55%)" }}>{fmt(totalRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">TICKETS</p>
                <p className="text-sm font-bold text-foreground">{totalTickets}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROUNDS.map((r) => {
              const isActive = roundFilter === r;
              const style = r !== "All" ? ROUND_COLORS[r] ?? ROUND_COLORS["Group A"] : null;
              return (
                <button
                  key={r}
                  onClick={() => setRoundFilter(r)}
                  className="px-3 py-1 rounded-full text-xs font-bold transition-all border"
                  style={
                    isActive && style
                      ? { background: style.badge, color: style.border, borderColor: style.border, boxShadow: `0 0 8px ${style.border}44` }
                      : isActive
                      ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                      : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                  }
                >
                  {r === "All" ? `All (${events.length})` : r}
                </button>
              );
            })}
          </div>

          {/* Team dropdown filter */}
          <div className="relative ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary transition-colors min-w-[160px] justify-between"
            >
              <span className="flex items-center gap-1.5 truncate">
                {teamSearch ? (
                  <><span>{getTeamFlag(teamSearch)}</span><span className="truncate">{teamSearch}</span></>
                ) : (
                  <span className="text-muted-foreground">Filter by team…</span>
                )}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border shadow-xl overflow-hidden" style={{ background: "hsl(var(--card))", zIndex: 50 }}>
                <div className="p-1 max-h-72 overflow-y-auto">
                  <button onClick={() => { setTeamSearch(""); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-muted-foreground">
                    All teams
                  </button>
                  {allTeams.filter(t => !t.startsWith("Winner") && !t.startsWith("Runner") && !t.startsWith("R32") && !t.startsWith("3rd") && !t.startsWith("SF") && !t.startsWith("QF")).map((team) => (
                    <button key={team} onClick={() => { setTeamSearch(team); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${teamSearch === team ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"}`}>
                      <span className="text-base leading-none">{getTeamFlag(team)}</span>
                      <span>{team}</span>
                    </button>
                  ))}
                </div>
                {teamSearch && (
                  <div className="border-t border-border p-1">
                    <button onClick={() => { setTeamSearch(""); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary transition-colors">
                      <X className="h-3 w-3" /> Clear filter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No matches found.</div>
        ) : (
          sortedGroups.map(([roundKey, evs]) => (
            <section key={roundKey}>
              <div className="flex items-center gap-3 mb-4">
                <RoundBadge round={roundKey} />
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">{evs.length} match{evs.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {evs.map((ev) => (
                  <MatchCard key={ev.id} ev={ev} onClick={() => openDetail(ev)} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
