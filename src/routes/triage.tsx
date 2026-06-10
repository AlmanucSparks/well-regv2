import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/triage")({ component: TriagePage });

interface PatientLite {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  primary_phone: string;
  date_of_birth: string;
  gender: string;
  facility_id: string | null;
}

function TriagePage() {
  const { user, loading: authLoading, isAdmin, isNurse, facilityId } = useAuth();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PatientLite | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,middle_name,primary_phone,date_of_birth,gender,facility_id")
        .order("created_at", { ascending: false })
        .limit(50);
      const term = query.trim();
      if (term) {
        const like = `%${term}%`;
        q = q.or(`first_name.ilike.${like},last_name.ilike.${like},patient_code.ilike.${like},primary_phone.ilike.${like}`);
      }
      const { data } = await q;
      setPatients((data ?? []) as PatientLite[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (authLoading) return null;
  if (!isAdmin && !isNurse) return <Navigate to="/dashboard" />;

  return (
    <AppLayout title="Triage / Vitals">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h2 className="text-base font-semibold">Nurse workstation</h2>
                <p className="text-xs text-muted-foreground">Search for an existing registered patient to record vital signs.</p>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, patient code (MR-…), or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : patients.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No patients found.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {patients.map((p) => {
              const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="flex items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.patient_code} · {p.gender} · DOB {p.date_of_birth} · {p.primary_phone}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Stethoscope className="h-4 w-4" /> Record Vitals
                  </Button>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <VitalsDialog
          patient={selected}
          recorderId={user!.id}
          fallbackFacilityId={selected.facility_id ?? facilityId ?? null}
          onClose={(saved) => {
            setSelected(null);
            if (saved) toast.success("Vitals recorded");
          }}
        />
      )}
    </AppLayout>
  );
}

function VitalsDialog({
  patient,
  recorderId,
  fallbackFacilityId,
  onClose,
}: {
  patient: PatientLite;
  recorderId: string;
  fallbackFacilityId: string | null;
  onClose: (saved: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");
  const [notes, setNotes] = useState("");

  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [temp, setTemp] = useState("");

  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weight, setWeight] = useState("");

  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [heightCm, setHeightCm] = useState("");
  const [ft, setFt] = useState("");
  const [inches, setInches] = useState("");

  const name = useMemo(
    () => [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "),
    [patient],
  );

  function parseNum(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    setSaving(true);
    try {
      let temperature_c: number | null = parseNum(temp);
      if (temperature_c != null && tempUnit === "F") temperature_c = ((temperature_c - 32) * 5) / 9;

      let weight_kg: number | null = parseNum(weight);
      if (weight_kg != null && weightUnit === "lbs") weight_kg = weight_kg * 0.45359237;

      let height_cm: number | null;
      if (heightUnit === "cm") {
        height_cm = parseNum(heightCm);
      } else {
        const f = parseNum(ft) ?? 0;
        const i = parseNum(inches) ?? 0;
        height_cm = (f || i) ? (f * 30.48 + i * 2.54) : null;
      }

      const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);

      const { error } = await supabase.from("patient_vitals").insert({
        patient_id: patient.id,
        facility_id: fallbackFacilityId,
        recorded_by: recorderId,
        visit_date: new Date(visitDate).toISOString(),
        bp_systolic: parseNum(systolic),
        bp_diastolic: parseNum(diastolic),
        temperature_c: round2(temperature_c),
        weight_kg: round2(weight_kg),
        height_cm: round2(height_cm),
        pulse_bpm: parseNum(pulse),
        spo2_percent: parseNum(spo2),
        respiratory_rate: parseNum(rr),
        notes: notes.trim() || null,
      });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        user_id: recorderId,
        action: "patient.vitals.create",
        entity_type: "patient",
        entity_id: patient.patient_code,
      });

      onClose(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save vitals");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record vitals — {name}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Visit date & time</Label>
            <Input type="datetime-local" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Blood pressure (mmHg)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Systolic" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
              <span className="text-muted-foreground">/</span>
              <Input type="number" placeholder="Diastolic" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Pulse (bpm)</Label>
            <Input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Temperature</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} />
              <ToggleGroup type="single" value={tempUnit} onValueChange={(v) => v && setTempUnit(v as any)}>
                <ToggleGroupItem value="C">°C</ToggleGroupItem>
                <ToggleGroupItem value="F">°F</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Weight</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <ToggleGroup type="single" value={weightUnit} onValueChange={(v) => v && setWeightUnit(v as any)}>
                <ToggleGroupItem value="kg">kg</ToggleGroupItem>
                <ToggleGroupItem value="lbs">lbs</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Height</Label>
            <div className="flex items-center gap-2">
              {heightUnit === "cm" ? (
                <Input type="number" step="0.1" placeholder="cm" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              ) : (
                <>
                  <Input type="number" placeholder="ft" value={ft} onChange={(e) => setFt(e.target.value)} />
                  <Input type="number" placeholder="in" value={inches} onChange={(e) => setInches(e.target.value)} />
                </>
              )}
              <ToggleGroup type="single" value={heightUnit} onValueChange={(v) => v && setHeightUnit(v as any)}>
                <ToggleGroupItem value="cm">cm</ToggleGroupItem>
                <ToggleGroupItem value="ft">ft+in</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>SpO₂ (%)</Label>
            <Input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Respiratory rate (breaths/min)</Label>
            <Input type="number" value={rr} onChange={(e) => setRr(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Triage notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save vitals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}