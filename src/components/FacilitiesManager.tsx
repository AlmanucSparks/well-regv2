import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Loader2, Trash2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Facility {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  facility_id: string | null;
}

export function FacilitiesManager() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", city: "", country: "", phone: "", email: "" });

  async function reload() {
    setLoading(true);
    const [{ data: f }, { data: s }] = await Promise.all([
      supabase.from("facilities").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email,status,facility_id"),
    ]);
    setFacilities((f ?? []) as Facility[]);
    setStaff((s ?? []) as StaffRow[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("facilities").insert({
      name: form.name.trim(),
      code: form.code.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Facility added");
    setForm({ name: "", code: "", city: "", country: "", phone: "", email: "" });
    reload();
  }

  async function toggleStatus(f: Facility) {
    const next = f.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("facilities").update({ status: next }).eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success(`Facility ${next}`);
    reload();
  }

  async function remove(f: Facility) {
    if (!confirm(`Delete facility "${f.name}"? Staff and patients linked to it will be unlinked.`)) return;
    const { error } = await supabase.from("facilities").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Facility removed");
    reload();
  }

  async function assignStaff(staffId: string, facilityId: string | null) {
    const { error } = await supabase
      .from("profiles")
      .update({ facility_id: facilityId })
      .eq("id", staffId);
    if (error) return toast.error(error.message);
    toast.success("Assignment updated");
    reload();
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Multi-Facility Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={create} className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-6">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Facility name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Downtown Clinic" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DT-01" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Country</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-5 space-y-1.5">
            <Label className="text-xs">Contact email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Button type="submit" disabled={creating} className="sm:col-span-1 sm:self-end gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </Button>
        </form>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : facilities.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No facilities yet. Add one above.
          </p>
        ) : (
          <div className="space-y-4">
            {facilities.map((f) => {
              const assigned = staff.filter((s) => s.facility_id === f.id);
              const unassigned = staff.filter((s) => !s.facility_id);
              return (
                <div key={f.id} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{f.name}</h4>
                        {f.code && <Badge variant="outline" className="font-mono text-[10px]">{f.code}</Badge>}
                        <Badge variant={f.status === "active" ? "default" : "secondary"} className="capitalize">{f.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[f.city, f.country].filter(Boolean).join(", ") || "—"} · {f.phone || "no phone"} · {f.email || "no email"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(f)} className="gap-1">
                        {f.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {f.status === "active" ? "Suspend" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(f)} className="gap-1 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Staff assigned ({assigned.length})
                    </p>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No staff assigned.</p>
                    ) : (
                      <ul className="space-y-1">
                        {assigned.map((s) => (
                          <li key={s.id} className="flex items-center justify-between text-xs">
                            <span>{s.full_name || s.email}</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => assignStaff(s.id, null)}>
                              Unassign
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {unassigned.length > 0 && (
                      <div className="mt-2">
                        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Assign existing staff</p>
                        <div className="flex flex-wrap gap-1">
                          {unassigned.map((s) => (
                            <Button
                              key={s.id}
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => assignStaff(s.id, f.id)}
                            >
                              + {s.full_name || s.email}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
