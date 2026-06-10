import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface Vital {
  id: string;
  visit_date: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  temperature_c: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  pulse_bpm: number | null;
  spo2_percent: number | null;
  respiratory_rate: number | null;
  notes: string | null;
  created_at: string;
}

export function PatientVitalsHistory({ patientId }: { patientId: string }) {
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("patient_vitals")
        .select("*")
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });
      setVitals((data ?? []) as Vital[]);
      setLoading(false);
    })();
  }, [patientId]);

  if (loading)
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  if (vitals.length === 0)
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No vitals recorded yet.
        </CardContent>
      </Card>
    );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">BP</th>
            <th className="px-3 py-2 text-left">Temp °C</th>
            <th className="px-3 py-2 text-left">Pulse</th>
            <th className="px-3 py-2 text-left">SpO₂</th>
            <th className="px-3 py-2 text-left">RR</th>
            <th className="px-3 py-2 text-left">Wt kg</th>
            <th className="px-3 py-2 text-left">Ht cm</th>
            <th className="px-3 py-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((v, i) => (
            <tr key={v.id} className={i === 0 ? "bg-primary/5 font-medium" : "border-t"}>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {i === 0 && <Activity className="h-3 w-3 text-primary" />}
                  {format(new Date(v.visit_date), "PPp")}
                </div>
              </td>
              <td className="px-3 py-2">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</td>
              <td className="px-3 py-2">{v.temperature_c ?? "—"}</td>
              <td className="px-3 py-2">{v.pulse_bpm ?? "—"}</td>
              <td className="px-3 py-2">{v.spo2_percent != null ? `${v.spo2_percent}%` : "—"}</td>
              <td className="px-3 py-2">{v.respiratory_rate ?? "—"}</td>
              <td className="px-3 py-2">{v.weight_kg ?? "—"}</td>
              <td className="px-3 py-2">{v.height_cm ?? "—"}</td>
              <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">{v.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}