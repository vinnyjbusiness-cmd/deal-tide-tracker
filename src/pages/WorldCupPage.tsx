import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TeamBadge, parseTeams, resolveTeamColors, getTeamFlag } from "@/components/TeamBadge";
import { format } from "date-fns";
import { ChevronDown, RefreshCw, Calendar, MapPin, Trophy, X } from "lucide-react";

interface WCEvent {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  notes: string | null; // used as round
  revenue: number;
  tickets: number;
  saleCount: number;
}

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

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

function getRoundGroup(notes: string | null): string {
  if (!notes) return "Other";
  if (notes.startsWith("Group")) return "Group Stage";
  return notes;
}

// Get the two dominant team colors to create a gradient for the card
function getMatchGradient(home: string, away: string): { bg: string; borderColor: string } {
  const hc = resolveTeamColors(home);
  const ac = resolveTeamColors(away);
  return {
    bg: `linear-gradient(135deg, ${hc.bg}22 0%, transparent 50%, ${ac.bg}22 100%)`,
    borderColor: hc.bg,
  };
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
      {/* Team color gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: grad.bg, opacity: 0.6 }}
      />
      {/* Gold shimmer for Final */}
      {isFinal && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(135deg, hsl(45,100%,60%,0.08) 0%, transparent 60%)" }} />
      )}

      <CardContent className="p-4 relative z-10">
        {/* Top row: round badge + revenue */}
        <div className="flex items-center justify-between mb-3">
          <RoundBadge round={round} />
          {ev.revenue > 0 && (
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
        {ev.saleCount > 0 && (
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
        )}
      </CardContent>
    </Card>
  );
}

export default function WorldCupPage() {
  const [events, setEvents] = useState<WCEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState("All");
  const [teamSearch, setTeamSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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
      .select("id, ticket_price, quantity, event_id")
      .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

    const salesList = salesData ?? [];

    const enriched: WCEvent[] = (eventsData ?? []).map((ev) => {
      const evSales = salesList.filter((s) => s.event_id === ev.id);
      return {
        ...ev,
        revenue: evSales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
        tickets: evSales.reduce((acc, s) => acc + s.quantity, 0),
        saleCount: evSales.length,
      };
    });

    setEvents(enriched);
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Collect all unique teams for the team filter
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

  // Group by round for display
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
          {/* Round filter pills */}
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
              <div
                className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-border shadow-xl overflow-hidden"
                style={{ background: "hsl(var(--card))", zIndex: 50 }}
              >
                <div className="p-1 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { setTeamSearch(""); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    All teams
                  </button>
                  {allTeams.filter(t => !t.startsWith("Winner") && !t.startsWith("Runner") && !t.startsWith("R32") && !t.startsWith("3rd") && !t.startsWith("SF") && !t.startsWith("QF")).map((team) => (
                    <button
                      key={team}
                      onClick={() => { setTeamSearch(team); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        teamSearch === team ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"
                      }`}
                    >
                      <span className="text-base leading-none">{getTeamFlag(team)}</span>
                      <span>{team}</span>
                    </button>
                  ))}
                </div>
                {teamSearch && (
                  <div className="border-t border-border p-1">
                    <button
                      onClick={() => { setTeamSearch(""); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary transition-colors"
                    >
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
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <RoundBadge round={roundKey} />
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">{evs.length} match{evs.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {evs.map((ev) => (
                  <MatchCard key={ev.id} ev={ev} onClick={() => {}} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
