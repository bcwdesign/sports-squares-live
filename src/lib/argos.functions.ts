// Argos Identity age-verification server functions.
//
// SECURITY:
// - ARGOS_API_KEY, ARGOS_VERIFICATION_URL, and ARGOS_WEBHOOK_SECRET are all
//   read from process.env on the server only and are never exposed to the
//   browser.
// - Only the authenticated winner of a given quarter (or final) can start an
//   Argos session for that prize, enforced by checking quarter_results.winner_user_id.
//
// FLOW:
// 1. Client clicks "Verify Age to Claim Prize" on the results screen.
// 2. startArgosVerification() validates the caller is the winner, generates a
//    submission_id, persists it on the quarter_results row, and returns a URL
//    the user is redirected to (Argos hosted ID-check flow).
// 3. Argos posts the result to /api/argos/webhook, which updates the matching
//    quarter_results row by submission_id (+ user_id / email).
// 4. Argos redirects the user back to the prize claim screen (configured Return
//    URL in the Argos dashboard).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REQUIRES_VERIFICATION = new Set(["alcohol", "money"]);

export const startArgosVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        gameId: z.string().uuid(),
        quarter: z.number().int().min(1).max(4),
        returnUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;

    // Confirm prize is enabled and requires verification.
    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .select(
        "id, prize_enabled, prize_type, prize_description, requires_age_verification",
      )
      .eq("id", data.gameId)
      .maybeSingle();
    if (gErr || !game) throw new Error(gErr?.message || "Game not found");
    if (!game.prize_enabled) throw new Error("Prize mode is not enabled");
    if (!game.prize_type || !REQUIRES_VERIFICATION.has(game.prize_type)) {
      throw new Error("This prize type does not require age verification");
    }

    // Confirm caller is the winner of this quarter.
    const { data: qr, error: qErr } = await supabaseAdmin
      .from("quarter_results")
      .select("id, winner_user_id, age_verification_status, age_verified")
      .eq("game_id", data.gameId)
      .eq("quarter", data.quarter)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!qr) throw new Error("No winner recorded for this quarter yet");
    if (qr.winner_user_id !== userId) {
      throw new Error("Only the winner of this quarter can verify");
    }
    if (qr.age_verified) {
      return { alreadyVerified: true as const };
    }

    // Resolve the winning square id for context.
    const { data: sqRow } = await supabaseAdmin
      .from("squares")
      .select("id")
      .eq("game_id", data.gameId)
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    // Generate a submission id we'll match on in the webhook. Using
    // crypto.randomUUID() avoids any dependency on the Argos client SDK.
    const submissionId = (globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`) as string;

    // Persist verification record on the quarter_results row.
    const { error: uErr } = await supabaseAdmin
      .from("quarter_results")
      .update({
        age_verification_required: true,
        age_verification_provider: "argos",
        age_verification_status: "pending",
        age_verification_submission_id: submissionId,
        prize_claim_status: "verification_required",
      } as never)
      .eq("id", qr.id);
    if (uErr) throw new Error(uErr.message);

    // Build the Argos hosted flow URL. The base ARGOS_VERIFICATION_URL is
    // configured in the Argos dashboard (where Return URL + webhook URL are
    // also configured). We append dynamic context as query params so the
    // hosted flow / webhook can echo them back.
    const baseUrl = process.env.ARGOS_VERIFICATION_URL;
    if (!baseUrl) throw new Error("ARGOS_VERIFICATION_URL is not configured");

    const url = new URL(baseUrl);
    url.searchParams.set("submission_id", submissionId);
    url.searchParams.set("user_id", userId);
    if (email) url.searchParams.set("email", email);
    url.searchParams.set("game_id", data.gameId);
    url.searchParams.set("quarter", String(data.quarter));
    if (game.prize_type) url.searchParams.set("prize_type", game.prize_type);
    if (game.prize_description) {
      url.searchParams.set("prize_description", game.prize_description);
    }
    if (sqRow?.id) url.searchParams.set("winning_square_id", sqRow.id);
    if (data.returnUrl) url.searchParams.set("return_url", data.returnUrl);

    return {
      alreadyVerified: false as const,
      submissionId,
      redirectUrl: url.toString(),
    };
  });

export const getPrizeClaim = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ gameId: z.string().uuid(), quarter: z.number().int().min(1).max(4) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {
      const { data: qr, error } = await supabaseAdmin
        .from("quarter_results")
        .select(
          "id, winner_user_id, age_verification_required, age_verified, age_verification_provider, age_verification_status, age_verification_submission_id, prize_claim_status",
        )
        .eq("game_id", data.gameId)
        .eq("quarter", data.quarter)
        .maybeSingle();
      if (error || !qr) return null;
      return { ...qr, isWinner: qr.winner_user_id === userId };
    } catch (e) {
      console.error("getPrizeClaim failed:", e);
      return null;
    }
  });
