// Server-only authorization helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "super_admin" | "admin" | "host" | "user";

export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, "super_admin");
}

export async function canHost(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes("host") || roles.includes("super_admin");
}

export async function canManageHosts(userId: string): Promise<boolean> {
  return isSuperAdmin(userId);
}

export async function assertSuperAdmin(userId: string) {
  if (!(await isSuperAdmin(userId))) throw new Error("Forbidden: super_admin only");
}

export async function assertCanHost(userId: string) {
  if (!(await canHost(userId))) throw new Error("Forbidden: hosting access required");
}

export async function assertCanManageHosts(userId: string) {
  if (!(await canManageHosts(userId))) throw new Error("Forbidden: super_admin only");
}
