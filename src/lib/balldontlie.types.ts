// Shared (client + server safe) types for the BALLDONTLIE live score
// integration. No runtime code lives here — types only — so client modules
// can import these without pulling any server-only dependencies into the
// client bundle.

export type NormalizedLiveGame = {
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
};
