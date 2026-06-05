import { format } from "date-fns";

export function buildPatientDocumentHTML(p: any, opts: { facility?: string } = {}): string {
  const facility = opts.facility ?? "MediReg Clinic";
  const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  const issued = p.created_at ? format(new Date(p.created_at), "PP") : "—";
  const generated = format(new Date(), "PPpp");
  const address = [p.address, p.city, p.region, p.country, p.postal_code].filter(Boolean).join(", ");
  const nokAddress = [p.nok_address, p.nok_city, p.nok_country].filter(Boolean).join(", ");
  const insurance = [p.insurance_provider, p.insurance_policy_number].filter(Boolean).join(" · ");
  const fps = (p.fingerprints ?? {}) as Record<string, string>;
  const fingerCount = Object.keys(fps).length;

  const esc = (v: any) =>
    v === null || v === undefined || String(v).trim() === ""
      ? "—"
      : String(v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

  const row = (k: string, v: any) =>
    `<tr><td class="k">${k}</td><td class="v">${esc(v)}</td></tr>`;

  const section = (title: string, rows: string) => `
    <section class="sec">
      <h3>${title}</h3>
      <table class="kv"><tbody>${rows}</tbody></table>
    </section>`;

  const fingerCells = ["thumb", "index", "middle", "ring", "little"]
    .map((f) => {
      const has = !!fps[f];
      return `<div class="finger ${has ? "on" : "off"}">
        <div class="finger-label">${f[0].toUpperCase() + f.slice(1)}</div>
        <div class="finger-state">${has ? "Captured" : "Not captured"}</div>
      </div>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(fullName)} — ${esc(p.patient_code)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .doc { width: 794px; margin: 0 auto; padding: 32px 36px; }
  header.top { display: flex; align-items: flex-start; justify-content: space-between;
    border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
  header .brand h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
  header .brand p { margin: 2px 0 0; font-size: 10px; letter-spacing: .12em;
    text-transform: uppercase; color: #475569; }
  header .meta { text-align: right; }
  header .meta .code { font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 14px; font-weight: 700; }
  header .meta .small { font-size: 10px; color: #475569; margin-top: 2px; }
  .id-block { display: grid; grid-template-columns: 130px 1fr; gap: 18px;
    margin-bottom: 18px; padding: 14px; border: 1px solid #cbd5e1;
    border-radius: 8px; background: #f8fafc; }
  .photo { width: 130px; height: 160px; border: 1px solid #94a3b8; border-radius: 6px;
    overflow: hidden; background: #e2e8f0; display: flex; align-items: center;
    justify-content: center; color: #64748b; font-size: 10px; }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .id-main h2 { margin: 0 0 4px; font-size: 20px; letter-spacing: -0.01em; }
  .id-main .sub { font-size: 11px; color: #475569; margin-bottom: 10px; }
  .id-main .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
  .id-main .grid div { font-size: 11px; }
  .id-main .grid b { color: #334155; font-weight: 600; }
  .sec { margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 8px;
    padding: 12px 14px; page-break-inside: avoid; }
  .sec h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: .14em;
    text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0;
    padding-bottom: 6px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { vertical-align: top; padding: 3px 0; font-size: 11px; }
  table.kv td.k { width: 36%; color: #64748b; padding-right: 12px; }
  table.kv td.v { color: #0f172a; font-weight: 500; }
  .fingers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .finger { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 6px;
    text-align: center; background: #fff; }
  .finger.off { border-style: dashed; color: #94a3b8; background: #f8fafc; }
  .finger-label { font-size: 11px; font-weight: 600; }
  .finger-state { font-size: 9px; margin-top: 2px; color: #64748b; }
  .sig-box { display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    margin-top: 4px; }
  .sig { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px;
    background: #fff; min-height: 110px; display: flex; flex-direction: column; }
  .sig .lbl { font-size: 10px; color: #64748b; letter-spacing: .1em;
    text-transform: uppercase; margin-bottom: 6px; }
  .sig img { max-height: 80px; max-width: 100%; object-fit: contain;
    align-self: flex-start; }
  .sig .placeholder { color: #94a3b8; font-size: 10px; font-style: italic;
    margin: auto 0; }
  footer.bot { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0;
    text-align: center; font-size: 9px; color: #64748b; line-height: 1.5; }
  @media print {
    .doc { width: auto; padding: 16mm 14mm; }
    .sec, .id-block { break-inside: avoid; }
  }
</style></head><body>
<div class="doc">
  <header class="top">
    <div class="brand">
      <h1>${esc(facility)}</h1>
      <p>Confidential Patient Record · Generated ${generated}</p>
    </div>
    <div class="meta">
      <div class="code">${esc(p.patient_code)}</div>
      <div class="small">Issued ${issued}</div>
    </div>
  </header>

  <div class="id-block">
    <div class="photo">${
      p.photo_url ? `<img src="${esc(p.photo_url)}" alt="patient photo" crossorigin="anonymous" />` : "No Photo"
    }</div>
    <div class="id-main">
      <h2>${esc(fullName)}</h2>
      <div class="sub">${esc(p.title ?? "")} ${p.title ? "·" : ""} ${esc(p.gender)} · DOB ${esc(p.date_of_birth)} ${
        p.blood_group ? "· Blood " + esc(p.blood_group) : ""
      }</div>
      <div class="grid">
        <div><b>Nationality:</b> ${esc(p.nationality)}</div>
        <div><b>Marital:</b> ${esc(p.marital_status)}</div>
        <div><b>ID Document:</b> ${esc(p.id_document_type)} · ${esc(p.id_number)}</div>
        <div><b>Occupation:</b> ${esc(p.occupation)}</div>
        <div><b>Place of birth:</b> ${esc(p.place_of_birth)}</div>
        <div><b>Religion:</b> ${esc(p.religion)}</div>
      </div>
    </div>
  </div>

  ${section(
    "Contact Information",
    row("Primary phone", p.primary_phone) +
      row("Secondary phone", p.secondary_phone) +
      row("Email", p.email) +
      row("Address", address) +
      row("Preferred language", p.preferred_language)
  )}

  ${section(
    "Next of Kin",
    row("Name", p.nok_name) +
      row("Relationship", p.nok_relationship) +
      row("Phone", p.nok_phone) +
      row("Email", p.nok_email) +
      row("Address", nokAddress)
  )}

  ${section(
    "Medical History",
    row("Allergies", p.allergies ?? "None reported") +
      row("Existing conditions", p.medical_conditions ?? "None reported") +
      row("Current medications", p.current_medications ?? "None reported") +
      row("Past surgeries", p.past_surgeries ?? "None reported") +
      row("Primary doctor", p.primary_doctor) +
      row("Insurance", insurance) +
      row("Smoking", p.smoking_status) +
      row("Alcohol", p.alcohol_use)
  )}

  <section class="sec">
    <h3>Biometric Enrollment — Right Hand (${fingerCount}/5)</h3>
    <div class="fingers">${fingerCells}</div>
  </section>

  <section class="sec">
    <h3>Signature & Authorization</h3>
    <div class="sig-box">
      <div class="sig">
        <div class="lbl">Patient Signature</div>
        ${
          p.signature_url
            ? `<img src="${esc(p.signature_url)}" alt="signature" crossorigin="anonymous" />`
            : `<div class="placeholder">No signature on file</div>`
        }
      </div>
      <div class="sig">
        <div class="lbl">Registrar / Witness</div>
        <div class="placeholder">_________________________________</div>
      </div>
    </div>
  </section>

  <footer class="bot">
    This document contains confidential patient data. Handle in accordance with applicable privacy regulations.<br/>
    ${esc(facility)} · Patient ID ${esc(p.patient_code)} · Generated ${generated}
  </footer>
</div>
</body></html>`;
}

/** Render the document into a hidden off-screen iframe and rasterize each page to a multi-page A4 PDF. */
export async function downloadPatientPdf(p: any): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const html = buildPatientDocumentHTML(p);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "820px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for images to load (photo + signature) so they render to the canvas.
    const imgs = Array.from(doc.images);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );
    // small layout settle
    await new Promise((r) => setTimeout(r, 60));

    const target = doc.querySelector(".doc") as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/png");
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(img, "PNG", 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(img, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`${p.patient_code}-${[p.first_name, p.last_name].filter(Boolean).join("-")}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}

export function printPatientDocument(p: any): void {
  const html = buildPatientDocumentHTML(p);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) throw new Error("Pop-up blocked");
  w.document.open();
  w.document.write(
    html.replace(
      "</body>",
      `<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),200)});</script></body>`
    )
  );
  w.document.close();
}