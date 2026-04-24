// Mock real-time game state with localStorage + simulated updates.
// Swap with Firebase/Lovable Cloud for production.

export type Square = {
  index: number; // 0..99
  owner: string | null;
};

export type ChatMessage = {
  id: string;
  user: string;
  text: string;
  ts: number;
};

export type GameState = {
  id: string;
  homeTeam: { name: string; abbr: string; color: string };
  awayTeam: { name: string; abbr: string; color: string };
  tipoff: number; // ms epoch
  locked: boolean;
  homeAxis: number[]; // 10 digits 0-9 randomized at lock
  awayAxis: number[];
  squares: Square[];
  homeScore: number;
  awayScore: number;
  quarter: 1 | 2 | 3 | 4 | 5; // 5 = final
  clock: string;
  quarterWinners: { q: 1 | 2 | 3 | 4; squareIndex: number | null; payout: number }[];
  chat: ChatMessage[];
};

const KEY = "sports-squares-live-state";
const USER_KEY = "sports-squares-live-user";

const MOCK_USERS = ["Marcus", "Jordan", "Ava", "Kai", "Sam", "Riley", "Drew", "Casey", "Nova", "Zion"];

function shuffled() {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seedSquares(): Square[] {
  const squares: Square[] = Array.from({ length: 100 }, (_, i) => ({ index: i, owner: null }));
  // pre-claim ~32 squares with mock users
  const taken = new Set<number>();
  while (taken.size < 32) taken.add(Math.floor(Math.random() * 100));
  taken.forEach((i) => {
    squares[i].owner = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
  });
  return squares;
}

export function defaultState(): GameState {
  return {
    id: "nba-finals-g5",
    homeTeam: { name: "Celtics", abbr: "BOS", color: "var(--neon-green)" },
    awayTeam: { name: "Mavericks", abbr: "DAL", color: "var(--neon-blue)" },
    tipoff: Date.now() + 1000 * 60 * 12, // 12 min
    locked: false,
    homeAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    awayAxis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    squares: seedSquares(),
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    clock: "12:00",
    quarterWinners: [
      { q: 1, squareIndex: null, payout: 250 },
      { q: 2, squareIndex: null, payout: 500 },
      { q: 3, squareIndex: null, payout: 250 },
      { q: 4, squareIndex: null, payout: 1000 },
    ],
    chat: [
      { id: "1", user: "Jordan", text: "let's go boston 🍀", ts: Date.now() - 60000 },
      { id: "2", user: "Ava", text: "i need a 7-3 so bad", ts: Date.now() - 30000 },
    ],
  };
}

export function loadState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = defaultState();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as GameState;
  } catch {
    return defaultState();
  }
}

export function saveState(s: GameState) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("squares:update"));
}

export function resetState(): GameState {
  const s = defaultState();
  saveState(s);
  return s;
}

export function getUser(): string {
  if (typeof window === "undefined") return "You";
  let u = localStorage.getItem(USER_KEY);
  if (!u) {
    u = "You";
    localStorage.setItem(USER_KEY, u);
  }
  return u;
}

export function setUser(name: string) {
  localStorage.setItem(USER_KEY, name);
}

export function squareCoord(index: number) {
  return { row: Math.floor(index / 10), col: index % 10 };
}

export function winningIndex(state: GameState, home: number, away: number) {
  const homeDigit = home % 10;
  const awayDigit = away % 10;
  const col = state.homeAxis.indexOf(homeDigit);
  const row = state.awayAxis.indexOf(awayDigit);
  return row * 10 + col;
}
