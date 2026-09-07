import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "super_admin" | "admin" | "host" | "user";

/**
 * Reads the signed-in user's formal roles. UI convenience only — the database
 * RLS policies are the real enforcement point.
 */
export function useUserRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setRoles([]);
      setLoading(authLoading);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const isSuperAdmin = roles.includes("super_admin");
  return {
    roles,
    loading,
    isSuperAdmin,
    isHost: roles.includes("host"),
    canHost: isSuperAdmin || roles.includes("host"),
    canManageHosts: isSuperAdmin,
  };
}
