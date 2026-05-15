// AI Commentator server functions.
// - generateScoreCommentary: builds + saves the next live commentary line.
// - generateHeyGenCommentatorVideo: kicks off a HeyGen avatar video.
// - getHeyGenVideoStatus: polls HeyGen for video completion.
//
// All require an authenticated host of the game.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCommentatorByName, COMMENTATORS } from "@/lib/commentators";

// Default to the first preset (Coach Chaos) when nothing is set on the row.
const DEFAULT_HEYGEN_AVATAR_ID = COMMENTATORS[0].heygenAvatarId;
const DEFAULT_HEYGEN_VOICE_ID = COMMENTATORS[0].heygenVoiceId;

async function assertHost(supabase: any, gameId: string, userId: string) {
  const { data, error } = await supabase
    .from("games")
    .select("host_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.host_id !== userId) throw new Error("Forbidden: host only");
}

function buildPrompt(g: any, winner: { name: string | null; row: number; col: number; homeDigit: number; awayDigit: number } | null) {
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
  return `You are ${name}, an in-game AI commentator with this style: ${personality}. Your delivery should feel ${voiceStyle.toLowerCase()}. ${catchphrases ? `Optional catchphrase to weave in occasionally: "${catchphrases}".` : ""}

GAME STATE
- Away: ${g.away_team} ${g.away_score}
- Home: ${g.home_team} ${g.home_score}
- Quarter: ${g.quarter} (${g.status})
- Clock: ${g.clock}
${winnerHolderPhrase ? `- Currently winning: ${winnerHolderPhrase}` : `- No score yet`}

REQUIRED: ${requiredMention}

Write ONE short, energetic commentary line (1–2 sentences max, under 240 characters) for a watch party. It MUST include the current score AND the winning-square phrase above verbatim (player name included when present). Do not mention betting, gambling, wagering, odds, buy-ins, or payouts. Output ONLY the commentary line — no quotes, no prefix.`;
}

export const generateScoreCommentary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHost(supabase, data.gameId, userId);

    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", data.gameId)
      .maybeSingle();
    if (gErr || !game) throw new Error(gErr?.message || "Game not found");
    if (!game.commentator_enabled) return { ok: false, reason: "disabled" as const };

    // Compute winning square.
    let winner: { name: string | null; row: number; col: number; homeDigit: number; awayDigit: number } | null = null;
    const scoresEntered = game.home_score > 0 || game.away_score > 0;
    if (scoresEntered) {
      const homeDigit = game.home_score % 10;
      const awayDigit = game.away_score % 10;
      const col = (game.home_axis as number[]).indexOf(homeDigit);
      const row = (game.away_axis as number[]).indexOf(awayDigit);
      if (col >= 0 && row >= 0) {
        const { data: sq } = await supabaseAdmin
          .from("squares")
          .select("owner_name")
          .eq("game_id", data.gameId)
          .eq("row", row)
          .eq("col", col)
          .maybeSingle();
        winner = { name: sq?.owner_name ?? null, row, col, homeDigit, awayDigit };
      }
    }

    // Mark thinking.
    await supabaseAdmin
      .from("games")
      .update({ commentator_status: "thinking" })
      .eq("id", data.gameId);

    const prompt = buildPrompt(game, winner);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      await supabaseAdmin.from("games").update({ commentator_status: "ready" }).eq("id", data.gameId);
      throw new Error(`AI gateway ${aiRes.status}: ${text.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const text: string = (aiJson?.choices?.[0]?.message?.content ?? "").toString().trim();

    await supabaseAdmin
      .from("games")
      .update({
        commentator_latest_text: text,
        commentator_last_spoken_at: new Date().toISOString(),
        commentator_status: "live",
      })
      .eq("id", data.gameId);

    return { ok: true as const, text };
  });

export const generateHeyGenCommentatorVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        gameId: z.string().uuid(),
        kind: z.enum(["intro", "final"]).optional().default("intro"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHost(supabase, data.gameId, userId);

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select(
        "commentator_intro_script, commentator_name, commentator_personality, heygen_avatar_id, heygen_voice_id, home_team, away_team, home_score, away_score, home_axis, away_axis",
      )
      .eq("id", data.gameId)
      .maybeSingle();
    if (error || !game) throw new Error(error?.message || "Game not found");

    const preset =
      getCommentatorByName(game.commentator_personality) ?? getCommentatorByName(game.commentator_name);
    const avatarId = game.heygen_avatar_id || preset?.heygenAvatarId || DEFAULT_HEYGEN_AVATAR_ID;
    const voiceId = game.heygen_voice_id || preset?.heygenVoiceId || DEFAULT_HEYGEN_VOICE_ID;
    const name = game.commentator_name || preset?.name || "your AI commentator";

    let script: string;
    let title: string;
    if (data.kind === "final") {
      const homeDigit = game.home_score % 10;
      const awayDigit = game.away_score % 10;
      const col = (game.home_axis as number[]).indexOf(homeDigit);
      const row = (game.away_axis as number[]).indexOf(awayDigit);
      let winnerName: string | null = null;
      if (col >= 0 && row >= 0) {
        const { data: sq } = await supabaseAdmin
          .from("squares")
          .select("owner_name")
          .eq("game_id", data.gameId)
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
    } else {
      script = game.commentator_intro_script || `Welcome to the show, I'm ${name}.`;
      title = `${game.commentator_name || "Commentator"} Intro`;
    }
    script = script.slice(0, 1500);

    const payload = {
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: script, voice_id: voiceId },
        },
      ],
      dimension: { width: 1280, height: 720 },
      title,
    };

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      await supabaseAdmin
        .from("games")
        .update({ heygen_video_status: `error:${res.status}` })
        .eq("id", data.gameId);
      throw new Error(`HeyGen ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    }
    const videoId: string | undefined = json?.data?.video_id;
    await supabaseAdmin
      .from("games")
      .update({
        heygen_video_id: videoId ?? null,
        heygen_video_status: videoId ? "processing" : "unknown",
      })
      .eq("id", data.gameId);

    return { ok: true as const, video_id: videoId ?? null };
  });

export const getHeyGenVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHost(supabase, data.gameId, userId);

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

    const { data: game } = await supabaseAdmin
      .from("games")
      .select("heygen_video_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!game?.heygen_video_id) return { ok: false as const, reason: "no_video" };

    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(game.heygen_video_id)}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HeyGen status ${res.status}`);

    const status: string | undefined = json?.data?.status;
    const url: string | undefined = json?.data?.video_url;
    const updates: { heygen_video_status: string | null; heygen_video_url?: string } = {
      heygen_video_status: status ?? null,
    };
    if (status === "completed" && url) updates.heygen_video_url = url;
    await supabaseAdmin.from("games").update(updates).eq("id", data.gameId);

    return { ok: true as const, status: status ?? null, url: url ?? null };
  });

