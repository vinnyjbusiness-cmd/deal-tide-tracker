import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Download, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Sale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  events: { name: string } | null;
}

type SortKey = "sold_at" | "ticket_price" | "quantity";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 30;
const CATEGORY_NAME = "World Cup / Internationals";

function SalesView({ categoryName, title, color }: { categoryName: string; title: string; color: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      // Get category ids matching this category
      const { data: cats } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", `%${categoryName}%`);

      const catIds = (cats ?? []).map((c) => c.id);
      if (catIds.length === 0) { setSales([]); setLoading(false); return; }

      const { data: events } = await supabase
        .from("events")
        .select("id")
        .in("category_id", catIds);

      const eventIds = (events ?? []).map((e) => e.id);
      if (eventIds.length === 0) { setSales([]); setLoading(false); return; }

      const { data, error } = await supabase
        .from("sales")
        .select("*, events(name)")
        .in("event_id", eventIds)
        .order("sold_at", { ascending: false });

      if (!error) setSales((data as Sale[]) ?? []);
      setLoading(false);
    };

    fetchSales();

    const channel = supabase
      .channel(`sales-${categoryName}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchSales)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [categoryName]);

  const filtered = useMemo(() => {
    let result = [...sales];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.events?.name?.toLowerCase().includes(q) || s.section?.toLowerCase().includes(q)
      );
    }
    if (platform !== "all") result = result.filter((s) => s.platform === platform);
    result.sort((a, b) => {
      const aVal = sortKey === "sold_at" ? new Date(a[sortKey]).getTime() : Number(a[sortKey]);
      const bVal = sortKey === "sold_at" ? new Date(b[sortKey]).getTime() : Number(b[sortKey]);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [sales, search, platform, sortKey, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const totalRevenue = filtered.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);
  const totalTickets = filtered.reduce((acc, s) => acc + s.quantity, 0);
  const lftRevenue = filtered.filter((s) => s.platform === "LiveFootballTickets").reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);
  const tixRevenue = filtered.filter((s) => s.platform === "Tixstock").reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const exportCSV = () => {
    const rows = [
      ["Event", "Section", "Qty", "Price", "Platform", "Date"],
      ...filtered.map((s) => [
        s.events?.name ?? "",
        s.section ?? "",
        s.quantity,
        s.ticket_price,
        s.platform,
        format(new Date(s.sold_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.toLowerCase().replace(/ /g, "-")}-sales.csv`; a.click();
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} sales</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue) },
          { label: "Tickets Sold", value: totalTickets.toString() },
          { label: "LFT Revenue", value: fmt(lftRevenue) },
          { label: "Tixstock Revenue", value: fmt(tixRevenue) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{loading ? "…" : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search event or section…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="LiveFootballTickets">LiveFootballTickets</SelectItem>
            <SelectItem value="Tixstock">Tixstock</SelectItem>
          </SelectContent>
        </Select>
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
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Event</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Section</th>
                    <th onClick={() => handleSort("quantity")} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase cursor-pointer hover:text-foreground select-none">
                      Qty<SortIcon col="quantity" />
                    </th>
                    <th onClick={() => handleSort("ticket_price")} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase cursor-pointer hover:text-foreground select-none">
                      Price<SortIcon col="ticket_price" />
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Platform</th>
                    <th onClick={() => handleSort("sold_at")} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase cursor-pointer hover:text-foreground select-none">
                      Date Sold<SortIcon col="sold_at" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sale, i) => (
                    <tr key={sale.id} className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">{sale.events?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.section ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.quantity}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmt(sale.ticket_price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={sale.platform === "LiveFootballTickets" ? "text-primary border-primary/30" : "text-chart-2 border-chart-2/30"}>
                          {sale.platform === "LiveFootballTickets" ? "LFT" : "Tixstock"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{format(new Date(sale.sold_at), "dd MMM yy, HH:mm")}</td>
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

export default function WorldCupPage() {
  return <SalesView categoryName={CATEGORY_NAME} title="World Cup" color="text-chart-4" />;
}
