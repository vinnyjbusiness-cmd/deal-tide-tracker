import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsSale {
  id: string;
  sold_at: string;
  ticket_price: number;
  quantity: number;
  platform: string;
  section: string | null;
  event_id: string | null;
  events: { id: string; name: string; event_date: string | null; categories: { name: string } | null } | null;
}

export type TeamTab = "all" | "liverpool" | "arsenal" | "world-cup";

export function useAnalyticsData(teamTab: TeamTab) {
  const [sales, setSales] = useState<AnalyticsSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("id, sold_at, ticket_price, quantity, platform, section, event_id, events(id, name, event_date, categories(name))")
      .order("sold_at", { ascending: false })
      .limit(2000);

    let all = (data ?? []) as unknown as AnalyticsSale[];

    if (teamTab === "liverpool") {
      all = all.filter((s) => s.events?.categories?.name?.toLowerCase().includes("liverpool") || s.events?.name?.toLowerCase().includes("liverpool"));
    } else if (teamTab === "arsenal") {
      all = all.filter((s) => s.events?.categories?.name?.toLowerCase().includes("arsenal") || s.events?.name?.toLowerCase().includes("arsenal"));
    } else if (teamTab === "world-cup") {
      all = all.filter((s) => s.events?.categories?.name?.toLowerCase().includes("world") || s.events?.name?.toLowerCase().includes("world"));
    }

    setSales(all);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [teamTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { sales, loading, updatedAt, refetch: fetchData };
}