// ---------------------------------------------------------------------------
// Per-line voice clip generation. Used by CommentatorCard to play each new
// commentary line in the SAME HeyGen voice the avatar uses, instead of the
// browser's built-in speech synthesis (which sounds nothing like the avatar).
//
// HeyGen has no public stand-alone TTS, so we render a tiny avatar video and
// play just its audio track. Latency: ~15-45s. Acceptable since live lines
// fire every 30-60s.
// ---------------------------------------------------------------------------

export const generateCommentatorVoiceClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        gameId: z.string().uuid(),
        text: z.string().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHost(supabase, data.gameId, userId);

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select("commentator_name, commentator_personality, heygen_avatar_id, heygen_voice_id")
      .eq("id", data.gameId)
      .maybeSingle();
    if (error || !game) throw new Error(error?.message || "Game not found");

    const preset =
      getCommentatorByName(game.commentator_personality) ?? getCommentatorByName(game.commentator_name);
    const avatarId = game.heygen_avatar_id || preset?.heygenAvatarId || DEFAULT_HEYGEN_AVATAR_ID;
    const voiceId = game.heygen_voice_id || preset?.heygenVoiceId || DEFAULT_HEYGEN_VOICE_ID;

    const payload = {
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: data.text.slice(0, 500), voice_id: voiceId },
        },
      ],
      // Smallest supported render to minimize latency — we only use the audio.
      dimension: { width: 720, height: 480 },
      title: "Commentator voice line",
    };

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("HeyGen voice clip generate failed", res.status, json);
      return { ok: false as const, video_id: null, error: `HeyGen ${res.status}` };
    }
    const videoId: string | undefined = json?.data?.video_id;
    return { ok: true as const, video_id: videoId ?? null };
  });

export const getCommentatorVoiceClipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ gameId: z.string().uuid(), videoId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHost(supabase, data.gameId, userId);

    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) throw new Error("HEYGEN_API_KEY not configured");

    const res = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(data.videoId)}`,
      { headers: { "X-Api-Key": apiKey } },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, status: `error:${res.status}`, url: null };

    const status: string | undefined = json?.data?.status;
    const url: string | undefined = json?.data?.video_url;
    return { ok: true as const, status: status ?? null, url: url ?? null };
  });
