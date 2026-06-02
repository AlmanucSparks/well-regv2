import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  patientCode: string;
  onCaptured: (url: string) => void;
  initialUrl?: string | null;
}

export function WebcamCapture({ patientCode, onCaptured, initialUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [shot, setShot] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (e: any) {
      toast.error("Camera unavailable: " + (e.message ?? "permission denied"));
    }
  }

  function stop() {
    const s = videoRef.current?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  }

  useEffect(() => () => stop(), []);

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setShot(dataUrl);
    stop();

    setUploading(true);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${patientCode}/photo-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("patient-media").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("patient-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      onCaptured(data?.signedUrl ?? path);
      toast.success("Photo captured");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function retake() {
    setShot(null);
    start();
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border bg-muted">
        {shot ? (
          <img src={shot} alt="Captured" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        )}
        {!streaming && !shot && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Camera className="h-10 w-10 opacity-80" />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-wrap gap-2">
        {!streaming && !shot && (
          <Button type="button" onClick={start} variant="outline" className="gap-2">
            <Camera className="h-4 w-4" /> Start Camera
          </Button>
        )}
        {streaming && (
          <Button type="button" onClick={capture} className="gap-2">
            <Check className="h-4 w-4" /> Capture
          </Button>
        )}
        {shot && (
          <Button type="button" onClick={retake} variant="outline" className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Retake
          </Button>
        )}
      </div>
    </div>
  );
}
