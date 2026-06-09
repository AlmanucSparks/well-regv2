import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";

interface Patient {
  id: string;
  patient_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string | null;
  photo_url?: string | null;
}

/** A6-ish printable patient ID card with QR linking to /patients/:id */
export function PatientIdCard({ patient, facility = "MediReg Clinic" }: { patient: Patient; facility?: string }) {
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/patients/${patient.id}`
    : `/patients/${patient.id}`;

  return (
    <div className="patient-id-card mx-auto w-[105mm] overflow-hidden rounded-lg border-2 border-slate-900 bg-white text-slate-900 shadow-sm print:shadow-none">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">MediReg</div>
            <div className="text-xs font-semibold leading-tight">{facility}</div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">Patient ID</div>
      </div>

      <div className="flex gap-3 p-3">
        <div className="h-[34mm] w-[26mm] flex-shrink-0 overflow-hidden rounded border border-slate-300 bg-slate-100">
          {patient.photo_url ? (
            <img src={patient.photo_url} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">No Photo</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold leading-tight">{fullName}</div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-700">{patient.patient_code}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
            <div><span className="text-slate-500">DOB:</span> {patient.date_of_birth}</div>
            <div><span className="text-slate-500">Sex:</span> {patient.gender}</div>
            {patient.blood_group && <div><span className="text-slate-500">Blood:</span> <b>{patient.blood_group}</b></div>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-300 bg-slate-50 px-3 py-2">
        <div className="rounded bg-white p-1">
          <QRCodeSVG value={url} size={68} level="M" />
        </div>
        <div className="text-[9px] leading-snug text-slate-600">
          Scan to open this patient's record.<br />
          If found, please return to {facility}.
        </div>
      </div>
    </div>
  );
}

/** Open a print window for an ID card. */
export function printIdCard(patient: Patient, facility = "MediReg Clinic") {
  const url = `${window.location.origin}/patients/${patient.id}`;
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  const esc = (v: any) =>
    v === null || v === undefined ? "" : String(v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  // Render the QR component to inline SVG markup so the popup has no network dependency.
  // Lazy import to keep this util tree-shakeable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  const React = require("react") as typeof import("react");
  const { QRCodeSVG } = require("qrcode.react") as typeof import("qrcode.react");
  const qrSvg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: url, size: 200, level: "M" }));
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(fullName)} — ID Card</title>
<style>
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff;}
  .card{width:105mm;margin:8mm auto;border:2px solid #0f172a;border-radius:8px;overflow:hidden;}
  .hdr{display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#fff;padding:8px 14px;}
  .hdr .brand{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.8;}
  .hdr .fac{font-size:12px;font-weight:600;}
  .hdr .lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;}
  .body{display:flex;gap:10px;padding:10px;}
  .photo{width:26mm;height:34mm;border:1px solid #cbd5e1;background:#f1f5f9;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;}
  .photo img{width:100%;height:100%;object-fit:cover;}
  .name{font-size:15px;font-weight:700;line-height:1.15;}
  .code{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#334155;margin-top:4px;font-weight:600;}
  .meta{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:10px;}
  .meta span{color:#64748b;}
  .foot{border-top:1px solid #cbd5e1;background:#f8fafc;padding:8px 12px;display:flex;gap:10px;align-items:center;}
  .qr{background:#fff;padding:3px;border:1px solid #e2e8f0;border-radius:4px;}
  .qr img{display:block;width:68px;height:68px;}
  .ftxt{font-size:9px;color:#475569;line-height:1.35;}
  @media print { @page { size: A6 landscape; margin: 4mm; } .card{margin:0 auto;} }
</style></head><body>
<div class="card">
  <div class="hdr">
    <div><div class="brand">MediReg</div><div class="fac">${esc(facility)}</div></div>
    <div class="lbl">Patient ID</div>
  </div>
  <div class="body">
    <div class="photo">${patient.photo_url ? `<img src="${esc(patient.photo_url)}" crossorigin="anonymous" alt=""/>` : "No Photo"}</div>
    <div style="flex:1;min-width:0;">
      <div class="name">${esc(fullName)}</div>
      <div class="code">${esc(patient.patient_code)}</div>
      <div class="meta">
        <div><span>DOB:</span> ${esc(patient.date_of_birth)}</div>
        <div><span>Sex:</span> ${esc(patient.gender)}</div>
        ${patient.blood_group ? `<div><span>Blood:</span> <b>${esc(patient.blood_group)}</b></div>` : ""}
      </div>
    </div>
  </div>
  <div class="foot">
    <div class="qr">${qrSvg}</div>
    <div class="ftxt">Scan to open this patient's record.<br/>If found, please return to ${esc(facility)}.</div>
  </div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script>
</body></html>`;
  const w = window.open("", "_blank", "width=700,height=600");
  if (!w) throw new Error("Pop-up blocked");
  w.document.open(); w.document.write(html); w.document.close();
}