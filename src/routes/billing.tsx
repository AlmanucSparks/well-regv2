import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Search, Printer, Eye, Ban, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFacilities } from "@/lib/use-facilities";

const search = z.object({
  patientId: z.string().uuid().optional(),
}).partial();

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  validateSearch: search.parse,
});

type PaymentMethod = "cash" | "mpesa" | "insurance" | "bank";
type Status = "draft" | "paid" | "cancelled";

interface PatientLite {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  primary_phone: string;
  facility_id: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  patient_id: string;
  facility_id: string | null;
  line_items: LineItem[];
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  payment_method: PaymentMethod | null;
  mpesa_reference: string | null;
  insurance_scheme: string | null;
  insurance_auth_code: string | null;
  bank_reference: string | null;
  status: Status;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

function fullName(p?: PatientLite | null) {
  if (!p) return "—";
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
}

function fmtKES(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(n || 0);
}

function BillingPage() {
  const { patientId } = Route.useSearch();
  const { user, loading: authLoading, isAdmin, isSupervisor, isRegistrar, isSuperAdmin } = useAuth();
  const canAccess = isAdmin || isSupervisor || isRegistrar || isSuperAdmin;
  const [tab, setTab] = useState<"new" | "history">(patientId ? "new" : "new");

  if (authLoading) return null;
  if (!canAccess) {
    return (
      <AppLayout title="Billing">
        <p className="text-sm text-muted-foreground">You don't have access to billing.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Billing">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="new">New Invoice</TabsTrigger>
          <TabsTrigger value="history">Invoice History</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <NewInvoiceTab initialPatientId={patientId} userId={user!.id} />
        </TabsContent>
        <TabsContent value="history">
          <InvoiceHistoryTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

/* -------------------- NEW INVOICE TAB -------------------- */

function NewInvoiceTab({ initialPatientId, userId }: { initialPatientId?: string; userId: string }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PatientLite | null>(null);
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [discount, setDiscount] = useState("0");
  const [taxPercent, setTaxPercent] = useState("0");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [mpesaRef, setMpesaRef] = useState("");
  const [insScheme, setInsScheme] = useState("");
  const [insAuth, setInsAuth] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Preload patient from URL
  useEffect(() => {
    if (!initialPatientId) return;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,middle_name,primary_phone,facility_id")
        .eq("id", initialPatientId)
        .maybeSingle();
      if (data) setSelected(data as PatientLite);
    })();
  }, [initialPatientId]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [items],
  );
  const discountN = Number(discount) || 0;
  const taxN = Number(taxPercent) || 0;
  const taxable = Math.max(subtotal - discountN, 0);
  const taxAmount = (taxable * taxN) / 100;
  const grand = taxable + taxAmount;

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[i], ...patch };
      merged.total = (Number(merged.quantity) || 0) * (Number(merged.unit_price) || 0);
      next[i] = merged;
      return next;
    });
  }
  function addItem() {
    setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  }
  function removeItem(i: number) {
    setItems((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  }

  async function save(asPaid: boolean) {
    if (!selected) return toast.error("Select a patient first");
    const cleanItems = items
      .map((it) => ({
        description: (it.description || "").trim(),
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      }))
      .filter((it) => it.description && it.quantity > 0);
    if (cleanItems.length === 0) return toast.error("Add at least one line item");

    setSaving(true);
    try {
      const payload = {
        patient_id: selected.id,
        facility_id: selected.facility_id,
        created_by: userId,
        line_items: cleanItems,
        subtotal: round2(subtotal),
        tax_percent: round2(taxN),
        tax_amount: round2(taxAmount),
        discount_amount: round2(discountN),
        grand_total: round2(grand),
        payment_method: method,
        mpesa_reference: method === "mpesa" ? mpesaRef.trim() || null : null,
        insurance_scheme: method === "insurance" ? insScheme.trim() || null : null,
        insurance_auth_code: method === "insurance" ? insAuth.trim() || null : null,
        bank_reference: method === "bank" ? bankRef.trim() || null : null,
        status: (asPaid ? "paid" : "draft") as Status,
        notes: notes.trim() || null,
        paid_at: asPaid ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase.from("invoices").insert(payload).select("id,invoice_number").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "billing.invoice.create",
        entity_type: "invoice",
        entity_id: data!.invoice_number,
      });
      toast.success(`Invoice ${data!.invoice_number} ${asPaid ? "marked paid" : "saved as draft"}`);
      // reset
      setItems([{ description: "", quantity: 1, unit_price: 0, total: 0 }]);
      setDiscount("0"); setTaxPercent("0"); setNotes("");
      setMpesaRef(""); setInsScheme(""); setInsAuth(""); setBankRef("");
      if (!initialPatientId) setSelected(null);
      navigate({ to: "/billing", search: {} });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Patient</h3>
            </div>
            {selected ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                <div>
                  <div className="font-medium">{fullName(selected)}</div>
                  <div className="text-xs text-muted-foreground">
                    {selected.patient_code} · {selected.primary_phone}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
              </div>
            ) : (
              <PatientPicker onPick={setSelected} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Line items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">Description</th>
                    <th className="w-20 px-2 py-1">Qty</th>
                    <th className="w-32 px-2 py-1">Unit (KES)</th>
                    <th className="w-32 px-2 py-1 text-right">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-2">
                        <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Service / item" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{fmtKES(it.total)}</td>
                      <td className="px-2 py-2">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
              <Plus className="h-4 w-4" /> Add row
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Payment</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">MPESA</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {method === "mpesa" && (
                <div className="space-y-1.5">
                  <Label>MPESA Reference</Label>
                  <Input value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="e.g. QFG7XYZ123" />
                </div>
              )}
              {method === "bank" && (
                <div className="space-y-1.5">
                  <Label>Bank Reference</Label>
                  <Input value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
                </div>
              )}
              {method === "insurance" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Insurance Scheme</Label>
                    <Input value={insScheme} onChange={(e) => setInsScheme(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Auth Code</Label>
                    <Input value={insAuth} onChange={(e) => setInsAuth(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="text-sm font-semibold">Summary</h3>
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtKES(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span>Discount (KES)</span>
              <Input className="w-24 text-right" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Tax (%)</span>
              <Input className="w-24 text-right" type="number" min={0} step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </div>
            <div className="flex justify-between text-muted-foreground"><span>Tax amount</span><span>{fmtKES(taxAmount)}</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand Total</span><span>{fmtKES(grand)}</span>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save as Draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Mark as Paid
          </Button>
        </div>
      </div>
    </div>
  );
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function PatientPicker({ onPick }: { onPick: (p: PatientLite) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      setLoading(true);
      const like = `%${term}%`;
      const { data } = await supabase
        .from("patients")
        .select("id,patient_code,first_name,last_name,middle_name,primary_phone,facility_id")
        .or(`first_name.ilike.${like},last_name.ilike.${like},patient_code.ilike.${like},primary_phone.ilike.${like}`)
        .limit(8);
      setResults((data ?? []) as PatientLite[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, patient code (MR-…), or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      {results.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          {results.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent">
              <div>
                <div className="font-medium">{fullName(p)}</div>
                <div className="text-xs text-muted-foreground">{p.patient_code} · {p.primary_phone}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- HISTORY TAB -------------------- */

const PAGE_SIZE = 20;

function InvoiceHistoryTab() {
  const { isAdmin, isSupervisor, isSuperAdmin } = useAuth();
  const canCancel = isAdmin || isSupervisor || isSuperAdmin;
  const { facilities } = useFacilities();
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<(InvoiceRow & { patient: PatientLite | null })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<(InvoiceRow & { patient: PatientLite | null }) | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("invoices")
      .select("*, patient:patients(id,patient_code,first_name,last_name,middle_name,primary_phone,facility_id)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (facilityFilter !== "all") q = q.eq("facility_id", facilityFilter);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    if (search.trim()) q = q.ilike("invoice_number", `%${search.trim()}%`);
    const { data, count } = await q;
    setRows((data ?? []) as any);
    setTotal(count ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, facilityFilter, from, to, page]);

  async function cancelInvoice(inv: InvoiceRow) {
    if (!confirm(`Cancel invoice ${inv.invoice_number}?`)) return;
    const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      action: "billing.invoice.cancel", entity_type: "invoice", entity_id: inv.invoice_number,
    });
    toast.success("Invoice cancelled");
    load();
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label className="text-xs">Search invoice no.</Label>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="INV-…" />
              <Button onClick={() => { setPage(0); load(); }}>Search</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Facility</Label>
            <Select value={facilityFilter} onValueChange={(v) => { setFacilityFilter(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No invoices found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Patient</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                      <td className="px-3 py-2">{fullName(r.patient)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtKES(Number(r.grand_total))}</td>
                      <td className="px-3 py-2 capitalize">{r.payment_method ?? "—"}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{format(new Date(r.created_at), "PP p")}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setViewing(r)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { setViewing(r); setTimeout(() => window.print(), 250); }}><Printer className="h-4 w-4" /></Button>
                          {canCancel && r.status !== "cancelled" && (
                            <Button variant="ghost" size="icon" onClick={() => cancelInvoice(r)} title="Cancel"><Ban className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
            <span>Page {page + 1} of {pages} · {total} invoice(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewing && <InvoiceViewDialog inv={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
    paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
    cancelled: { label: "Cancelled", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  };
  return <Badge variant="secondary" className={map[status].cls}>{map[status].label}</Badge>;
}

/* -------------------- INVOICE VIEW + PRINT -------------------- */

function InvoiceViewDialog({ inv, onClose }: { inv: InvoiceRow & { patient: PatientLite | null }; onClose: () => void }) {
  const { facilities } = useFacilities();
  const facility = facilities.find((f) => f.id === inv.facility_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl print:!max-w-none print:!shadow-none print:!border-0">
        <DialogHeader className="no-print">
          <DialogTitle>Invoice {inv.invoice_number}</DialogTitle>
        </DialogHeader>

        <div id="invoice-print-area" className="invoice-sheet bg-white p-6 text-[12px] text-slate-900">
          <header className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100">
                <ShieldCheck className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-xl font-bold">MediReg</h1>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Patient Registry</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold">INVOICE</h2>
              <p className="font-mono text-sm">{inv.invoice_number}</p>
              <p className="text-[10px] text-slate-600">Issued {format(new Date(inv.created_at), "PP p")}</p>
            </div>
          </header>

          <section className="mb-6 grid grid-cols-2 gap-6">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Facility</p>
              <p className="font-medium">{facility?.name ?? "—"}</p>
              {facility?.code && <p className="text-slate-600">Code: {facility.code}</p>}
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Bill To</p>
              <p className="font-medium">{fullName(inv.patient)}</p>
              {inv.patient && <p className="text-slate-600">{inv.patient.patient_code} · {inv.patient.primary_phone}</p>}
            </div>
          </section>

          <table className="mb-4 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit (KES)</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.line_items.map((it, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{fmtKES(it.unit_price)}</td>
                  <td className="py-2 text-right">{fmtKES(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtKES(Number(inv.subtotal))}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>− {fmtKES(Number(inv.discount_amount))}</span></div>
            <div className="flex justify-between"><span>Tax ({Number(inv.tax_percent)}%)</span><span>{fmtKES(Number(inv.tax_amount))}</span></div>
            <div className="mt-2 flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
              <span>Grand Total</span><span>{fmtKES(Number(inv.grand_total))}</span>
            </div>
          </section>

          <section className="mt-6 border-t pt-3 text-[11px]">
            <p><strong>Payment method:</strong> <span className="capitalize">{inv.payment_method ?? "—"}</span></p>
            {inv.mpesa_reference && <p><strong>MPESA Ref:</strong> {inv.mpesa_reference}</p>}
            {inv.insurance_scheme && <p><strong>Insurance:</strong> {inv.insurance_scheme} (Auth: {inv.insurance_auth_code ?? "—"})</p>}
            {inv.bank_reference && <p><strong>Bank Ref:</strong> {inv.bank_reference}</p>}
            {inv.notes && <p className="mt-2"><strong>Notes:</strong> {inv.notes}</p>}
            <p className="mt-1"><strong>Status:</strong> <span className="capitalize">{inv.status}</span>{inv.paid_at && ` · Paid ${format(new Date(inv.paid_at), "PP p")}`}</p>
          </section>

          <footer className="mt-8 border-t pt-3 text-center text-[11px] italic text-slate-600">
            Thank you for choosing MediReg.
          </footer>
        </div>

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print</Button>
        </DialogFooter>
      </DialogContent>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute !important; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 18mm; }
        }
      `}</style>
    </Dialog>
  );
}