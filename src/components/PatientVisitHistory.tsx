import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFacilities } from "@/lib/use-facilities";

interface Visit {
  id: string;
  visit_date: string;
  reason: string;
  notes: string | null;
  facility_id: string | null;
  recorded_by: string;
  created_at: string;
}

export function PatientVisitHistory({ patientId, patientCode, defaultFacilityId }: { patientId: string; patientCode: string; defaultFacilityId?: string | null }) {
  const { user, isAdmin, isSupervisor, isRegistrar, facilityId: userFacilityId } = useAuth();
  const { facilities } = useFacilities();
  const canAdd = isAdmin || isSupervisor || isRegistrar;

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [facility, setFacility] = useState<string>(defaultFacilityId ?? userFacilityId ?? "");
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("patient_visits")
      .select("id,visit_date,reason,notes,facility_id,recorded_by,created_at")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false });
    setVisits((data ?? []) as Visit[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [patientId]);

  async function submit() {
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("patient_visits").insert({
        patient_id: patientId,
        facility_id: facility || null,
        visit_date: new Date(visitDate).toISOString(),
        reason: reason.trim(),
        notes: notes.trim() || null,
        recorded_by: user.id,
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "patient.visit.create",
        entity_type: "patient",
        entity_id: patientCode,
      });
      toast.success("Visit recorded");
      setReason(""); setNotes(""); setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record visit");
    } finally {
      setSaving(false);
    }
  }

  const facilityName = (id: string | null) => facilities.find((f) => f.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Visit History</h3>
          <p className="text-xs text-muted-foreground">Chronological record of patient encounters.</p>
        </div>
        {canAdd && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Visit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record new visit</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Facility</Label>
                  <Select value={facility} onValueChange={setFacility}>
                    <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
                    <SelectContent>
                      {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Visit date</Label>
                  <Input type="datetime-local" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason for visit</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Follow-up consultation" />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save visit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visits.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No visits recorded yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {format(new Date(v.visit_date), "PPp")}
                    </div>
                    <div className="mt-1 text-sm">{v.reason}</div>
                    {v.notes && <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{v.notes}</div>}
                  </div>
                  <div className="text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                    {facilityName(v.facility_id)}
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