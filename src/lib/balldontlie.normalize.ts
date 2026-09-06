// Pure normalization helpers for BALLDONTLIE payloads. No secrets, no
// network, no server-only imports — safe to unit test and to import anywhere.

import type { LiveGameState, NormalizedLiveGame } from "./balldontlie.types";

const NFL_STATES: LiveGameState[] = [
  "scheduled",
  "in_progress",
  "final",
  "postponed",
  "canceled",
  "delayed",
  "suspended",
  "abandoned",
  "unknown",
];

function toState(raw: unknown, statusText: string): LiveGameState {
  const v = typeof raw === "string" ? raw.toLowerCase().trim().replace(/[\s-]+/g, "_") : "";
  const found = NFL_STATES.find((s) => s === v);
  if (found) return found;
  // Fall back to the free-form status only when status_state is absent.
  const t = statusText.toLowerCase();
  if (t.includes("final")) return "final";
  if (t.includes("postpon")) return "postponed";
  if (t.includes("cancel")) return "canceled";
  if (t.includes("suspend")) return "suspended";
  if (t.includes("delay")) return "delayed";
  if (/\d{1,2}:\d{2}/.test(t) || t.includes("quarter") || t.includes("halftime") || /\bq[1-5]\b/.test(t)) {
    return "in_progress";
  }
  if (t.includes("scheduled") || t.includes("pre")) return "scheduled";
  return "unknown";
}

/** Only accept a genuine MM:SS clock; never invent one. */
function extractClock(statusText: string): string | null {
  const m = statusText.match(/\b(\d{1,2}):([0-5]\d)\b/);
  return m ? `${Number(m[1])}:${m[2]}` : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * NFL period mapping: Q1→1, Q2/halftime→2, Q3→3, Q4→4, OT→5.
 * Final regulation ends at 4, final OT at 5. Null quarter fields are never
 * treated as a scored zero.
 */
export function nflPeriod(
  state: LiveGameState,
  statusText: string,
  quarters: { home: (number | null)[]; away: (number | null)[]; homeOt: number | null; awayOt: number | null },
): number | null {
  const t = statusText.toLowerCase();
  const hasOt = quarters.homeOt !== null || quarters.awayOt !== null || /\bot\b|overtime/.test(t);

  if (state === "final") return hasOt ? 5 : 4;
  if (state === "scheduled") return null;

  if (/\bot\b|overtime/.test(t)) return 5;
  if (t.includes("halftime") || t.includes("half time")) return 2;
  const qm = t.match(/\bq(?:tr)?\s*([1-4])\b/) ?? t.match(/\b([1-4])(?:st|nd|rd|th)\b/);
  if (qm) return Number(qm[1]);

  if (state === "in_progress") {
    // Fall back to the deepest quarter with a reported (non-null) score.
    let deepest = 0;
    for (let i = 0; i < 4; i++) {
      if (quarters.home[i] !== null || quarters.away[i] !== null) deepest = i + 1;
    }
    if (hasOt) return 5;
    return deepest > 0 ? deepest : 1;
  }
  return null;
}

export function normalizeNflGame(item: unknown): NormalizedLiveGame | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const home = (obj.home_team ?? null) as Record<string, unknown> | null;
  const away = (obj.visitor_team ?? obj.away_team ?? null) as Record<string, unknown> | null;
  if (!home || !away) return null;

  const id = obj.id;
  const externalId = id !== undefined && id !== null ? String(id) : null;
  if (!externalId) return null;

  const statusText = typeof obj.status === "string" ? obj.status : "";
  const state = toState(obj.status_state, statusText);

  const quarters = {
    home: [num(obj.home_team_q1), num(obj.home_team_q2), num(obj.home_team_q3), num(obj.home_team_q4)],
    away: [
      num(obj.visitor_team_q1),
      num(obj.visitor_team_q2),
      num(obj.visitor_team_q3),
      num(obj.visitor_team_q4),
    ],
    homeOt: num(obj.home_team_ot),
    awayOt: num(obj.visitor_team_ot),
  };

  return {
    sport: "NFL",
    external_game_id: externalId,
    home_team_id: home.id !== undefined && home.id !== null ? String(home.id) : "",
    home_team_name: String(home.full_name ?? home.name ?? ""),
    home_team_abbreviation: String(home.abbreviation ?? ""),
    away_team_id: away.id !== undefined && away.id !== null ? String(away.id) : "",
    away_team_name: String(away.full_name ?? away.name ?? ""),
    away_team_abbreviation: String(away.abbreviation ?? ""),
    home_score: num(obj.home_team_score) ?? 0,
    away_score: num(obj.visitor_team_score) ?? 0,
    period: nflPeriod(state, statusText, quarters),
    game_clock: state === "in_progress" ? extractClock(statusText) : null,
    game_status: statusText || null,
    status_state: state,
    start_time: typeof obj.date === "string" ? obj.date : null,
    week: num(obj.week),
    season: num(obj.season),
    postseason: obj.postseason === true,
    venue: typeof obj.venue === "string" ? obj.venue : null,
  };
}
