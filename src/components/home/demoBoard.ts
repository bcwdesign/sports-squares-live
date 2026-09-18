import type { Game, Square } from "@/lib/types";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Static, client-only demo data for the marketing board illustrations. */
export const DEMO_GAME: Game = {
  id: "demo",
  host_id: "demo-host",
  name: "River City Hawks vs Metro Knights",
  sport: "NFL",
  home_team: "River City Hawks",
  away_team: "Metro Knights",
  game_date_time: null,
  status: "live",
  invite_code: "DEMO",
  max_squares_per_user: 3,
  entry_amount_label: null,
  home_axis: DIGITS,
  away_axis: DIGITS,
  home_score: 27,
  away_score: 24,
  quarter: 3,
  clock: "04:12",
  created_at: "",
};

const NAMES = ["Ava", "Ben", "Cruz", "Dana", "Eli", "Faye", "Gus", "Hana", "Ivan", "Jo"];

/** Deterministic pseudo-owners so the demo board looks lived-in without any data calls. */
export const DEMO_SQUARES: Square[] = Array.from({ length: 100 }, (_, idx) => {
  const row = Math.floor(idx / 10);
  const col = idx % 10;
  const taken = (idx * 7 + row * 3) % 5 !== 0;
  return {
    id: `demo-${idx}`,
    game_id: "demo",
    row,
    col,
    owner_id: taken ? `u-${idx % 10}` : null,
    owner_name: taken ? NAMES[(idx * 3 + col) % NAMES.length] : null,
  };
});

/** Away digit 7 (row) × home digit 4 (col). */
export const DEMO_WINNING_INDEX = 7 * 10 + 4;
