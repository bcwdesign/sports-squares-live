// NFL matchup picker used on the New Game screen. Loads the upcoming NFL
// schedule from the server (BALLDONTLIE, server-side key only) and lets the
// host pick the exact matchup their squares board follows.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Tv } from "lucide-react";
import { fetchUpcomingNflGames } from "@/lib/balldontlie.functions";
import type { NormalizedLiveGame } from "@/lib/balldontlie.types";
import { LIVE_STATE_LABEL } from "@/lib/balldontlie.types";
import { invokeAuthed } from "@/lib/serverFnClient";

type Props = {
  selectedId: string | null;
  onSelect: (game: NormalizedLiveGame) => void;
};

function kickoffLabel(iso: string | null) {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayKey(iso: string | null) {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function NflGamePicker({ selectedId, onSelect }: Props) {
  const [games, setGames] = useState<NormalizedLiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invokeAuthed(fetchUpcomingNflGames, { daysAhead: 14 });
      if (res.error) {
        setError(res.error);
        setGames([]);
      } else {
        setGames(res.games);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the NFL schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups: Array<[string, NormalizedLiveGame[]]> = [];
  for (const g of games) {
    const key = dayKey(g.start_time);
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(g);
    else groups.push([key, [g]]);
  }

  return (
    <div className="rounded-2xl border border-border bg-[color:var(--surface)]/60 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-display font-bold">Pick an NFL Game</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Teams, kickoff and live scoring fill in automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Reload NFL schedule"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="font-mono text-xs uppercase tracking-widest">Loading NFL games...</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 p-4 text-center">
          <Tv className="w-6 h-6 mx-auto text-[color:var(--neon-orange)] mb-2" />
          <div className="font-display font-bold text-sm">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/40 text-[10px] font-mono uppercase tracking-widest text-[color:var(--neon-orange)] hover:bg-[color:var(--neon-orange)]/10 transition"
          >
            Try again
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            You can still enter the teams by hand and score the game manually.
          </p>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No NFL games in the next two weeks.
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="max-h-[22rem] overflow-y-auto -mx-1 px-1 space-y-4">
          {groups.map(([day, list]) => (
            <div key={day}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 sticky top-0 bg-[color:var(--surface)]/90 backdrop-blur py-1">
                {day}
              </div>
              <ul className="space-y-2" role="list">
                {list.map((g) => {
                  const active = selectedId === g.external_game_id;
                  return (
                    <li key={g.external_game_id}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(g)}
                        className={`w-full text-left rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--neon-blue)] ${
                          active
                            ? "border-[color:var(--neon-green)] bg-[color:var(--neon-green)]/10"
                            : "border-border bg-background/40 hover:border-[color:var(--neon-blue)]/60 hover:bg-[color:var(--neon-blue)]/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-display font-bold text-base truncate">
                              {g.away_team_abbreviation || g.away_team_name} @{" "}
                              {g.home_team_abbreviation || g.home_team_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate hidden sm:block">
                              {g.away_team_name} at {g.home_team_name}
                            </div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                              {g.postseason ? "Postseason" : g.week ? `Week ${g.week}` : "NFL"} ·{" "}
                              {kickoffLabel(g.start_time)} · {LIVE_STATE_LABEL[g.status_state]}
                            </div>
                          </div>
                          {g.status_state !== "scheduled" && (
                            <div className="font-mono font-bold text-lg text-[color:var(--neon-blue)] tabular-nums shrink-0">
                              {g.away_score}-{g.home_score}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
