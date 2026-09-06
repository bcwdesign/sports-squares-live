// Shared (client + server safe) types for the BALLDONTLIE live score
// integration (NBA + NFL). No runtime code lives here — types only — so
// client modules can import these without pulling any server-only
// dependencies into the client bundle.

export type SportKey = "NBA" | "NFL";

/** Lifecycle state, normalized across both sports. */
export type LiveGameState =
  | "scheduled"
  | "in_progress"
  | "final"
  | "postponed"
  | "canceled"
  | "delayed"
  | "suspended"
  | "abandoned"
  | "unknown";

export type NormalizedLiveGame = {
  sport: SportKey;
  external_game_id: string;
  home_team_id: string;
  home_team_name: string;
  home_team_abbreviation: string;
  away_team_id: string;
  away_team_name: string;
  away_team_abbreviation: string;
  home_score: number;
  away_score: number;
  period: number | null;
  game_clock: string | null;
  game_status: string | null;
  /** Normalized lifecycle state — prefer this over free-form `game_status`. */
  status_state: LiveGameState;
  /** ISO kickoff/tipoff timestamp when the provider supplies one. */
  start_time: string | null;
  /** NFL only. */
  week?: number | null;
  season?: number | null;
  postseason?: boolean;
  venue?: string | null;
};

/** States where the local squares game should be marked completed. */
export function isFinalState(state: LiveGameState): boolean {
  return state === "final";
}

/** States where polling should continue but conservatively. */
export function isStalledState(state: LiveGameState): boolean {
  return state === "postponed" || state === "delayed" || state === "suspended" || state === "unknown";
}

export const LIVE_STATE_LABEL: Record<LiveGameState, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  final: "Final",
  postponed: "Postponed",
  canceled: "Canceled",
  delayed: "Delayed",
  suspended: "Suspended",
  abandoned: "Abandoned",
  unknown: "Unknown",
};
