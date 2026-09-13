// Server-only helpers for AI Commentator features. .server.ts extension
// guards against any client-side import.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COMMENTATORS, getCommentatorByName } from "@/lib/commentators";

export const DEFAULT_HEYGEN_AVATAR_ID = COMMENTATORS[0].heygenAvatarId;
export const DEFAULT_HEYGEN_VOICE_ID = COMMENTATORS[0].heygenVoiceId;

// Re-export the admin client for the .functions.ts handlers. Keeping the
// import inside this .server.ts file prevents the splitter from ever
// considering supabaseAdmin a client-side import.
export { supabaseAdmin };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertHost(supabase: any, gameId: string, userId: string) {
  const { data, error } = await supabase
    .from("games")
    .select("host_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.host_id !== userId) throw new Error("Forbidden: host only");
}

export function buildCommentaryPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  g: any,
  winner: { name: string | null; row: number; col: number; homeDigit: number; awayDigit: number } | null,
) {
  const personality = g.commentator_personality || "Hype Announcer";
  const voiceStyle = g.commentator_voice_style || "Energetic";
  const name = g.commentator_name || "Coach Chaos";
  const catchphrases = g.commentator_catchphrases || "";
  const winnerHolderPhrase = winner
    ? winner.name
      ? `square ${winner.awayDigit}-${winner.homeDigit} held by ${winner.name}`
      : `square ${winner.awayDigit}-${winner.homeDigit} (currently unclaimed)`
    : null;
  const requiredMention = winnerHolderPhrase
    ? `You MUST explicitly say the currently winning square AND the player's name in this exact form: "${winnerHolderPhrase}". Do not abbreviate or omit either piece.`
    : `No score has been posted yet — hype the upcoming tipoff. Do NOT invent a winning square.`;
  return `You are ${name}, an in-game AI commentator with this style: ${personality}. Your delivery should feel ${voiceStyle.toLowerCase()}. ${catchphrases ? `Optional catchphrase to weave in occasionally: "${catchphrases}".` : ""}\n\nGAME STATE\n- Away: ${g.away_team} ${g.away_score}\n- Home: ${g.home_team} ${g.home_score}\n- Quarter: ${g.quarter} (${g.status})\n- Clock: ${g.clock}\n${winnerHolderPhrase ? `- Currently winning: ${winnerHolderPhrase}` : `- No score yet`}\n\nREQUIRED: ${requiredMention}\n\nWrite ONE short, energetic commentary line (1–2 sentences max, under 240 characters) for a watch party. It MUST include the current score AND the winning-square phrase above verbatim (player name included when present). Do not mention betting, gambling, wagering, odds, buy-ins, or payouts. Output ONLY the commentary line — no quotes, no prefix.`;
}

// ---------------------------------------------------------------------------
// HeyGen recap video generation.
//
// These helpers are callable both from the host-facing server functions and
// from the every-minute cron pass, so the final recap is produced even when no
// browser tab is open when the game ends.
// ---------------------------------------------------------------------------

export type HeyGenKind = "intro" | "quarter" | "final";

const HEYGEN_SELECT =
  "id, commentator_intro_script, commentator_latest_text, commentator_name, commentator_personality, heygen_avatar_id, heygen_voice_id, home_team, away_team, home_score, away_score, quarter, home_axis, away_axis";

async function buildHeyGenScript(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: any,
  gameId: string,
  kind: HeyGenKind,
): Promise<{ script: string; title: string; avatarId: string; voiceId: string }> {
  const preset =
    getCommentatorByName(game.commentator_personality) ?? getCommentatorByName(game.commentator_name);
  const avatarId = game.heygen_avatar_id || preset?.heygenAvatarId || DEFAULT_HEYGEN_AVATAR_ID;
  const voiceId = game.heygen_voice_id || preset?.heygenVoiceId || DEFAULT_HEYGEN_VOICE_ID;
  const name = game.commentator_name || preset?.name || "your AI commentator";

  let script: string;
  let title: string;
  if (kind === "final") {
    const homeDigit = game.home_score % 10;
    const awayDigit = game.away_score % 10;
    const col = (game.home_axis as number[]).indexOf(homeDigit);
    const row = (game.away_axis as number[]).indexOf(awayDigit);
    let winnerName: string | null = null;
    if (col >= 0 && row >= 0) {
      const { data: sq } = await supabaseAdmin
        .from("squares")
        .select("owner_name")
        .eq("game_id", gameId)
        .eq("row", row)
        .eq("col", col)
        .maybeSingle();
      winnerName = sq?.owner_name ?? null;
    }
    const winningTeam =
      game.home_score === game.away_score
        ? `${game.home_team} and ${game.away_team} tied it up`
        : game.home_score > game.away_score
          ? `${game.home_team} took it`
          : `${game.away_team} took it`;
    const winnerLine = winnerName
      ? `The final square ${awayDigit}-${homeDigit} belongs to ${winnerName}. Congratulations, MVP!`
      : `The final square ${awayDigit}-${homeDigit} went unclaimed — tough break!`;
    script = `That's the final buzzer! ${winningTeam}, ${game.away_team} ${game.away_score}, ${game.home_team} ${game.home_score}. ${winnerLine} I'm ${name}, signing off — what a game.`;
    title = `${game.commentator_name || "Commentator"} Final Recap`;
  } else if (kind === "quarter") {
    script =
      game.commentator_latest_text?.trim() ||
      `End of quarter ${game.quarter}. ${game.away_team} ${game.away_score}, ${game.home_team} ${game.home_score}.`;
    title = `${game.commentator_name || "Commentator"} Q${game.quarter} Recap`;
  } else {
    script = game.commentator_intro_script || `Welcome to the show, I'm ${name}.`;
    title = `${game.commentator_name || "Commentator"} Intro`;
  }

  return { script: script.slice(0, 1500), title, avatarId, voiceId };
}

