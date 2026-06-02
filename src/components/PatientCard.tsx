import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

interface Patient {
  patient_code: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string | null;
  primary_phone: string;
  nationality?: string | null;
  photo_url?: string | null;
  nok_name?: string | null;
  nok_phone?: string | null;
  allergies?: string | null;
  created_at: string;
}

export function PatientCard({ patient, facility = "MediReg Clinic" }: { patient: Patient; facility?: string }) {
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
  const qrPayload = JSON.stringify({ id: patient.patient_code, n: fullName, dob: patient.date_of_birth });

  return (
    <div className="patient-card mx-auto w-[3.375in] overflow-hidden rounded-xl border-2 border-primary/30 bg-white text-slate-900 shadow-lg print:shadow-none">
      <div className="flex items-center justify-between bg-primary px-4 py-2 text-white">
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-90">{facility}</div>
          <div className="text-sm font-semibold">Patient ID Card</div>
        </div>
        <div className="rounded bg-white/15 px-2 py-1 text-[10px] font-medium">MediReg</div>
      </div>

      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-slate-100">
          {patient.photo_url ? (
            <img src={patient.photo_url} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No Photo</div>
          )}
        </div>
        <div className="flex-1 space-y-0.5 text-[11px] leading-tight">
          <div className="text-xs font-semibold">{fullName}</div>
          <Row k="ID" v={patient.patient_code} mono />
          <Row k="DOB" v={patient.date_of_birth} />
          <Row k="Sex" v={patient.gender} />
          {patient.blood_group && <Row k="Blood" v={patient.blood_group} />}
          <Row k="Phone" v={patient.primary_phone} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 border-t bg-slate-50 p-3">
        <div className="space-y-0.5 text-[10px] leading-tight">
          {patient.nok_name && <Row k="Next of Kin" v={`${patient.nok_name} · ${patient.nok_phone ?? ""}`} />}
          {patient.allergies && <Row k="Allergies" v={patient.allergies} danger />}
          <Row k="Issued" v={format(new Date(patient.created_at), "PP")} />
        </div>
        <div className="rounded bg-white p-1">
          <QRCodeSVG value={qrPayload} size={72} level="M" />
        </div>
      </div>

      <div className="border-t bg-primary/5 px-3 py-1.5 text-center text-[9px] text-slate-600">
        If found, please return to {facility}
      </div>
    </div>
  );
}

function Row({ k, v, mono, danger }: { k: string; v: string; mono?: boolean; danger?: boolean }) {
  return (
    <div className="flex gap-1">
      <span className="text-slate-500">{k}:</span>
      <span className={`${mono ? "font-mono" : ""} ${danger ? "font-semibold text-red-600" : ""} truncate`}>{v}</span>
    </div>
  );
}
