import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Layers } from "lucide-react";
import { format } from "date-fns";
import { useAnalyticsData, type TeamTab } from "@/hooks/useAnalyticsData";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

type HeatMetric = "avg_price" | "total_units" | "revenue";

export default function HeatmapPage() {
  const [teamTab, setTeamTab] = useState<TeamTab>("all");
  const [metric, setMetric] = useState<HeatMetric>("avg_price");
  const { sales, loading, updatedAt, refetch } = useAnalyticsData(teamTab);

  // Build section × event matrix
  const { sections, events, matrix, maxVal, minVal } = useMemo(() => {
    const sectionSet = new Set<string>();
    const eventSet = new Set<string>();
    const data: Record<string, Record<string, { sum_price: number; units: number; count: number }>> = {};

    sales.forEach((s) => {
      const sec = s.section ?? "Unknown";
      const ev = s.events?.name ?? "Unknown";
      sectionSet.add(sec);
      eventSet.add(ev);
      if (!data[sec]) data[sec] = {};
      if (!data[sec][ev]) data[sec][ev] = { sum_price: 0, units: 0, count: 0 };
      data[sec][ev].sum_price += s.ticket_price * s.quantity;
      data[sec][ev].units += s.quantity;
      data[sec][ev].count += 1;
    });

    const sections = [...sectionSet].sort();
    // Limit events to top 12 by total revenue
    const evRevenue: Record<string, number> = {};
    sales.forEach((s) => {
      const ev = s.events?.name ?? "Unknown";
      evRevenue[ev] = (evRevenue[ev] ?? 0) + s.ticket_price * s.quantity;
    });
    const events = [...eventSet].sort((a, b) => (evRevenue[b] ?? 0) - (evRevenue[a] ?? 0)).slice(0, 12);

    const matrix: Record<string, Record<string, number | null>> = {};
    sections.forEach((sec) => {
      matrix[sec] = {};
      events.forEach((ev) => {
        const cell = data[sec]?.[ev];
        if (!cell || cell.count === 0) { matrix[sec][ev] = null; return; }
        if (metric === "avg_price") matrix[sec][ev] = cell.units > 0 ? cell.sum_price / cell.units : 0;
        else if (metric === "total_units") matrix[sec][ev] = cell.units;
        else matrix[sec][ev] = cell.sum_price;
      });
    });

    const allVals = sections.flatMap((s) => events.map((e) => matrix[s][e])).filter((v): v is number => v !== null);
    const maxVal = allVals.length ? Math.max(...allVals) : 1;
    const minVal = allVals.length ? Math.min(...allVals) : 0;

    return { sections, events, matrix, maxVal, minVal };
  }, [sales, metric]);

  function getColor(val: number | null): string {
    if (val === null) return "hsl(0,0%,10%)";
    const range = maxVal - minVal || 1;
    const norm = (val - minVal) / range;
    // green for high, amber for mid, red for low
    if (norm > 0.7) return `hsl(142,72%,${20 + norm * 25}%)`;
    if (norm > 0.35) return `hsl(32,90%,${20 + norm * 25}%)`;
    return `hsl(0,72%,${15 + norm * 20}%)`;
  }

  function formatVal(val: number | null): string {
    if (val === null) return "—";
    if (metric === "avg_price" || metric === "revenue") return fmt(val);
    return String(Math.round(val));
  }

  const metricBtns: { id: HeatMetric; label: string }[] = [
    { id: "avg_price", label: "Avg Price" },
    { id: "total_units", label: "Units Sold" },
    { id: "revenue", label: "Revenue" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Price Heatmap
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Section vs Event · colour intensity = {metric === "avg_price" ? "average price" : metric === "total_units" ? "units sold" : "revenue"}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated {format(updatedAt, "HH:mm")}</span>
            <Button variant="outline" size="sm" onClick={refetch}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AnalyticsTabs active={teamTab} onChange={setTeamTab} />
          <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
            {metricBtns.map((b) => (
              <button key={b.id} onClick={() => setMetric(b.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${metric === b.id ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : sections.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available for this selection.</div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Section × Game Heatmap</span>
                <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ background: "hsl(0,72%,25%)" }} />Low
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ background: "hsl(32,90%,35%)" }} />Mid
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ background: "hsl(142,72%,40%)" }} />High
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card z-10 px-4 py-2 text-left font-bold text-muted-foreground border-b border-r border-border min-w-[120px]">Section</th>
                    {events.map((ev) => (
                      <th key={ev} className="px-2 py-2 font-medium text-muted-foreground border-b border-border whitespace-nowrap max-w-[100px] truncate" title={ev}>
                        {ev.length > 18 ? ev.slice(0, 16) + "…" : ev}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <tr key={sec} className="border-b border-border/50">
                      <td className="sticky left-0 bg-card z-10 px-4 py-2 font-medium text-foreground border-r border-border whitespace-nowrap">{sec}</td>
                      {events.map((ev) => {
                        const val = matrix[sec]?.[ev] ?? null;
                        return (
                          <td key={ev} className="px-2 py-2 text-center min-w-[80px]">
                            <div
                              className="rounded px-1 py-1 font-semibold transition-all"
                              style={{
                                background: getColor(val),
                                color: val !== null ? "hsl(0,0%,95%)" : "hsl(0,0%,35%)",
                                fontSize: "11px",
                              }}
                            >
                              {formatVal(val)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
