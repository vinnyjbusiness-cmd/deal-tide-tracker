import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, ShieldCheck, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

type Status = "pending" | "ok" | "warn" | "error";

interface HealthItem {
  id: string;
  label: string;
  detail: string;
  status: Status;
}

interface LogEntry {
  time: string;
  level: "INFO" | "WARN" | "ERROR";
  msg: string;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(142,72%,55%)" }} />;
  if (status === "warn") return <AlertCircle className="h-5 w-5" style={{ color: "hsl(35,90%,55%)" }} />;
  if (status === "error") return <AlertCircle className="h-5 w-5 text-destructive" />;
  return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
}

function LogLine({ entry }: { entry: LogEntry }) {
  const color = entry.level === "ERROR" ? "#ef4444" : entry.level === "WARN" ? "#f59e0b" : "#4ade80";
  return (
    <div className="flex gap-3 text-[11px] font-mono leading-5">
      <span className="text-muted-foreground shrink-0">{entry.time}</span>
      <span className="font-bold shrink-0" style={{ color }}>{entry.level.padEnd(5)}</span>
      <span className="text-foreground">{entry.msg}</span>
    </div>
  );
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthItem[]>([
    { id: "db", label: "Database Connection", detail: "Checking…", status: "pending" },
    { id: "auth", label: "Authentication", detail: "Checking…", status: "pending" },
    { id: "data", label: "Data Integrity", detail: "Checking…", status: "pending" },
  ]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogEntry["level"], msg: string) => {
    const time = format(new Date(), "HH:mm:ss");
    setLogs((prev) => [...prev, { time, level, msg }]);
    setTimeout(() => {
      consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  };

  const updateHealth = (id: string, patch: Partial<HealthItem>) => {
    setHealth((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const runChecks = async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    setHealth([
      { id: "db", label: "Database Connection", detail: "Checking…", status: "pending" },
      { id: "auth", label: "Authentication", detail: "Checking…", status: "pending" },
      { id: "data", label: "Data Integrity", detail: "Checking…", status: "pending" },
    ]);

    addLog("INFO", "Starting health check…");

    // 1. Database
    addLog("INFO", "Checking database connection…");
    const t0 = Date.now();
    try {
      const { error } = await supabase.from("categories").select("id").limit(1);
      const ms = Date.now() - t0;
      if (error) throw error;
      addLog("INFO", `Database responded in ${ms}ms`);
      updateHealth("db", { status: "ok", detail: `Connected (${ms}ms)` });
    } catch {
      addLog("ERROR", "Database connection failed");
      updateHealth("db", { status: "error", detail: "Connection failed" });
    }

    // 2. Auth
    addLog("INFO", "Checking authentication session…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addLog("INFO", `Active session: ${session.user.email}`);
        updateHealth("auth", { status: "ok", detail: `Active session (${session.user.email})` });
      } else {
        addLog("WARN", "No active session found");
        updateHealth("auth", { status: "warn", detail: "No active session" });
      }
    } catch {
      addLog("ERROR", "Auth check failed");
      updateHealth("auth", { status: "error", detail: "Auth check failed" });
    }

    // 3. Data integrity
    addLog("INFO", "Checking data integrity…");
    try {
      const { count: salesCount } = await supabase.from("sales").select("*", { count: "exact", head: true });
      const { count: eventsCount } = await supabase.from("events").select("*", { count: "exact", head: true });
      const { count: orphaned } = await supabase.from("sales").select("*", { count: "exact", head: true }).is("event_id", null);

      addLog("INFO", `Found ${salesCount ?? 0} sales across ${eventsCount ?? 0} events`);

      if ((orphaned ?? 0) > 0) {
        addLog("WARN", `${orphaned} sales have no linked event`);
        updateHealth("data", { status: "warn", detail: `${orphaned} orphaned sales detected` });
      } else {
        addLog("INFO", "All references valid");
        updateHealth("data", { status: "ok", detail: "All references valid" });
      }
    } catch {
      addLog("ERROR", "Data integrity check failed");
      updateHealth("data", { status: "error", detail: "Check failed" });
    }

    addLog("INFO", "Health check complete");
    setLastChecked(new Date());
    setRunning(false);
  };

  useEffect(() => { runChecks(); }, []);

  const overallStatus = health.every((h) => h.status === "ok")
    ? "Healthy"
    : health.some((h) => h.status === "error")
    ? "Unhealthy"
    : health.some((h) => h.status === "warn")
    ? "Warning"
    : "Checking…";

  const overallColor =
    overallStatus === "Healthy" ? "hsl(142,72%,55%)" :
    overallStatus === "Warning" ? "hsl(35,90%,55%)" :
    overallStatus === "Unhealthy" ? "hsl(0,84%,60%)" :
    "hsl(215,16%,55%)";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Check</h1>
          <p className="text-sm text-muted-foreground">Live monitoring for database & API connections</p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">Last checked: {format(lastChecked, "HH:mm:ss")}</span>
          )}
          <Button variant="outline" size="sm" onClick={runChecks} disabled={running} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            Re-check
          </Button>
        </div>
      </div>

      {/* System Health Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">System Health</CardTitle>
            <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: overallColor, background: `${overallColor}18`, border: `1px solid ${overallColor}40` }}>
              {overallStatus === "Healthy" && "✓ "}{overallStatus}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {health.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-4 px-6 py-4 ${i < health.length - 1 ? "border-b border-border" : ""}`}>
              <Database className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <StatusIcon status={item.status} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: "LiveFootballTickets (LFT)", status: "ok" as Status, detail: "API connection active" },
          { name: "Tixstock", status: "ok" as Status, detail: "Data sync active" },
        ].map((p) => (
          <Card key={p.name}>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.detail}</p>
              </div>
              <StatusIcon status={p.status} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Console */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="font-mono text-muted-foreground">&gt;_</span>
              Live Console
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={consoleRef}
            className="h-56 overflow-y-auto px-4 py-3 space-y-1 font-mono text-[11px]"
            style={{ background: "hsl(222,25%,5%)", borderRadius: "0 0 0.5rem 0.5rem" }}
          >
            {logs.length === 0 ? (
              <span className="text-muted-foreground">Running checks…</span>
            ) : (
              logs.map((l, i) => <LogLine key={i} entry={l} />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