/**
 * Requests a HeyGen render for a game and stores the resulting video id.
 *
 * For `kind: "final"` the request is claimed via `heygen_final_requested_at`
 * so the host tab and the cron pass can never double-fire. Pass `force` to
 * re-request (the host "Retry" button on the results page).
 */
export async function requestHeyGenVideo(
  gameId: string,
  kind: HeyGenKind = "intro",
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; video_id: string | null; reason?: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  const { data: game, error } = await supabaseAdmin
    .from("games")
    .select(HEYGEN_SELECT)
    .eq("id", gameId)
    .maybeSingle();
  if (error || !game) throw new Error(error?.message || "Game not found");

  if (kind === "final" && !opts.force) {
    // Atomic claim: only the first caller gets a row back.
    const { data: claimed } = await supabaseAdmin
      .from("games")
      .update({ heygen_final_requested_at: new Date().toISOString() })
      .eq("id", gameId)
      .is("heygen_final_requested_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      return { ok: true, video_id: null, reason: "already_requested" };
    }
  } else if (kind === "final") {
    await supabaseAdmin
      .from("games")
      .update({ heygen_final_requested_at: new Date().toISOString() })
      .eq("id", gameId);
  }

  const { script, title, avatarId, voiceId } = await buildHeyGenScript(game, gameId, kind);

  const res = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: script, voice_id: voiceId },
        },
      ],
      dimension: { width: 1280, height: 720 },
      title,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    await supabaseAdmin
      .from("games")
      .update({ heygen_video_status: `error:${res.status}` })
      .eq("id", gameId);
    throw new Error(`HeyGen ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const videoId: string | undefined = json?.data?.video_id;
  await supabaseAdmin
    .from("games")
    .update({
      heygen_video_id: videoId ?? null,
      heygen_video_status: videoId ? "processing" : "unknown",
    })
    .eq("id", gameId);

  return { ok: true, video_id: videoId ?? null };
}

/** Polls HeyGen for the game's current video and persists status/url. */
export async function pollHeyGenVideo(
  gameId: string,
): Promise<{ ok: boolean; status: string | null; url: string | null; reason?: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

  const { data: game } = await supabaseAdmin
    .from("games")
    .select("heygen_video_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game?.heygen_video_id) return { ok: false, status: null, url: null, reason: "no_video" };

  const res = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(game.heygen_video_id)}`,
    { headers: { "X-Api-Key": apiKey } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HeyGen status ${res.status}`);

  const status: string | undefined = json?.data?.status;
  const url: string | undefined = json?.data?.video_url;
  const updates: { heygen_video_status: string | null; heygen_video_url?: string } = {
    heygen_video_status: status ?? null,
  };
  if (status === "completed" && url) updates.heygen_video_url = url;
  await supabaseAdmin.from("games").update(updates).eq("id", gameId);

  return { ok: true, status: status ?? null, url: url ?? null };
}

/**
 * Cron pass: kick off final recaps for freshly completed games and advance
 * any in-flight renders. Bounded so a single cron tick stays fast.
 */
export async function runDueFinalRecaps(): Promise<{
  requested: number;
  polled: number;
  completed: number;
  errors: number;
}> {
  let requested = 0;
  let polled = 0;
  let completed = 0;
  let errors = 0;

  if (!process.env.HEYGEN_API_KEY) return { requested, polled, completed, errors };

  const { data: due } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("status", "completed")
    .eq("commentator_enabled", true)
    .eq("heygen_reactions_enabled", true)
    .is("heygen_final_requested_at", null)
    .limit(10);

  for (const g of due ?? []) {
    try {
      const r = await requestHeyGenVideo(g.id, "final");
      if (r.video_id) requested++;
    } catch (e) {
      errors++;
      console.error(`[final-recap/cron] game=${g.id} generate failed:`, e instanceof Error ? e.message : e);
    }
  }

  const { data: pending } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("status", "completed")
    .not("heygen_video_id", "is", null)
    .is("heygen_video_url", null)
    .limit(10);

  for (const g of pending ?? []) {
    try {
      const r = await pollHeyGenVideo(g.id);
      polled++;
      if (r.status === "completed" && r.url) completed++;
    } catch (e) {
      errors++;
      console.error(`[final-recap/cron] game=${g.id} poll failed:`, e instanceof Error ? e.message : e);
    }
  }

  return { requested, polled, completed, errors };
}
