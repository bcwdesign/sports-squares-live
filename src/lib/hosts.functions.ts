// Super Admin host-management server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "./authz.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  ManagedUser,
  ManagedUserPage,
  ManagedUserRole,
  RoleAuditEntry,
} from "./admin.types";

export type { ManagedUser, ManagedUserPage, RoleAuditEntry };

async function emailMap(): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  for (const u of data.users) map.set(u.id, u.email ?? null);
  return map;
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; page?: number; pageSize?: number }) => input ?? {})
  .handler(async ({ data, context }): Promise<ManagedUserPage> => {
    await assertSuperAdmin(context.userId);

    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, data.pageSize ?? 20));
    const search = (data.search ?? "").trim().toLowerCase();

    const emails = await emailMap();

    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, is_guest, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (profErr) throw new Error(profErr.message);

    let rows = profiles ?? [];
    if (search) {
      rows = rows.filter((p) => {
        const email = (emails.get(p.id) ?? "").toLowerCase();
        return p.display_name.toLowerCase().includes(search) || email.includes(search);
      });
    }

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    const ids = pageRows.map((p) => p.id);
    const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

    const [{ data: roleRows }, { data: gameRows }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", safeIds),
      supabaseAdmin.from("games").select("host_id, created_at").in("host_id", safeIds),
    ]);

    const rolesByUser = new Map<string, ManagedUserRole[]>();
    (roleRows ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as ManagedUserRole);
      rolesByUser.set(r.user_id, list);
    });

    const hostedCount = new Map<string, number>();
    const lastHosted = new Map<string, string>();
    (gameRows ?? []).forEach((g) => {
      hostedCount.set(g.host_id, (hostedCount.get(g.host_id) ?? 0) + 1);
      const prev = lastHosted.get(g.host_id);
      if (!prev || g.created_at > prev) lastHosted.set(g.host_id, g.created_at);
    });

    const users: ManagedUser[] = pageRows.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      email: emails.get(p.id) ?? null,
      avatar_url: p.avatar_url,
      is_guest: p.is_guest,
      created_at: p.created_at,
      roles: rolesByUser.get(p.id) ?? [],
      games_hosted: hostedCount.get(p.id) ?? 0,
      last_hosted_at: lastHosted.get(p.id) ?? null,
    }));

    return { users, total, page, page_size: pageSize };
  });

type MutationResult = { ok: true; changed: boolean; message: string };

async function guardTarget(actorId: string, targetUserId: string) {
  if (targetUserId === actorId) throw new Error("You cannot change your own access here.");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, is_guest, display_name")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("User not found.");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId);
  const roleList = (roles ?? []).map((r) => r.role as ManagedUserRole);
  if (roleList.includes("super_admin")) throw new Error("Super Admin accounts cannot be changed here.");
  return { profile, roleList };
}

async function writeAudit(targetUserId: string, action: "assigned" | "revoked", actorId: string) {
  await supabaseAdmin.from("role_audit_log").insert({
    target_user_id: targetUserId,
    role: "host",
    action,
    performed_by: actorId,
  } as never);
}

export const assignHostRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<MutationResult> => {
    await assertSuperAdmin(context.userId);
    const { profile, roleList } = await guardTarget(context.userId, data.userId);
    if (profile.is_guest) throw new Error("Guest accounts cannot be granted Host access.");
    if (roleList.includes("host")) {
      return { ok: true, changed: false, message: `${profile.display_name} already has Host access.` };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: "host" } as never);
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    await writeAudit(data.userId, "assigned", context.userId);
    return { ok: true, changed: true, message: `${profile.display_name} is now a Host.` };
  });

export const revokeHostRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<MutationResult> => {
    await assertSuperAdmin(context.userId);
    const { profile, roleList } = await guardTarget(context.userId, data.userId);
    if (!roleList.includes("host")) {
      return { ok: true, changed: false, message: `${profile.display_name} does not have Host access.` };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "host");
    if (error) throw new Error(error.message);
    await writeAudit(data.userId, "revoked", context.userId);
    return { ok: true, changed: true, message: `Host access removed from ${profile.display_name}.` };
  });

export const listRoleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleAuditEntry[]> => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("role_audit_log")
      .select("id, target_user_id, role, action, performed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ids = Array.from(
      new Set(rows.flatMap((r) => [r.target_user_id, r.performed_by].filter(Boolean) as string[])),
    );
    const { data: names } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameMap = new Map((names ?? []).map((p) => [p.id, p.display_name]));
    return rows.map((r) => ({
      id: r.id,
      target_user_id: r.target_user_id,
      target_name: nameMap.get(r.target_user_id) ?? null,
      role: r.role as ManagedUserRole,
      action: r.action as "assigned" | "revoked",
      performed_by: r.performed_by,
      performed_by_name: r.performed_by ? nameMap.get(r.performed_by) ?? null : null,
      created_at: r.created_at,
    }));
  });
