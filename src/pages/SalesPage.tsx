import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  notes: string | null;
  events: { name: string; categories: { name: string } | null } | null;
}

type SortKey = "sold_at" | "ticket_price" | "quantity" | "platform";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("sold_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name").is("parent_id", null).order("name");
      setCategories(data ?? []);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("sales")
        .select("*, events(name, categories(name))")
        .order("sold_at", { ascending: false });
      if (!error) setSales((data as Sale[]) ?? []);
      setLoading(false);
    };
    fetchSales();

    const channel = supabase
      .channel("sales-table")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchSales)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    let result = [...sales];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.events?.name?.toLowerCase().includes(q) ||
          s.section?.toLowerCase().includes(q) ||
          s.platform.toLowerCase().includes(q)
      );
    }
    if (platform !== "all") result = result.filter((s) => s.platform === platform);
    if (category !== "all")
      result = result.filter((s) => s.events?.categories?.name === category);

    result.sort((a, b) => {
      const aVal = sortKey === "sold_at" ? new Date(a[sortKey]).getTime() : Number(a[sortKey]);
      const bVal = sortKey === "sold_at" ? new Date(b[sortKey]).getTime() : Number(b[sortKey]);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [sales, search, platform, category, sortKey, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const exportCSV = () => {
    const rows = [
      ["Event", "Category", "Section", "Qty", "Price", "Platform", "Date"],
      ...filtered.map((s) => [
        s.events?.name ?? "",
        s.events?.categories?.name ?? "",
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
    a.href = url; a.download = "sales.csv"; a.click();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Table</h1>
          <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} sales</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search event, section…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="LiveFootballTickets">LiveFootballTickets</SelectItem>
            <SelectItem value="Tixstock">Tixstock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : paginated.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No sales match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { label: "Event", sortable: false },
                      { label: "Category", sortable: false },
                      { label: "Section", sortable: false },
                      { label: "Qty", key: "quantity" as SortKey },
                      { label: "Price", key: "ticket_price" as SortKey },
                      { label: "Platform", key: "platform" as SortKey },
                      { label: "Date Sold", key: "sold_at" as SortKey },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase ${col.key ? "cursor-pointer hover:text-foreground select-none" : ""}`}
                        onClick={() => col.key && handleSort(col.key)}
                      >
                        {col.label}
                        {col.key && <SortIcon col={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sale, i) => (
                    <tr key={sale.id} className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{sale.events?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sale.events?.categories?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.section ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.quantity}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{fmt(sale.ticket_price)}</td>
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

          {/* Pagination */}
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
