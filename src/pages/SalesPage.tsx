import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Sale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  notes: string | null;
  events: { name: string; categories: { name: string } | null } | null;
}

type SortKey = "sold_at" | "ticket_price" | "quantity" | "platform";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 30;

const TIME_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
];

const QTY_OPTIONS = [
  { label: "Any quantity", value: "all" },
  { label: "1 ticket", value: "1" },
  { label: "2 tickets", value: "2" },
  { label: "3 tickets", value: "3" },
  { label: "4 tickets", value: "4" },
  { label: "5+ tickets", value: "5+" },
];

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [category, setCategory] = useState("all");
  const [game, setGame] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [qty, setQty] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [section, setSection] = useState("all");

  // Sort & page
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.from("categories").select("id, name").is("parent_id", null).order("name").then(({ data }) => setCategories(data ?? []));
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      let q = supabase.from("events").select("id, name, category_id").order("name");
      const { data } = await q;
      let list = data ?? [];
      if (category !== "all") {
        const cat = categories.find((c) => c.name === category);
        if (cat) list = list.filter((e: any) => e.category_id === cat.id);
      }
      setEvents(list);
      if (game !== "all" && !list.find((e) => e.id === game)) setGame("all");
    };
    fetchEvents();
  }, [category, categories]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      // Fetch all sales using pagination to avoid the 1000-row default limit
      let allSales: Sale[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch, error } = await supabase
          .from("sales")
          .select("*, events(name, categories(name))")
          .order("sold_at", { ascending: false })
          .range(from, from + batchSize - 1);
        if (error) break;
        allSales = allSales.concat((batch as Sale[]) ?? []);
        if (!batch || batch.length < batchSize) break;
        from += batchSize;
      }
      setSales(allSales);
      setLoading(false);
    };
    fetchSales();

    const channel = supabase
      .channel("sales-page-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchSales)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Unique sections for filter
  const sections = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => { if (s.section) set.add(s.section); });
    return Array.from(set).sort();
  }, [sales]);

  const filtered = useMemo(() => {
    let result = [...sales];

    if (category !== "all") result = result.filter((s) => s.events?.categories?.name === category);
    if (game !== "all") result = result.filter((s) => (s as any).event_id === game || s.events?.name === events.find((e) => e.id === game)?.name);
    if (platform !== "all") result = result.filter((s) => s.platform === platform);
    if (section !== "all") result = result.filter((s) => s.section === section);

    if (qty !== "all") {
      if (qty === "5+") result = result.filter((s) => s.quantity >= 5);
      else result = result.filter((s) => s.quantity === Number(qty));
    }

    if (timeRange !== "all") {
      const now = Date.now();
      const ms: Record<string, number> = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6, "90d": 7776e6 };
      const cutoff = now - (ms[timeRange] ?? 0);
      result = result.filter((s) => new Date(s.sold_at).getTime() >= cutoff);
    }

    result.sort((a, b) => {
      const aVal = sortKey === "sold_at" ? new Date(a[sortKey]).getTime() : sortKey === "platform" ? a[sortKey].localeCompare(b[sortKey]) : Number(a[sortKey]);
      const bVal = sortKey === "sold_at" ? new Date(b[sortKey]).getTime() : sortKey === "platform" ? 0 : Number(b[sortKey]);
      if (sortKey === "platform") return sortDir === "asc" ? (aVal as number) : -(aVal as number);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return result;
  }, [sales, category, game, platform, qty, timeRange, section, sortKey, sortDir, events]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const resetFilters = () => {
    setCategory("all"); setGame("all"); setPlatform("all"); setQty("all"); setTimeRange("all"); setSection("all"); setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const exportCSV = () => {
    const rows = [
      ["Category", "Event", "Section", "Qty", "Price", "Platform", "Sold At"],
      ...filtered.map((s) => [
        s.events?.categories?.name ?? "", s.events?.name ?? "", s.section ?? "",
        s.quantity, s.ticket_price, s.platform, format(new Date(s.sold_at), "yyyy-MM-dd HH:mm:ss"),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sales.csv"; a.click();
  };

  const activeFilterCount = [category, game, platform, qty, timeRange, section].filter((v) => v !== "all").length;
  const totalRevenue = filtered.reduce((a, s) => a + s.ticket_price * s.quantity, 0);
  const totalTickets = filtered.reduce((a, s) => a + s.quantity, 0);

  return (
    <div className="p-6 space-y-4 overflow-auto flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length.toLocaleString()} sales · {totalTickets.toLocaleString()} tickets · {fmt(totalRevenue)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="All clubs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clubs</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={game} onValueChange={(v) => { setGame(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={section} onValueChange={(v) => { setSection(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={qty} onValueChange={(v) => { setQty(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Any quantity" />
          </SelectTrigger>
          <SelectContent>
            {QTY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="LiveFootballTickets">LFT</SelectItem>
            <SelectItem value="Tixstock">Tixstock</SelectItem>
            <SelectItem value="Fanpass">Fanpass</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={(v) => { setTimeRange(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={resetFilters}>
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">The most recent sales matching your filter selection</p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : paginated.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No sales match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      { label: "Category", sortable: false },
                      { label: "Event", sortable: false },
                      { label: "Section", sortable: false },
                      { label: "Qty", key: "quantity" as SortKey },
                      { label: "Ticket Price", key: "ticket_price" as SortKey },
                      { label: "Platform", key: "platform" as SortKey },
                      { label: "Sold At", key: "sold_at" as SortKey },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`text-left px-4 py-3 text-muted-foreground font-medium text-xs ${col.key ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                        onClick={() => col.key && handleSort(col.key)}
                      >
                        {col.label}
                        {col.key && <SortIcon col={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sale) => (
                    <tr key={sale.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sale.events?.categories?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">{sale.events?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sale.section ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{sale.quantity}</td>
                      <td className="px-4 py-3 text-foreground font-semibold">{fmt(sale.ticket_price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          sale.platform === "LiveFootballTickets" ? "text-primary border-primary/30" :
                          sale.platform === "Fanpass" ? "text-chart-4 border-chart-4/30" :
                          "text-chart-2 border-chart-2/30"
                        }>
                          {sale.platform === "LiveFootballTickets" ? "LFT" : sale.platform}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(sale.sold_at), "dd MMM yy, HH:mm:ss")}
                      </td>
                    </tr>
                  ))}
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
  );
}
