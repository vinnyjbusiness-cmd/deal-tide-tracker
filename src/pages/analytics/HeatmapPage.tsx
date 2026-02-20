import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { useAnalyticsData, type TeamTab } from "@/hooks/useAnalyticsData";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

type BubbleMetric = "tickets" | "orders" | "avg_price";

interface EventBubble {
  id: string;
  name: string;
  shortName: string;
  revenue: number;
  units: number;
  orders: number;
  avgPrice: number;
  revenueShare: number;
  change: number;
  category: string;
  date: string | null;
}

export default function HeatmapPage() {
  const [teamTab, setTeamTab] = useState<TeamTab>("all");
  const [metric, setMetric] = useState<BubbleMetric>("tickets");
  const [hovered, setHovered] = useState<string | null>(null);
  const { sales, loading, updatedAt, refetch } = useAnalyticsData(teamTab);

  const bubbles = useMemo((): EventBubble[] => {
    const map: Record<string, { name: string; revenue: number; units: number; orders: number; category: string; date: string | null }> = {};

    sales.forEach((s) => {
      const id = s.event_id ?? "unknown";
      const name = s.events?.name ?? "Unknown";
      if (!map[id]) map[id] = { name, revenue: 0, units: 0, orders: 0, category: s.events?.categories?.name ?? "", date: s.events?.event_date ?? null };
      map[id].revenue += s.ticket_price * s.quantity;
      map[id].units += s.quantity;
      map[id].orders += 1;
    });

    const entries = Object.entries(map).map(([id, d]) => ({
      id,
      name: d.name,
      shortName: d.name.length > 22 ? d.name.slice(0, 20) + "…" : d.name,
      revenue: d.revenue,
      units: d.units,
      orders: d.orders,
      avgPrice: d.units > 0 ? d.revenue / d.units : 0,
      revenueShare: 0,
      change: 0,
      category: d.category,
      date: d.date,
    }));

    // Size is ALWAYS based on units sold
    const maxUnits = Math.max(...entries.map((e) => e.units), 1);
    const maxAvg = Math.max(...entries.map((e) => e.avgPrice), 1);

    // Global median avg price for colour signal
    const sorted = [...entries].sort((a, b) => a.avgPrice - b.avgPrice);
    const globalMedian = sorted.length ? sorted[Math.floor(sorted.length / 2)].avgPrice : 0;

    return entries
      .map((e) => {
        // Size always = units share; metric selector only changes the displayed label value
        const sizeNorm = e.units / maxUnits;
        const change = ((e.avgPrice - globalMedian) / (globalMedian || 1)) * 100;
        return { ...e, revenueShare: sizeNorm, change };
      })
      .sort((a, b) => b.revenueShare - a.revenueShare)
      .slice(0, 40);
  }, [sales, metric]);

  function getBubbleStyle(b: EventBubble) {
    const norm = b.revenueShare;
    const isPositive = b.change >= 0;
    // Green spectrum for positive, red for negative
    if (isPositive) {
      const l = 12 + norm * 22;
      return {
        background: `hsl(142, 65%, ${l}%)`,
        border: `1.5px solid hsl(142, 65%, ${l + 12}%)`,
        boxShadow: `0 0 ${8 + norm * 20}px hsl(142, 65%, ${l + 6}% / 0.4)`,
      };
    } else {
      const l = 12 + norm * 22;
      return {
        background: `hsl(0, 65%, ${l}%)`,
        border: `1.5px solid hsl(0, 65%, ${l + 12}%)`,
        boxShadow: `0 0 ${8 + norm * 20}px hsl(0, 65%, ${l + 6}% / 0.4)`,
      };
    }
  }

  // Variable font size & min-size based on relative value
  function getFontSize(norm: number) {
    return Math.max(9, Math.round(9 + norm * 10));
  }

  function getTileSize(norm: number): string {
    // Map to grid cell span roughly — we'll use inline width/height
    const px = Math.round(80 + norm * 160);
    return `${px}px`;
  }

  const metricBtns: { id: BubbleMetric; label: string }[] = [
    { id: "tickets", label: "Tickets Sold" },
    { id: "orders", label: "Orders" },
    { id: "avg_price", label: "Avg Price" },
  ];

  const metricLabel = (b: EventBubble) => {
    if (metric === "tickets") return `${b.units} tickets`;
    if (metric === "orders") return `${b.orders} orders`;
    return fmt(b.avgPrice);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Market Map
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bubble size = tickets sold · Colour = {metric === "tickets" ? "tickets sold" : metric === "orders" ? "orders" : "avg price"} · Green = above median price · Red = below median
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AnalyticsTabs active={teamTab} onChange={setTeamTab} />
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
            {metricBtns.map((b) => (
              <button
                key={b.id}
                onClick={() => setMetric(b.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  metric === b.id ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bubble canvas */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="rounded-xl" style={{ width: `${80 + Math.random() * 100}px`, height: `${80 + Math.random() * 100}px` }} />
            ))}
          </div>
        ) : bubbles.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No data available for this selection.
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-6 mb-5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "hsl(142,65%,28%)" }} />
                Above median price
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "hsl(0,65%,28%)" }} />
                Below median price
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <span>Larger bubble = more {metric === "tickets" ? "tickets sold" : metric === "orders" ? "orders" : "avg price"}</span>
              </div>
            </div>

            {/* Bubbles */}
            <div className="flex flex-wrap gap-3 content-start">
              {bubbles.map((b) => {
                const size = getTileSize(b.revenueShare);
                const fs = getFontSize(b.revenueShare);
                const isHovered = hovered === b.id;
                const isPos = b.change >= 0;

                return (
                  <div
                    key={b.id}
                    onMouseEnter={() => setHovered(b.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="relative rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center overflow-hidden"
                    style={{
                      width: size,
                      height: size,
                      minWidth: "80px",
                      minHeight: "80px",
                      ...getBubbleStyle(b),
                      transform: isHovered ? "scale(1.06)" : "scale(1)",
                      zIndex: isHovered ? 10 : 1,
                    }}
                  >
                    {/* Hover tooltip overlay */}
                    {isHovered && (
                      <div
                        className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-1 p-2"
                        style={{ background: "hsl(0,0%,5%/0.92)", backdropFilter: "blur(4px)" }}
                      >
                        <span className="text-foreground font-semibold leading-tight" style={{ fontSize: "10px" }}>
                          {b.name}
                        </span>
                        <div className="flex flex-col gap-0.5 text-center mt-1">
                          <span className="text-muted-foreground" style={{ fontSize: "9px" }}>Tickets Sold</span>
                          <span className="text-foreground font-bold" style={{ fontSize: "11px" }}>{b.units} tickets</span>
                          <span className="text-muted-foreground" style={{ fontSize: "9px" }}>{b.orders} orders · Avg {fmt(b.avgPrice)}</span>
                        </div>
                        <div className={`flex items-center gap-0.5 mt-1 ${isPos ? "text-green-400" : "text-red-400"}`} style={{ fontSize: "10px" }}>
                          {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isPos ? "+" : ""}{b.change.toFixed(1)}% vs median
                        </div>
                        {b.date && (
                          <span className="text-muted-foreground" style={{ fontSize: "9px" }}>
                            {format(new Date(b.date), "d MMM yyyy")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Default content */}
                    {!isHovered && (
                      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
                        <span
                          className="font-semibold text-white/90 leading-tight text-center break-words"
                          style={{ fontSize: `${fs}px` }}
                        >
                          {b.shortName}
                        </span>
                        <span
                          className="font-bold text-white"
                          style={{ fontSize: `${fs + 1}px` }}
                        >
                          {metricLabel(b)}
                        </span>
                        <div
                          className={`flex items-center gap-0.5 font-medium ${isPos ? "text-green-300" : "text-red-300"}`}
                          style={{ fontSize: `${Math.max(8, fs - 2)}px` }}
                        >
                          {isPos ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {isPos ? "+" : ""}{b.change.toFixed(1)}%
                        </div>
                        {b.date && (
                          <span className="text-white/60 leading-tight" style={{ fontSize: `${Math.max(8, fs - 2)}px` }}>
                            {format(new Date(b.date), "d MMM yy")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
