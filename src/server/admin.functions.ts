// Server functions for the Super Admin dashboard.
// All operations require an authenticated super_admin user (enforced by
// SECURITY DEFINER functions in Postgres + RLS on user_roles).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

export type AdminStats = {
  total_users: number;
  total_guests: number;
  total_games: number;
  active_games: number;
  live_games: number;
  lobby_games: number;
  completed_games: number;
  total_players: number;
  total_squares_claimed: number;
  total_messages: number;
  total_venues: number;
  auto_synced_games: number;
  games_last_7d: number;
  users_last_7d: number;
};

export type AdminGame = {
  id: string;
  name: string;
  sport: string;
  home_team: string;
  away_team: string;
  status: string;
  home_score: number;
  away_score: number;
  invite_code: string;
  created_at: string;
  host_id: string;
  host_name: string | null;
  player_count: number;
  squares_claimed: number;
};

export type AdminUser = {
  id: string;
  display_name: string;
  is_guest: boolean;
  avatar_url: string | null;
  created_at: string;
  games_hosted: number;
  games_joined: number;
  is_super_admin: boolean;
};

export type AdminWinner = {
  game_id: string;
  game_name: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  created_at: string;
  winner_name: string | null;
};

export type AdminOverview = {
  stats: AdminStats;
  games: AdminGame[];
  users: AdminUser[];
  winners: AdminWinner[];
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    await assertSuperAdmin(userId);

    // Stats via SECURITY DEFINER RPC
    const { data: statsData, error: statsErr } = await supabaseAdmin.rpc("admin_stats");
    if (statsErr) throw new Error(statsErr.message);

    // Recent winners via SECURITY DEFINER RPC
    const { data: winnersData, error: winnersErr } = await supabaseAdmin.rpc("admin_recent_winners");
    if (winnersErr) throw new Error(winnersErr.message);

    // Games (admin client bypasses RLS)
    const { data: gamesRows, error: gamesErr } = await supabaseAdmin
      .from("games")
      .select("id, name, sport, home_team, away_team, status, home_score, away_score, invite_code, created_at, host_id")
      .order("created_at", { ascending: false })
      .limit(100);
    if (gamesErr) throw new Error(gamesErr.message);

    const gameIds = (gamesRows ?? []).map((g) => g.id);
    const hostIds = Array.from(new Set((gamesRows ?? []).map((g) => g.host_id)));

    const [{ data: hostProfiles }, { data: playerRows }, { data: squareRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name").in("id", hostIds.length ? hostIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("game_players").select("game_id").in("game_id", gameIds.length ? gameIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("squares").select("game_id, owner_id").in("game_id", gameIds.length ? gameIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const hostNameMap = new Map((hostProfiles ?? []).map((p) => [p.id, p.display_name]));
    const playerCountMap = new Map<string, number>();
    (playerRows ?? []).forEach((p) => {
      playerCountMap.set(p.game_id, (playerCountMap.get(p.game_id) ?? 0) + 1);
    });
    const claimedMap = new Map<string, number>();
    (squareRows ?? []).forEach((s) => {
      if (s.owner_id) claimedMap.set(s.game_id, (claimedMap.get(s.game_id) ?? 0) + 1);
    });

    const games: AdminGame[] = (gamesRows ?? []).map((g) => ({
      ...g,
      host_name: hostNameMap.get(g.host_id) ?? null,
      player_count: playerCountMap.get(g.id) ?? 0,
      squares_claimed: claimedMap.get(g.id) ?? 0,
    }));

    // Users
    const { data: profileRows, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, is_guest, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (profileErr) throw new Error(profileErr.message);

    const userIds = (profileRows ?? []).map((p) => p.id);

    const [{ data: hostedRows }, { data: joinedRows }, { data: superAdminRows }] = await Promise.all([
      supabaseAdmin.from("games").select("host_id").in("host_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("game_players").select("user_id").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);

    const hostedMap = new Map<string, number>();
    (hostedRows ?? []).forEach((r) => hostedMap.set(r.host_id, (hostedMap.get(r.host_id) ?? 0) + 1));
    const joinedMap = new Map<string, number>();
    (joinedRows ?? []).forEach((r) => joinedMap.set(r.user_id, (joinedMap.get(r.user_id) ?? 0) + 1));
    const superAdminSet = new Set((superAdminRows ?? []).map((r) => r.user_id));

    const users: AdminUser[] = (profileRows ?? []).map((p) => ({
      ...p,
      games_hosted: hostedMap.get(p.id) ?? 0,
      games_joined: joinedMap.get(p.id) ?? 0,
      is_super_admin: superAdminSet.has(p.id),
    }));

    return {
      stats: statsData as AdminStats,
      games,
      users,
      winners: (winnersData ?? []) as AdminWinner[],
    } satisfies AdminOverview;
  });
