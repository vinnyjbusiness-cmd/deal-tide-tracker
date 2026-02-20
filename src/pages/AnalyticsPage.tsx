import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface Sale {
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  events: { categories: { name: string } | null } | null;
}

const COLORS = ["hsl(142,72%,50%)", "hsl(200,80%,55%)"];
const CAT_COLORS: Record<string, string> = {
  "Liverpool FC": "hsl(142,72%,50%)",
  "World Cup / Internationals": "hsl(35,90%,55%)",
  "Champions League": "hsl(200,80%,55%)",
  "Other": "hsl(280,65%,60%)",
};

export default function AnalyticsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("sold_at, ticket_price, quantity, platform, events(categories(name))")
        .order("sold_at", { ascending: true });
      setSales((data as Sale[]) ?? []);
      setLoading(false);
    };
    fetchSales();

    const channel = supabase
      .channel("analytics-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchSales)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  // Revenue over 30 days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 29 - i));
    const label = format(day, "MMM d");
    const daySales = sales.filter((s) => startOfDay(new Date(s.sold_at)).getTime() === day.getTime());
    return {
      date: label,
      revenue: daySales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
    };
  });

  // Platform comparison
  const platforms = ["LiveFootballTickets", "Tixstock"];
  const platformData = platforms.map((p) => {
    const ps = sales.filter((s) => s.platform === p);
    return {
      name: p === "LiveFootballTickets" ? "LFT" : "Tixstock",
      revenue: ps.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
      tickets: ps.reduce((acc, s) => acc + s.quantity, 0),
      sales: ps.length,
    };
  });

  // Revenue by category
  const categories = ["Liverpool FC", "World Cup / Internationals", "Champions League", "Other"];
  const categoryData = categories.map((cat) => {
    const cs = sales.filter((s) => s.events?.categories?.name === cat);
    return {
      name: cat === "World Cup / Internationals" ? "World Cup" : cat,
      revenue: cs.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0),
    };
  }).filter((c) => c.revenue > 0);

  // Top-level stats
  const totalRevenue = sales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);
  const totalTickets = sales.reduce((acc, s) => acc + s.quantity, 0);
  const totalSales = sales.length;
  const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">All-time performance across categories & platforms</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue) },
          { label: "Total Tickets", value: totalTickets.toString() },
          { label: "Total Sales", value: totalSales.toString() },
          { label: "Avg Sale Price", value: fmt(avgPrice) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold mt-1 text-primary">{loading ? "…" : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142,72%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142,72%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,15%,20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,16%,55%)" }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,16%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222,18%,11%)", border: "1px solid hsl(222,15%,20%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`£${v.toFixed(2)}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(142,72%,50%)" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Platform vs Category row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Platform Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={platformData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,15%,20%)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,16%,55%)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,16%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(222,18%,11%)", border: "1px solid hsl(222,15%,20%)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`£${v.toFixed(2)}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {platformData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {platformData.map((p, i) => (
                    <div key={p.name} className="rounded-lg bg-secondary p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: COLORS[i] }}>{fmt(p.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{p.tickets} tickets · {p.sales} sales</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    dataKey="revenue"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CAT_COLORS[entry.name === "World Cup" ? "World Cup / Internationals" : entry.name] ?? "hsl(280,65%,60%)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(222,18%,11%)", border: "1px solid hsl(222,15%,20%)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`£${v.toFixed(2)}`, "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
