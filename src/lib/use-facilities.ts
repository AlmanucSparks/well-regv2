import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FacilityLite { id: string; name: string; code: string | null; }

export function useFacilities() {
  const [facilities, setFacilities] = useState<FacilityLite[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("facilities")
        .select("id,name,code")
        .eq("status", "active")
        .order("name");
      if (!cancel) {
        setFacilities((data ?? []) as FacilityLite[]);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);
  return { facilities, loading };
}