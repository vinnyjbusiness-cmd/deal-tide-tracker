import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Upload, X } from "lucide-react";

const saleSchema = z.object({
  event_id: z.string().min(1, "Please select an event"),
  section: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  ticket_price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  platform: z.enum(["LiveFootballTickets", "Tixstock"]),
  sold_at: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type SaleFormData = z.infer<typeof saleSchema>;

interface EventOption { id: string; name: string; categories: { name: string } | null }

export default function AddSalePage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvParsed, setCsvParsed] = useState<string[][] | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      sold_at: new Date().toISOString().slice(0, 16),
      quantity: 1,
    },
  });

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("id, name, categories(name)").order("name");
      setEvents((data as EventOption[]) ?? []);
      setLoadingEvents(false);
    };
    fetchEvents();
  }, []);

  const onSubmit = async (data: SaleFormData) => {
    setSubmitting(true);
    const { error } = await supabase.from("sales").insert({
      event_id: data.event_id,
      section: data.section || null,
      quantity: data.quantity,
      ticket_price: data.ticket_price,
      platform: data.platform,
      sold_at: new Date(data.sold_at).toISOString(),
      notes: data.notes || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sale added!", description: "The sale has been recorded successfully." });
      reset({ sold_at: new Date().toISOString().slice(0, 16), quantity: 1 });
    }
    setSubmitting(false);
  };

  const parseCsv = () => {
    const lines = csvText.trim().split("\n").filter((l) => l.trim());
    const rows = lines.map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    setCsvParsed(rows);
  };

  const importCsv = async () => {
    if (!csvParsed) return;
    setImportingCsv(true);
    const rows = csvParsed.slice(1); // skip header
    let success = 0;
    for (const row of rows) {
      const [eventName, , section, quantity, price, platform, dateStr] = row;
      const ev = events.find((e) => e.name.toLowerCase() === eventName?.toLowerCase());
      if (!ev) continue;
      const plt = platform === "LFT" || platform === "LiveFootballTickets" ? "LiveFootballTickets" : "Tixstock";
      await supabase.from("sales").insert({
        event_id: ev.id,
        section: section || null,
        quantity: parseInt(quantity) || 1,
        ticket_price: parseFloat(price) || 0,
        platform: plt,
        sold_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      });
      success++;
    }
    toast({ title: "Import complete", description: `${success} sales imported.` });
    setCsvText("");
    setCsvParsed(null);
    setImportingCsv(false);
  };

  const platformValue = watch("platform");

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add Sale</h1>
        <p className="text-sm text-muted-foreground">Manually log a sale or bulk import via CSV</p>
      </div>

      {/* Manual Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><PlusCircle className="h-4 w-4 text-primary" />Manual Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Event</Label>
              {loadingEvents ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select onValueChange={(v) => setValue("event_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name} {ev.categories ? `(${ev.categories.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.event_id && <p className="text-xs text-destructive">{errors.event_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="section">Section / Block</Label>
                <Input id="section" placeholder="e.g. Block L4" {...register("section")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" min={1} {...register("quantity")} />
                {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ticket_price">Ticket Price (£)</Label>
                <Input id="ticket_price" type="number" step="0.01" min="0" {...register("ticket_price")} />
                {errors.ticket_price && <p className="text-xs text-destructive">{errors.ticket_price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select onValueChange={(v) => setValue("platform", v as "LiveFootballTickets" | "Tixstock")}>
                  <SelectTrigger className={platformValue ? "" : "text-muted-foreground"}>
                    <SelectValue placeholder="Select platform…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LiveFootballTickets">LiveFootballTickets</SelectItem>
                    <SelectItem value="Tixstock">Tixstock</SelectItem>
                  </SelectContent>
                </Select>
                {errors.platform && <p className="text-xs text-destructive">{errors.platform.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sold_at">Date & Time Sold</Label>
              <Input id="sold_at" type="datetime-local" {...register("sold_at")} />
              {errors.sold_at && <p className="text-xs text-destructive">{errors.sold_at.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" placeholder="Any extra details…" {...register("notes")} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Add Sale"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Bulk CSV Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Expected columns: <code className="bg-secondary px-1 py-0.5 rounded text-xs">Event Name, Category, Section, Quantity, Price, Platform (LFT or Tixstock), Date (YYYY-MM-DD HH:mm)</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`Event Name,Category,Section,Quantity,Price,Platform,Date\nLiverpool vs Arsenal,Liverpool FC,Block L4,2,125.00,LFT,2025-04-05 19:30`}
            className="w-full h-36 bg-input border border-border rounded-md text-xs p-3 font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={parseCsv} disabled={!csvText.trim()}>
              Preview
            </Button>
            {csvParsed && (
              <>
                <Button size="sm" onClick={importCsv} disabled={importingCsv}>
                  {importingCsv ? "Importing…" : `Import ${csvParsed.length - 1} rows`}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setCsvParsed(null); setCsvText(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {csvParsed && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {csvParsed[0].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvParsed.slice(1, 6).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {row.map((cell, j) => <td key={j} className="px-3 py-2 text-foreground">{cell}</td>)}
                    </tr>
                  ))}
                  {csvParsed.length > 7 && (
                    <tr>
                      <td colSpan={csvParsed[0].length} className="px-3 py-2 text-muted-foreground italic">…and {csvParsed.length - 7} more rows</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
