// Server functions for the Super Admin dashboard. Thin file:
// createServerFn declarations + their imports only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, supabaseAdmin } from "./admin.server";
import type {
  AdminGame,
  AdminOverview,
  AdminStats,
  AdminUser,
  AdminWinner,
} from "./admin.types";

// Re-export types for client convenience.
export type { AdminOverview, AdminStats, AdminGame, AdminUser, AdminWinner };

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    await assertSuperAdmin(userId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    type CountTable = "profiles" | "games" | "game_players" | "squares" | "messages" | "venues";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Builder = (q: any) => any;

    const exactCount = async (label: string, table: CountTable, build: Builder): Promise<number> => {
      const headRes = await build(supabaseAdmin.from(table));
      if (headRes.error) throw new Error(`${label}: ${headRes.error.message}`);
      if (typeof headRes.count === "number") return headRes.count;

      const fallbackRes = await build(supabaseAdmin.from(table));
      if (fallbackRes.error) throw new Error(`${label} fallback: ${fallbackRes.error.message}`);
      return Array.isArray(fallbackRes.data) ? fallbackRes.data.length : 0;
    };

    const [
      total_users,
      total_guests,
      total_games,
      active_games,
      live_games,
      lobby_games,
      completed_games,
      total_players,
      total_squares_claimed,
      total_messages,
      total_venues,
      auto_synced_games,
      games_last_7d,
      users_last_7d,
    ] = await Promise.all([
      exactCount("total_users", "profiles", (q) => q.select("id", { count: "exact", head: true })),
      exactCount("total_guests", "profiles", (q) => q.select("id", { count: "exact", head: true }).eq("is_guest", true)),
      exactCount("total_games", "games", (q) => q.select("id", { count: "exact", head: true })),
      exactCount("active_games", "games", (q) => q.select("id", { count: "exact", head: true }).in("status", ["lobby", "locked", "live"])),
      exactCount("live_games", "games", (q) => q.select("id", { count: "exact", head: true }).eq("status", "live")),
      exactCount("lobby_games", "games", (q) => q.select("id", { count: "exact", head: true }).eq("status", "lobby")),
      exactCount("completed_games", "games", (q) => q.select("id", { count: "exact", head: true }).eq("status", "completed")),
      exactCount("total_players", "game_players", (q) => q.select("id", { count: "exact", head: true })),
      exactCount("total_squares_claimed", "squares", (q) => q.select("id", { count: "exact", head: true }).not("owner_id", "is", null)),
      exactCount("total_messages", "messages", (q) => q.select("id", { count: "exact", head: true })),
      exactCount("total_venues", "venues", (q) => q.select("id", { count: "exact", head: true })),
      exactCount("auto_synced_games", "games", (q) => q.select("id", { count: "exact", head: true }).eq("auto_sync_enabled", true)),
      exactCount("games_last_7d", "games", (q) => q.select("id", { count: "exact", head: true }).gt("created_at", sevenDaysAgo)),
      exactCount("users_last_7d", "profiles", (q) => q.select("id", { count: "exact", head: true }).gt("created_at", sevenDaysAgo)),
    ]);

    const statsData: AdminStats = {
      total_users,
      total_guests,
      total_games,
      active_games,
      live_games,
      lobby_games,
      completed_games,
      total_players,
      total_squares_claimed,
      total_messages,
      total_venues,
      auto_synced_games,
      games_last_7d,
      users_last_7d,
    };

    const { data: completedRows, error: completedErr } = await supabaseAdmin
      .from("games")
      .select("id, name, home_team, away_team, home_score, away_score, created_at, home_axis, away_axis")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(25);
    if (completedErr) throw new Error(completedErr.message);

    const completedIds = (completedRows ?? []).map((g) => g.id);
    const { data: winnerSquares, error: winnerSquaresErr } = await supabaseAdmin
      .from("squares")
      .select("game_id, row, col, owner_name")
      .in("game_id", completedIds.length ? completedIds : ["00000000-0000-0000-0000-000000000000"]);
    if (winnerSquaresErr) throw new Error(winnerSquaresErr.message);

    const winnerSquareMap = new Map((winnerSquares ?? []).map((s) => [`${s.game_id}:${s.row}:${s.col}`, s.owner_name]));
    const winnersData: AdminWinner[] = (completedRows ?? []).map((g) => {
      const row = g.away_axis.indexOf(g.away_score % 10);
      const col = g.home_axis.indexOf(g.home_score % 10);
      return {
        game_id: g.id,
        game_name: g.name,
        home_team: g.home_team,
        away_team: g.away_team,
        home_score: g.home_score,
        away_score: g.away_score,
        created_at: g.created_at,
        winner_name: row >= 0 && col >= 0 ? winnerSquareMap.get(`${g.id}:${row}:${col}`) ?? null : null,
      };
    });

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
