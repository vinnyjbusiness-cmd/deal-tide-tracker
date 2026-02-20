import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CalendarDays, Search, TrendingUp, Ticket } from "lucide-react";

interface EventWithStats {
  id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  categories: { name: string } | null;
  total_revenue: number;
  total_tickets: number;
  sale_count: number;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventWithStats | null>(null);
  const [eventSales, setEventSales] = useState<Array<{ id: string; sold_at: string; ticket_price: number; quantity: number; platform: string; section: string | null }>>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data: eventsData } = await supabase
        .from("events")
        .select("*, categories(name)")
        .order("event_date", { ascending: false });

      const { data: salesData } = await supabase
        .from("sales")
        .select("event_id, ticket_price, quantity");

      const eventStats: EventWithStats[] = (eventsData ?? []).map((ev) => {
        const evSales = salesData?.filter((s) => s.event_id === ev.id) ?? [];
        return {
          ...ev,
          categories: ev.categories as { name: string } | null,
          total_revenue: evSales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
          total_tickets: evSales.reduce((acc, s) => acc + s.quantity, 0),
          sale_count: evSales.length,
        };
      });

      setEvents(eventStats);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const handleEventClick = async (ev: EventWithStats) => {
    setSelectedEvent(ev);
    setLoadingSales(true);
    const { data } = await supabase
      .from("sales")
      .select("id, sold_at, ticket_price, quantity, platform, section")
      .eq("event_id", ev.id)
      .order("sold_at", { ascending: false });
    setEventSales(data ?? []);
    setLoadingSales(false);
  };

  const filtered = events.filter((ev) =>
    ev.name.toLowerCase().includes(search.toLowerCase()) ||
    ev.categories?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  if (selectedEvent) {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground text-sm">← All Events</button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">{selectedEvent.name}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenue", value: fmt(selectedEvent.total_revenue) },
            { label: "Tickets Sold", value: selectedEvent.total_tickets },
            { label: "# Sales", value: selectedEvent.sale_count },
            { label: "Category", value: selectedEvent.categories?.name ?? "—" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-xl font-bold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sales for this Event</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingSales ? (
              <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : eventSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No sales recorded for this event.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Section", "Qty", "Price", "Platform", "Date"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eventSales.map((s, i) => (
                      <tr key={s.id} className={`border-b border-border/50 hover:bg-accent/30 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-4 py-3 text-muted-foreground">{s.section ?? "—"}</td>
                        <td className="px-4 py-3">{s.quantity}</td>
                        <td className="px-4 py-3 font-medium">{fmt(s.ticket_price)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={s.platform === "LiveFootballTickets" ? "text-primary border-primary/30" : "text-chart-2 border-chart-2/30"}>
                            {s.platform === "LiveFootballTickets" ? "LFT" : "Tixstock"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(s.sold_at), "dd MMM yy, HH:mm")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground">{events.length} events tracked</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 text-sm">No events found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ev) => (
            <Card key={ev.id} onClick={() => handleEventClick(ev)} className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="secondary" className="text-xs">{ev.categories?.name ?? "Uncategorised"}</Badge>
                  {ev.event_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(ev.event_date), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground leading-snug mb-4">{ev.name}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{fmt(ev.total_revenue)}</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Ticket className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tickets</p>
                      <p className="text-sm font-bold mt-0.5">{ev.total_tickets}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-xs text-muted-foreground">Sales</p>
                      <p className="text-sm font-bold mt-0.5">{ev.sale_count}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
