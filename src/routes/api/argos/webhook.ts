// Argos Identity webhook receiver.
//
// SECURITY:
// - ARGOS_WEBHOOK_SECRET is required: callers MUST send it as the
//   `x-argos-signature` header. Without it, the endpoint refuses the request.
// - Uses supabaseAdmin (service role) to bypass RLS for the update — the
//   route is the only writer of webhook-driven verification status.
//
// EXPECTED PAYLOAD SHAPE (Argos ID Check):
//   {
//     "event": "submission.approved" | "submission.rejected" | "submission.created" | ...
//     "submission_id": "...",
//     "user_id": "...",          // echoed back from the start flow
//     "email": "...",            // echoed back from the start flow
//     "status": "approved" | "rejected" | "pending" | "submitted" | "created" | "updated" | "cancelled",
//     ...
//   }
//
// MATCHING: submission_id is the primary key for matching. user_id + email
// are used as a fallback when submission_id is missing.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ArgosEvent = {
  event?: string;
  submission_id?: string;
  submissionId?: string;
  user_id?: string;
  userId?: string;
  email?: string;
  status?: string;
  result?: string;
  decision?: string;
  game_id?: string;
  quarter?: string | number;
};

function mapStatus(payload: ArgosEvent): {
  age_verification_status: "passed" | "failed" | "pending" | "cancelled";
  age_verified: boolean;
} {
  const raw = (
    payload.status ||
    payload.result ||
    payload.decision ||
    payload.event ||
    ""
  )
    .toString()
    .toLowerCase();

  if (/approved|passed|verified|success/.test(raw)) {
    return { age_verification_status: "passed", age_verified: true };
  }
  if (/rejected|failed|deny|denied/.test(raw)) {
    return { age_verification_status: "failed", age_verified: false };
  }
  if (/cancel/.test(raw)) {
    return { age_verification_status: "cancelled", age_verified: false };
  }
  return { age_verification_status: "pending", age_verified: false };
}

function mapClaimStatus(verStatus: string): string {
  switch (verStatus) {
    case "passed":
      return "verified_pending_claim";
    case "failed":
    case "cancelled":
      return "verification_failed";
    default:
      return "verification_required";
  }
}

export const Route = createFileRoute("/api/argos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ARGOS_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Argos webhook not configured", { status: 503 });
        }
        const signature =
          request.headers.get("x-argos-signature") ||
          request.headers.get("x-webhook-secret");
        if (signature !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: ArgosEvent;
        try {
          body = (await request.json()) as ArgosEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const submissionId = body.submission_id || body.submissionId;
        const userId = body.user_id || body.userId;
        if (!submissionId && !userId) {
          return new Response("Missing submission_id or user_id", { status: 400 });
        }

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const status = mapStatus(body);
        const update = {
          age_verification_status: status.age_verification_status,
          age_verified: status.age_verified,
          age_verification_provider: "argos",
          prize_claim_status: mapClaimStatus(status.age_verification_status),
          ...(status.age_verified ? { age_verified_at: new Date().toISOString() } : {}),
        };

        let query = admin.from("quarter_results").update(update as never);
        if (submissionId) {
          query = query.eq("age_verification_submission_id", submissionId);
        } else if (userId) {
          query = query.eq("winner_user_id", userId);
        }

        const { error } = await query;
        if (error) {
          return new Response(`DB error: ${error.message}`, { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
