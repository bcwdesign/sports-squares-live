// Server-only helpers for AI Commentator features. .server.ts extension
// guards against any client-side import.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COMMENTATORS } from "@/lib/commentators";

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
