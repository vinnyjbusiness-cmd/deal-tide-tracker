import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DollarSign, Ticket, TrendingUp, ShoppingCart, LogOut } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";

interface SaleSummary {
  total_revenue: number;
  total_tickets: number;
  total_sales: number;
  avg_price: number;
}

interface RecentSale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  events: { name: string } | null;
}

interface ChartPoint { date: string; revenue: number; count: number }
interface PlatformPoint { name: string; value: number }

const COLORS = ["hsl(142,72%,50%)", "hsl(200,80%,55%)"];

export default function Index() {
  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [platformData, setPlatformData] = useState<PlatformPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all sales with event info
      const { data: sales, error } = await supabase
        .from("sales")
        .select("*, events(name)")
        .order("sold_at", { ascending: false });

      if (error) throw error;

      // Summary stats
      const totalRevenue = sales?.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0) ?? 0;
      const totalTickets = sales?.reduce((acc, s) => acc + s.quantity, 0) ?? 0;
      const totalSales = sales?.length ?? 0;
      const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0;

      setSummary({ total_revenue: totalRevenue, total_tickets: totalTickets, total_sales: totalSales, avg_price: avgPrice });
      setRecentSales((sales ?? []).slice(0, 15) as RecentSale[]);

      // Revenue chart — last 30 days
      const days: ChartPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const day = startOfDay(subDays(new Date(), i));
        const dayStr = format(day, "MMM d");
        const daySales = sales?.filter((s) => {
          const saleDay = startOfDay(new Date(s.sold_at));
          return saleDay.getTime() === day.getTime();
        }) ?? [];
        const revenue = daySales.reduce((acc, s) => acc + s.ticket_price * s.quantity, 0);
        days.push({ date: dayStr, revenue, count: daySales.length });
      }
      setChartData(days);

      // Platform breakdown
      const lft = sales?.filter((s) => s.platform === "LiveFootballTickets").reduce((acc, s) => acc + s.ticket_price * s.quantity, 0) ?? 0;
      const tix = sales?.filter((s) => s.platform === "Tixstock").reduce((acc, s) => acc + s.ticket_price * s.quantity, 0) ?? 0;
      setPlatformData([
        { name: "LiveFootballTickets", value: lft },
        { name: "Tixstock", value: tix },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel("dashboard-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const statCards = [
    { title: "Total Revenue", value: summary ? fmt(summary.total_revenue) : "—", icon: DollarSign, color: "text-primary" },
    { title: "Total Tickets Sold", value: summary?.total_tickets.toLocaleString() ?? "—", icon: Ticket, color: "text-chart-2" },
    { title: "Number of Sales", value: summary?.total_sales.toLocaleString() ?? "—", icon: ShoppingCart, color: "text-chart-4" },
    { title: "Avg Ticket Price", value: summary ? fmt(summary.avg_price) : "—", icon: TrendingUp, color: "text-chart-3" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Football Ticket Sales Overview</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.title}</p>
                    <p className="text-2xl font-bold mt-1 text-foreground">{card.value}</p>
                  </div>
                  <div className={`${card.color} p-2 rounded-lg bg-secondary`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
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

        {/* Platform Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={platformData} cx="50%" cy="45%" outerRadius={72} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {platformData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: "hsl(215,16%,55%)" }} />
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

      {/* Recent Sales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No sales yet. Add your first sale!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Event</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Section</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Qty</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Price</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Platform</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, i) => (
                    <tr key={sale.id} className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-[180px]">{sale.events?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.section ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sale.quantity}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{fmt(sale.ticket_price)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={sale.platform === "LiveFootballTickets" ? "text-primary border-primary/30" : "text-chart-2 border-chart-2/30"}>
                          {sale.platform === "LiveFootballTickets" ? "LFT" : "Tixstock"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(sale.sold_at), "dd MMM yy, HH:mm")}</td>
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
