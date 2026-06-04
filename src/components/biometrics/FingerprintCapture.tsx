import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, Check, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const FINGERS = ["thumb", "index", "middle", "ring", "little"] as const;
type Finger = (typeof FINGERS)[number];
const LABEL: Record<Finger, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  little: "Little",
};

export type FingerprintSet = Partial<Record<Finger, string>>;

interface Props {
  /** Called whenever any finger is (re)scanned. */
  onChange: (templates: FingerprintSet) => void;
  initial?: FingerprintSet | null;
}

async function fakeScan(): Promise<string> {
  await new Promise((r) => setTimeout(r, 1100));
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Captures all five fingers of the patient's RIGHT hand.
 * Software-only placeholder; swap fakeScan() for a real SDK call when hardware is connected.
 */
export function FingerprintCapture({ onChange, initial }: Props) {
  const [templates, setTemplates] = useState<FingerprintSet>(initial ?? {});
  const [scanning, setScanning] = useState<Finger | null>(null);

  async function scan(finger: Finger) {
    setScanning(finger);
    try {
      const hex = await fakeScan();
      const next = { ...templates, [finger]: hex };
      setTemplates(next);
      onChange(next);
      toast.success(`${LABEL[finger]} finger enrolled`);
    } catch (e: any) {
      toast.error("Scan failed: " + e.message);
    } finally {
      setScanning(null);
    }
  }

  const done = FINGERS.filter((f) => templates[f]).length;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Right hand · {done} of 5 fingers enrolled</p>
        {done === 5 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <Check className="h-3 w-3" /> Complete
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FINGERS.map((f) => {
          const enrolled = Boolean(templates[f]);
          const active = scanning === f;
          return (
            <div key={f} className="flex flex-col items-center gap-2 rounded-md border bg-background p-3">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${
                  enrolled ? "border-success bg-success/10" : "border-muted-foreground/30"
                } ${active ? "animate-pulse" : ""}`}
              >
                {enrolled ? (
                  <Check className="h-7 w-7 text-success" />
                ) : (
                  <Fingerprint className={`h-8 w-8 ${active ? "text-primary" : "text-muted-foreground"}`} />
                )}
              </div>
              <span className="text-xs font-medium">{LABEL[f]}</span>
              <Button
                type="button"
                size="sm"
                variant={enrolled ? "outline" : "default"}
                disabled={active}
                onClick={() => scan(f)}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                {active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : enrolled ? (
                  <RefreshCcw className="h-3 w-3" />
                ) : (
                  <Fingerprint className="h-3 w-3" />
                )}
                {enrolled ? "Re-scan" : "Scan"}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Place each finger of the right hand on the scanner in sequence. The index finger appears on the printed ID card.
      </p>
    </div>
  );
}
