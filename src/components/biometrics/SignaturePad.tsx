import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  patientCode: string;
  onSaved: (url: string) => void;
  initialUrl?: string | null;
}

export function SignaturePad({ patientCode, onSaved, initialUrl }: Props) {
  const ref = useRef<SignatureCanvas>(null);
  const [saved, setSaved] = useState<string | null>(initialUrl ?? null);
  const [saving, setSaving] = useState(false);

  function clear() {
    ref.current?.clear();
    setSaved(null);
  }

  async function save() {
    if (!ref.current || ref.current.isEmpty()) {
      toast.error("Please sign before saving.");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = ref.current.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${patientCode}/signature-${Date.now()}.png`;
      const { error } = await supabase.storage.from("patient-media").upload(path, blob, {
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("patient-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = data?.signedUrl ?? path;
      setSaved(url);
      onSaved(url);
      toast.success("Signature saved");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {saved ? (
        <div className="rounded-lg border bg-white p-3">
          <img src={saved} alt="Signature" className="mx-auto h-32 object-contain" />
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <SignatureCanvas
            ref={ref}
            penColor="#0f172a"
            canvasProps={{ className: "w-full h-40 rounded-lg" }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={clear} className="gap-2">
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        {!saved && (
          <Button type="button" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Signature
          </Button>
        )}
      </div>
    </div>
  );
}
