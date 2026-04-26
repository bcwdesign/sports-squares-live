// Host-only "Live Score Sync" panel for /game/:id/live.
// - Connect modal lists current BALLDONTLIE live games (server-fetched)
// - Sync Now / Auto Sync toggle / Disconnect / Manual Override
// - Auto-sync polling runs in this component (host browser only) per spec.
//
// Realtime: the underlying `games` row is updated by syncGameScore on the
// server, and every player + the overlay receive the change through the
// existing Supabase realtime subscription in useGame / overlay route. This
// component does NOT broadcast directly.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  Sparkles,
  Tv,
  Unplug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchLiveNbaGames,
  connectLiveScore,
  disconnectLiveScore,
  setAutoSync,
  syncGameScore,
  manualScoreOverride,
  type NormalizedLiveGame,
} from "@/server/balldontlie.functions";
import { invokeAuthed } from "@/lib/serverFnClient";
import type { Game } from "@/lib/types";

type Props = {
  game: Game & {
    external_provider?: string | null;
    external_game_id?: string | null;
    external_home_team_name?: string | null;
    external_away_team_name?: string | null;
    score_source?: string | null;
    auto_sync_enabled?: boolean | null;
    last_score_sync_at?: string | null;
    last_score_sync_error?: string | null;
    game_status?: string | null;
  };
};

