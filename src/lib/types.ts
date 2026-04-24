// Shared game/data types matching the database schema.

export type GameStatus = "lobby" | "locked" | "live" | "completed";

export type Game = {
  id: string;
  host_id: string;
  name: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_date_time: string | null;
  status: GameStatus;
  invite_code: string;
  max_squares_per_user: number;
  entry_amount_label: string | null;
  home_axis: number[];
  away_axis: number[];
  home_score: number;
  away_score: number;
  quarter: number;
  clock: string;
  created_at: string;
};

export type Square = {
  id: string;
  game_id: string;
  row: number;
  col: number;
  owner_id: string | null;
  owner_name: string | null;
};

export type GamePlayer = {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
};

export type Message = {
  id: string;
  game_id: string;
  user_id: string;
  display_name: string;
  text: string;
  created_at: string;
};

export function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function shuffle10(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function winningSquareIndex(game: Game, home: number, away: number) {
  const homeDigit = home % 10;
  const awayDigit = away % 10;
  const col = game.home_axis.indexOf(homeDigit);
  const row = game.away_axis.indexOf(awayDigit);
  return row * 10 + col;
}
