// Public watch-party overlay data + invite-code joining.
// Both used to be database RPCs; they now run server-side so the database
// helpers no longer need to be callable from the browser.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Game, Square } from "@/lib/types";

export type OverlayPayload = { game: Game; squares: Square[] } | null;

export const getOverlayByToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(200) }).parse(input))
  .handler(async ({ data }): Promise<OverlayPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select(
        "id, name, sport, home_team, away_team, status, home_axis, away_axis, home_score, away_score, quarter, clock, host_id, max_squares_per_user, game_date_time, created_at, commentator_enabled, commentator_name, commentator_personality, commentator_latest_text, commentator_latest_audio_url, commentator_status, commentator_last_spoken_at, heygen_video_status, heygen_video_url, auto_sync_enabled, external_provider, external_game_id, period, game_clock, game_status, score_source, last_score_sync_at, branding_enabled, branding_company_name, branding_logo_url, branding_primary, branding_secondary, branding_background, branding_claimed_color, branding_winning_color, branding_square_style",
      )
      .eq("share_token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!game) return null;

    const { data: squares } = await supabaseAdmin
      .from("squares")
      .select("id, game_id, row, col, owner_id, owner_name")
      .eq("game_id", game.id);

    return {
      game: { ...game, invite_code: "", share_token: "" } as unknown as Game,
      squares: (squares ?? []) as unknown as Square[],
    };
  });

export const joinGameByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().min(4).max(24) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, name, status")
      .eq("invite_code", code)
      .maybeSingle();
    if (!game) throw new Error("No game found with that code");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const { error: insErr } = await supabaseAdmin.from("game_players").insert({
      game_id: game.id,
      user_id: context.userId,
      display_name: profile?.display_name ?? "Player",
      avatar_url: profile?.avatar_url ?? null,
    });
    if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);

    return { id: game.id, name: game.name, status: game.status as string };
  });