export function LiveScoreSyncPanel({ game }: Props) {
  const connected =
    game.external_provider === "balldontlie" && !!game.external_game_id;
  const autoSyncOn = !!game.auto_sync_enabled;
  const sourceLabel = useMemo(() => {
    switch (game.score_source) {
      case "api":
        return "BALLDONTLIE";
      case "manual_override":
        return "Manual Override";
      default:
        return "Manual";
    }
  }, [game.score_source]);

  const [connectOpen, setConnectOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // ---- Auto-sync polling (host only) --------------------------------------
  // 10s when status is live, 60s for scheduled/pre-game, off for final.
  // Determined from the upstream game_status string (BALLDONTLIE returns
  // strings like "Final", "Halftime", "Q3 04:21", etc.).
  useEffect(() => {
    if (!connected || !autoSyncOn) return;

    const status = (game.game_status ?? "").toLowerCase();
    if (status.includes("final")) return; // stop

    const intervalMs =
      status.includes("scheduled") || status.includes("pre")
        ? 60_000
        : 10_000;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await invokeAuthed(syncGameScore, { gameId: game.id });
      } catch (e) {
        // Silent — error surfaces via last_score_sync_error on the row.
        console.warn("auto-sync failed:", e);
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected, autoSyncOn, game.id, game.game_status]);

  const onSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await invokeAuthed(syncGameScore, { gameId: game.id });
      if (res.synced) {
        toast.success(`Synced — ${res.home_score}-${res.away_score}`);
      } else {
        toast.message(res.reason ?? "Nothing to update");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const onToggleAutoSync = async () => {
    setToggling(true);
    try {
      await invokeAuthed(setAutoSync, { gameId: game.id, enabled: !autoSyncOn });
      toast.success(`Auto sync ${!autoSyncOn ? "on" : "off"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't toggle auto sync");
    } finally {
      setToggling(false);
    }
  };

  const onDisconnect = async () => {
    if (!window.confirm("Disconnect the live NBA feed? Score control returns to manual.")) return;
    setDisconnecting(true);
    try {
      await invokeAuthed(disconnectLiveScore, { gameId: game.id });
      toast.success("Live feed disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-[color:var(--neon-blue)]/30 bg-[color:var(--neon-blue)]/5 p-3">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-blue)] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-blue)]">
          Live Score Sync
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Source: <span className="text-foreground">{sourceLabel}</span>
        </span>
        {connected && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hidden sm:inline">
            ·{" "}
            <span className="text-foreground">
              {game.external_away_team_name ?? "Away"} @{" "}
              {game.external_home_team_name ?? "Home"}
            </span>
          </span>
        )}
        {game.last_score_sync_error && (
          <span className="ml-auto text-[10px] font-mono text-[color:var(--neon-orange)] truncate max-w-[40%]">
            ⚠ {game.last_score_sync_error}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!connected ? (
          <button
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-blue)]/40 bg-[color:var(--neon-blue)]/10 text-[color:var(--neon-blue)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-blue)]/20 transition"
          >
            <Plug className="w-3.5 h-3.5" /> Connect NBA Live Score
          </button>
        ) : (
          <>
            <button
              onClick={onSyncNow}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-green)]/20 transition disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={onToggleAutoSync}
              disabled={toggling}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-mono uppercase tracking-widest transition disabled:opacity-50 ${
                autoSyncOn
                  ? "border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] hover:bg-[color:var(--neon-green)]/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              <PlugZap className="w-3.5 h-3.5" />
              Auto Sync {autoSyncOn ? "On" : "Off"}
            </button>
            <button
              onClick={() => setOverrideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-orange)]/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" /> Manual Override
            </button>
            <button
              onClick={onDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-[11px] font-mono uppercase tracking-widest hover:text-[color:var(--neon-orange)] hover:border-[color:var(--neon-orange)]/40 transition disabled:opacity-50"
            >
              <Unplug className="w-3.5 h-3.5" />
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </>
        )}
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {game.last_score_sync_at
            ? `Last sync ${new Date(game.last_score_sync_at).toLocaleTimeString()}`
            : "Never synced"}
        </span>
      </div>

      {connectOpen && (
        <ConnectModal
          gameId={game.id}
          onClose={() => setConnectOpen(false)}
        />
      )}

      {overrideOpen && (
        <ManualOverrideModal
          game={game}
          onClose={() => setOverrideOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Connect modal — fetches live NBA games and lets the host pick one.
// ============================================================================

function ConnectModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<NormalizedLiveGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await invokeAuthed(fetchLiveNbaGames, undefined as never);
        if (cancelledRef.current) return;
        if (res.error) {
          setError(res.error);
          setGames([]);
        } else {
          setGames(res.games);
        }
      } catch (e) {
        if (!cancelledRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load live games.");
        }
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    };
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const onSelect = async (g: NormalizedLiveGame) => {
    setSelecting(g.external_game_id);
    try {
      await invokeAuthed(connectLiveScore, {
        gameId,
        external_game_id: g.external_game_id,
        external_home_team_id: g.home_team_id,
        external_away_team_id: g.away_team_id,
        external_home_team_name: g.home_team_name,
        external_away_team_name: g.away_team_name,
      });
      toast.success(`Connected to ${g.away_team_abbreviation} @ ${g.home_team_abbreviation}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
      setSelecting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[color:var(--neon-blue)]/40 bg-[color:var(--surface)] p-5 shadow-[var(--shadow-card)] animate-scale-in max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-blue)]">
            BALLDONTLIE
          </div>
          <div className="font-display font-bold text-xl mt-1">Pick a Live NBA Game</div>
          <p className="text-xs text-muted-foreground mt-1">
            Scores will sync automatically into your Squares board, overlay, and winner detection.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="font-mono text-xs uppercase tracking-widest">Loading live games...</span>
            </div>
          )}
          {!loading && error && (
            <div className="rounded-xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 p-4 text-center">
              <Tv className="w-6 h-6 mx-auto text-[color:var(--neon-orange)] mb-2" />
              <div className="font-display font-bold text-base">{error}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Try again later, or use manual scoring in the meantime.
              </p>
            </div>
          )}
          {!loading && !error && (
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.external_game_id}>
                  <button
                    onClick={() => onSelect(g)}
                    disabled={selecting !== null}
                    className="w-full text-left rounded-xl border border-border bg-background/40 p-3 hover:border-[color:var(--neon-blue)]/60 hover:bg-[color:var(--neon-blue)]/5 transition disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-display font-bold text-base">
                          {g.away_team_abbreviation || g.away_team_name} @{" "}
                          {g.home_team_abbreviation || g.home_team_name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                          {g.game_status ?? "Live"}
                          {g.period ? ` · Q${g.period}` : ""}
                          {g.game_clock ? ` · ${g.game_clock}` : ""}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-xl text-[color:var(--neon-blue)] tabular-nums">
                        {g.away_score}-{g.home_score}
                      </div>
                    </div>
                    {selecting === g.external_game_id && (
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[color:var(--neon-blue)] mt-2">
                        Connecting...
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Manual override modal — host can correct/override the score without
// disconnecting the API. Sets score_source = 'manual_override'.
// ============================================================================

function ManualOverrideModal({ game, onClose }: { game: Props["game"]; onClose: () => void }) {
  const [home, setHome] = useState(String(game.home_score));
  const [away, setAway] = useState(String(game.away_score));
  const [period, setPeriod] = useState(String(game.period ?? game.quarter ?? 1));
  const [clock, setClock] = useState(game.game_clock ?? game.clock ?? "12:00");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const homeN = parseInt(home, 10);
    const awayN = parseInt(away, 10);
    const periodN = parseInt(period, 10);
    if (Number.isNaN(homeN) || Number.isNaN(awayN) || homeN < 0 || awayN < 0) {
      toast.error("Scores must be non-negative integers");
      return;
    }
    if (Number.isNaN(periodN) || periodN < 1 || periodN > 8) {
      toast.error("Period must be 1-8");
      return;
    }
    if (!/^[0-9]{1,2}:[0-5][0-9]$/.test(clock.trim())) {
      toast.error("Clock must be MM:SS");
      return;
    }
    setSaving(true);
    try {
      await invokeAuthed(manualScoreOverride, {
        gameId: game.id,
        home_score: homeN,
        away_score: awayN,
        period: periodN,
        game_clock: clock.trim(),
      });
      toast.success("Score overridden — API sync remains connected");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Override failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--surface)] p-5 shadow-[var(--shadow-card)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)]">
            Manual Override
          </div>
          <div className="font-display font-bold text-xl mt-1">Correct the Live Score</div>
          <p className="text-xs text-muted-foreground mt-1">
            Saves an authoritative score now. The BALLDONTLIE feed stays
            connected — click Sync Now or wait for auto-sync to resume from the API.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Field label={game.external_home_team_name ?? game.home_team ?? "Home"} value={home} onChange={setHome} />
          <Field label={game.external_away_team_name ?? game.away_team ?? "Away"} value={away} onChange={setAway} />
          <Field label="Period" value={period} onChange={setPeriod} />
          <Field label="Clock (MM:SS)" value={clock} onChange={setClock} />
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] text-xs font-mono uppercase tracking-widest hover:bg-[color:var(--neon-orange)]/20 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : "Save Override"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono text-foreground"
      />
    </label>
  );
}
