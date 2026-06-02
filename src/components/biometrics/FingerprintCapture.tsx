import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCaptured: (template: string) => void;
  initialTemplate?: string | null;
}

/**
 * Software-only fingerprint enrollment placeholder.
 * Generates a SHA-256 template from random entropy + timestamp.
 * Swap with WebAuthn / SDK call when fingerprint hardware is connected.
 */
export function FingerprintCapture({ onCaptured, initialTemplate }: Props) {
  const [scanning, setScanning] = useState(false);
  const [template, setTemplate] = useState<string | null>(initialTemplate ?? null);

  async function scan() {
    setScanning(true);
    try {
      // Simulate scanner pulse
      await new Promise((r) => setTimeout(r, 1400));
      const buf = new Uint8Array(32);
      crypto.getRandomValues(buf);
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      setTemplate(hex);
      onCaptured(hex);
      toast.success("Fingerprint enrolled");
    } catch (e: any) {
      toast.error("Scan failed: " + e.message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6">
      <div className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${template ? "border-success bg-success/10" : "border-muted-foreground/30"} ${scanning ? "animate-pulse" : ""}`}>
        {template ? (
          <Check className="h-12 w-12 text-success" />
        ) : (
          <Fingerprint className={`h-14 w-14 ${scanning ? "text-primary" : "text-muted-foreground"}`} />
        )}
      </div>
      {template ? (
        <div className="text-center">
          <p className="text-sm font-medium text-success">Template enrolled</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{template.slice(0, 24)}…</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Place finger on scanner</p>
      )}
      <Button type="button" onClick={scan} disabled={scanning} variant={template ? "outline" : "default"} className="gap-2">
        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        {template ? "Re-scan" : "Scan Fingerprint"}
      </Button>
    </div>
  );
}
