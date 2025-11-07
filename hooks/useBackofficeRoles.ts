import { useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type RoleName = "usuario" | "administrativo" | "auditor" | "super_admin";

export function useBackofficeRoles() {
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("v_user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (cancelled) return;
        if (error as PostgrestError | null) {
          setRoles([]);
        } else {
          setRoles((data || []).map(r => r.role as RoleName));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  return { roles, loading };
}
