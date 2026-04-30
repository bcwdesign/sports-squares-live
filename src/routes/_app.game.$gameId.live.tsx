import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { ChatPanel } from "@/components/ChatPanel";
import { NeonButton } from "@/components/NeonButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import { LiveScoreSyncPanel } from "@/components/LiveScoreSyncPanel";
import { supabase } from "@/integrations/supabase/client";
import { winningSquareIndex } from "@/lib/types";
import { Maximize2, QrCode, RotateCcw, Sparkles, Trophy, Tv, Zap, X, Save, Flag } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export const Route = createFileRoute("/_app/game/$gameId/live")({
  head: () => ({ meta: [{ title: "Live — Clutch Squares" }] }),
  component: LivePage,
});

function LivePage() {
  const { gameId } = Route.useParams();
  const { game, squares, players, loading } = useGame(gameId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [watchMode, setWatchMode] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Fetch the share token for this game and keep it in sync. The `games` table
  // is already subscribed via useGame; we re-poll when the row changes so a
  // rotated token (e.g. host re-issued the link) is picked up automatically.
  useEffect(() => {
    let cancelled = false;
    const loadToken = async () => {
      const { data } = await supabase
        .from("games")
        .select("share_token")
        .eq("id", gameId)
        .maybeSingle();
      if (cancelled) return;
      const token = (data as { share_token?: string } | null)?.share_token ?? null;
      setShareToken((prev) => (prev === token ? prev : token));
    };
    loadToken();
    const channel = supabase
      .channel(`game-share-token:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const next = (payload.new as { share_token?: string } | null)?.share_token ?? null;
          if (next) setShareToken((prev) => (prev === next ? prev : next));
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Regenerate the QR whenever the token changes so it never goes stale.
  useEffect(() => {
    if (!shareToken) {
      setQrDataUrl(null);
      setOverlayUrl(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    const url = `${window.location.origin}/overlay/${shareToken}`;
    QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((png) => {
        if (cancelled) return;
        setOverlayUrl(url);
        setQrDataUrl(png);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate QR");
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => { cancelled = true; };
  }, [shareToken]);

  const showQr = () => {
    if (!shareToken) {
      toast.error("Share link not ready yet");
      return;
    }
    setQrOpen(true);
  };

  const isHost = !!user && !!game && game.host_id === user.id;
  const [demoRunning, setDemoRunning] = useState(false);
  const demoCancelRef = useRef(false);
  const [resetting, setResetting] = useState(false);

  // Manual score editor (host only). Per-quarter draft so switching the
  // Quarter input doesn't wipe values you've typed for another quarter.
  // - `scoreDrafts` maps quarter # -> { home, away, clock }
  // - `activeQuarter` is the currently-edited quarter (separate input)
  // Drafts persist for the lifetime of the page; "Reset to Lobby" clears them.
  type QuarterDraft = { home: string; away: string; clock: string };
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, QuarterDraft>>({});
  const [activeQuarter, setActiveQuarter] = useState<string>("1");
  const [draftsSeeded, setDraftsSeeded] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalOpen, setConfirmFinalOpen] = useState(false);

  // One-time load of persisted drafts from the DB so the host's typed values
  // survive refresh and follow them across devices. Falls back to seeding from
  // the live game when no drafts exist for this host yet.
  useEffect(() => {
    if (!game || !user || !isHost || draftsSeeded) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("score_drafts")
        .select("quarter,home,away,clock")
        .eq("game_id", game.id)
        .eq("user_id", user.id);
      if (cancelled) return;
      const map: Record<number, QuarterDraft> = {};
      (data ?? []).forEach((d: { quarter: number; home: string; away: string; clock: string }) => {
        map[d.quarter] = { home: d.home, away: d.away, clock: d.clock };
      });
      // Always make sure the current live quarter has a draft entry to edit.
      if (!map[game.quarter]) {
        map[game.quarter] = {
          home: String(game.home_score),
          away: String(game.away_score),
          clock: game.clock,
        };
      }
      setScoreDrafts(map);
      setActiveQuarter(String(game.quarter));
      setDraftsSeeded(true);
    })();
    return () => { cancelled = true; };
  }, [game, user, isHost, draftsSeeded]);

  // Debounced persistence: whenever drafts change after the initial load,
  // upsert the affected quarter row(s) so the values follow the host across
  // refreshes and devices. Per-quarter unique constraint dedupes on conflict.
  const lastPersistedRef = useRef<Record<number, string>>({});
  useEffect(() => {
    if (!game || !user || !isHost || !draftsSeeded) return;
    const handle = setTimeout(async () => {
      const dirty: Array<{ q: number; d: QuarterDraft }> = [];
      for (const [qStr, d] of Object.entries(scoreDrafts)) {
        const q = parseInt(qStr, 10);
        // Only persist drafts that pass validation — keep the DB clean even
        // while the host is mid-typing. Invalid values stay local until fixed.
        if (validateScore(d.home) || validateScore(d.away) || validateClock(d.clock)) continue;
        const sig = `${d.home}|${d.away}|${d.clock}`;
        if (lastPersistedRef.current[q] !== sig) {
          dirty.push({ q, d });
        }
      }
      if (dirty.length === 0) return;
      const rows = dirty.map(({ q, d }) => ({
        game_id: game.id,
        user_id: user.id,
        quarter: q,
        home: d.home,
        away: d.away,
        clock: d.clock,
      }));
      const { error } = await supabase
        .from("score_drafts")
        .upsert(rows, { onConflict: "game_id,user_id,quarter" });
      if (!error) {
        dirty.forEach(({ q, d }) => {
          lastPersistedRef.current[q] = `${d.home}|${d.away}|${d.clock}`;
        });
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [scoreDrafts, game, user, isHost, draftsSeeded]);

  const activeQuarterNum = Math.max(1, Math.min(8, parseInt(activeQuarter || "1", 10) || 1));
  const draft: QuarterDraft = scoreDrafts[activeQuarterNum] ?? { home: "0", away: "0", clock: "12:00" };

  // ---- Validation helpers --------------------------------------------------
  // Score: required, non-negative integer 0-999. Empty / non-numeric / negative
  // / decimals are all invalid. Clock: required MM:SS where M is 0-99 and
  // S is 00-59. We reject anything else so we never persist garbage to the DB.
  const SCORE_RE = /^\d{1,3}$/;
  const CLOCK_RE = /^([0-9]{1,2}):([0-5][0-9])$/;
  const validateScore = (v: string): string | null => {
    const t = v.trim();
    if (!t) return "Required";
    if (!SCORE_RE.test(t)) return "0-999 only";
    return null;
  };
  const validateClock = (v: string): string | null => {
    const t = v.trim();
    if (!t) return "Required";
    if (!CLOCK_RE.test(t)) return "Use MM:SS";
    return null;
  };
  const draftErrors = {
    home: validateScore(draft.home),
    away: validateScore(draft.away),
    clock: validateClock(draft.clock),
  };
  const draftValid = !draftErrors.home && !draftErrors.away && !draftErrors.clock;

  const updateActiveDraft = (patch: Partial<QuarterDraft>) => {
    setScoreDrafts((prev) => ({
      ...prev,
      [activeQuarterNum]: { ...(prev[activeQuarterNum] ?? { home: "0", away: "0", clock: "12:00" }), ...patch },
    }));
  };

  // Switching Quarter loads (or initializes) that quarter's draft.
  const setQuarterInput = (v: string) => {
    setActiveQuarter(v);
    const q = Math.max(1, Math.min(8, parseInt(v || "1", 10) || 1));
    setScoreDrafts((prev) => {
      if (prev[q]) return prev;
      // Seed new quarter from the current live score so the host doesn't start from 0.
      return {
        ...prev,
        [q]: game
          ? { home: String(game.home_score), away: String(game.away_score), clock: "12:00" }
          : { home: "0", away: "0", clock: "12:00" },
      };
    });
  };

  const syncDraftFromGame = () => {
    if (!game) return;
    setActiveQuarter(String(game.quarter));
    setScoreDrafts((prev) => ({
      ...prev,
      [game.quarter]: {
        home: String(game.home_score),
        away: String(game.away_score),
        clock: game.clock,
      },
    }));
    toast.message("Synced from live score");
  };

  const parseScore = () => {
    const home = Math.max(0, Math.min(999, parseInt(draft.home || "0", 10) || 0));
    const away = Math.max(0, Math.min(999, parseInt(draft.away || "0", 10) || 0));
    const quarter = activeQuarterNum;
    const clock = draft.clock.trim() || "00:00";
    return { home, away, quarter, clock };
  };

  const saveScore = async (opts?: { final?: boolean }) => {
    if (!isHost || !game) return;
    if (!draftValid) {
      toast.error("Fix invalid score or clock before saving");
      return;
    }
    const { home, away, quarter, clock } = parseScore();
    const final = !!opts?.final;
    if (final) setFinalizing(true); else setSavingScore(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          home_score: home,
          away_score: away,
          quarter,
          clock: final ? "00:00" : clock,
          status: final ? "completed" : "live",
        })
        .eq("id", game.id);
      if (error) throw error;
      // Reflect saved values back into this quarter's draft.
      setScoreDrafts((prev) => ({
        ...prev,
        [quarter]: { home: String(home), away: String(away), clock: final ? "00:00" : clock },
      }));
      toast.success(final ? "Final score set — winner locked" : `Q${quarter} score updated`);
    } catch (e) {
      toast.error(final ? "Couldn't set final score" : "Couldn't update score");
    } finally {
      setSavingScore(false);
      setFinalizing(false);
    }
  };

  // Host-only "Demo Score Sequence": cycles through a deterministic set of
  // quarter scores so the overlay can be demonstrated end-to-end without a
  // real live feed. Pure DB writes — every player and the overlay see the
  // same updates via the existing realtime subscriptions.
  const runDemoSequence = async () => {
    if (!isHost || !game || demoRunning) return;
    demoCancelRef.current = false;
    setDemoRunning(true);
    toast.message("Demo sequence started");
    const steps: Array<{ q: number; clock: string; home: number; away: number }> = [
      { q: 1, clock: "10:00", home: 7, away: 5 },
      { q: 1, clock: "06:00", home: 14, away: 11 },
      { q: 1, clock: "00:00", home: 24, away: 22 },
      { q: 2, clock: "08:00", home: 33, away: 30 },
      { q: 2, clock: "00:00", home: 49, away: 47 },
      { q: 3, clock: "07:00", home: 60, away: 58 },
      { q: 3, clock: "00:00", home: 73, away: 75 },
      { q: 4, clock: "05:00", home: 88, away: 86 },
      { q: 4, clock: "00:00", home: 102, away: 99 },
    ];
    try {
      for (const step of steps) {
        if (demoCancelRef.current) break;
        const { error } = await supabase
          .from("games")
          .update({
            home_score: step.home,
            away_score: step.away,
            quarter: step.q,
            clock: step.clock,
            status: "live",
          })
          .eq("id", game.id);
        if (error) throw error;
        await new Promise((r) => setTimeout(r, 2200));
      }
      if (!demoCancelRef.current) toast.success("Demo sequence complete");
    } catch (e) {
      toast.error("Demo sequence failed");
    } finally {
      setDemoRunning(false);
    }
  };

  // Host-only: reset scores, quarter, clock, and status back to a fresh live
  // tip-off. Cancels any in-flight demo sequence and keeps the board (claimed
  // squares + axis numbers) intact so the demo can be re-run cleanly without
  // disturbing players' picks. Does NOT reshuffle axes — use the lobby flow
  // for a brand-new game.
  const resetGame = async () => {
    if (!isHost || !game || resetting) return;
    const ok = window.confirm(
      "Reset the game back to the lobby? Scores, quarter, and clock will clear. Claimed squares stay so players can keep their picks or claim more.",
    );
    if (!ok) return;
    demoCancelRef.current = true;
    setResetting(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          home_score: 0,
          away_score: 0,
          quarter: 1,
          clock: "12:00",
          status: "lobby",
        })
        .eq("id", game.id);
      if (error) throw error;
      // Clear all per-quarter drafts (DB + local) so the next round starts fresh.
      if (user) {
        await supabase.from("score_drafts").delete().eq("game_id", game.id).eq("user_id", user.id);
      }
      lastPersistedRef.current = {};
      setScoreDrafts({ 1: { home: "0", away: "0", clock: "12:00" } });
      setActiveQuarter("1");
      toast.success("Game reset — back in the lobby");
      navigate({ to: "/game/$gameId/lobby", params: { gameId } });
    } catch (e) {
      toast.error("Couldn't reset the game");
    } finally {
      setResetting(false);
    }
  };

  // Track winning square (current leader) — used for grid highlighting and as
  // the snapshot source when a quarter ends.
  const winIdx = game ? winningSquareIndex(game, game.home_score, game.away_score) : -1;
  const winRow = winIdx >= 0 ? Math.floor(winIdx / 10) : -1;
  const winCol = winIdx >= 0 ? winIdx % 10 : -1;
  const winSq = winIdx >= 0 ? squares.find((s) => s.row === winRow && s.col === winCol) : undefined;
  const scoresEntered = !!game && (game.home_score > 0 || game.away_score > 0);
  const hasWinner = !!winSq?.owner_id;

  const winnerAvatar = useMemo(() => {
    if (!winSq?.owner_id) return null;
    return players.find((p) => p.user_id === winSq.owner_id)?.avatar_url ?? null;
  }, [players, winSq?.owner_id]);

  // Current (live) leader info — kept in a ref so we can snapshot it the
  // moment a quarter ends or the game completes.
  const currentLeaderInfo = hasWinner && game
    ? {
        ownerName: winSq!.owner_name ?? "Player",
        ownerAvatarUrl: winnerAvatar,
        homeDigit: game.home_score % 10,
        awayDigit: game.away_score % 10,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        quarter: game.quarter,
      }
    : null;
  const lastLeaderRef = useRef<typeof currentLeaderInfo>(null);
  useEffect(() => {
    lastLeaderRef.current = currentLeaderInfo;
  });

  // Celebration state — only set on milestones (quarter advance OR game end).
  const [celebration, setCelebration] = useState<{
    info: NonNullable<typeof currentLeaderInfo>;
    key: string;
  } | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  // Detect milestones. Track previous quarter + status across renders.
  const prevQuarterRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    const prevQ = prevQuarterRef.current;
    const prevS = prevStatusRef.current;
    prevQuarterRef.current = game.quarter;
    prevStatusRef.current = game.status;

    // First observation — establish baseline, no celebration.
    if (prevQ === null) return;

    // Game just completed → celebrate the final quarter's winner.
    if (prevS !== "completed" && game.status === "completed") {
      const info = lastLeaderRef.current ?? currentLeaderInfo;
      if (info) {
        setCelebration({ info, key: `final:${info.quarter}:${info.ownerName}` });
        toast.success(`🏆 ${info.ownerName} wins the game!`);
      }
      return;
    }

    // Quarter advanced → celebrate the just-ended quarter's winner.
    if (game.quarter > prevQ) {
      const info = lastLeaderRef.current;
      if (info) {
        setCelebration({ info, key: `q${prevQ}:${info.ownerName}` });
        toast.success(`🏆 ${info.ownerName} wins Q${prevQ}!`);
      }
    }
  }, [game?.quarter, game?.status]);

  // Route to results when complete
  useEffect(() => {
    if (game?.status === "completed") {
      const t = setTimeout(() => navigate({ to: "/game/$gameId/results", params: { gameId } }), 2500);
      return () => clearTimeout(t);
    }
  }, [game?.status, gameId, navigate]);

  if (loading || !game) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading...</div>;
  }

  return (
    <div className={watchMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "min-h-screen"}>
      <WinnerCelebration
        winner={celebration?.info ?? null}
        winnerKey={celebration?.key ?? "none"}
        replayKey={replayKey}
        variant="compact"
      />
      <TopBar game={game} />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-12">
        <div className="flex items-center justify-between mb-3 gap-2">
          <Link to="/game/$gameId/lobby" params={{ gameId }} className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Lobby</Link>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Link
              to="/game/$gameId/overlay"
              params={{ gameId }}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-orange)] transition"
            >
              <Tv className="w-3.5 h-3.5" /> {isHost ? "Open Overlay" : "View Live Overlay"}
            </Link>
            <button
              onClick={async () => {
                if (!overlayUrl) { toast.error("Share link not ready yet"); return; }
                try { await navigator.clipboard.writeText(overlayUrl); toast.success("Public overlay link copied"); }
                catch { toast.message(overlayUrl); }
              }}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-green)] transition"
            >
              <Trophy className="w-3.5 h-3.5" /> Share Overlay
            </button>
            <button
              onClick={showQr}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-green)] transition"
            >
              <QrCode className="w-3.5 h-3.5" /> Show QR
            </button>
            <button
              onClick={() => setWatchMode((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Watch Mode
            </button>
          </div>
        </div>

        {isHost && <LiveScoreSyncPanel game={game} />}

        {isHost && (
          <div className="mb-4 rounded-xl border border-border bg-[color:var(--surface)] p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-orange)] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Host Controls
              </span>
            </div>
            <button
              onClick={runDemoSequence}
              disabled={demoRunning || resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-orange)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cycle through fake quarter scores to demo the overlay"
            >
              <Zap className="w-3.5 h-3.5" />
              {demoRunning ? "Demo running..." : "Demo Score Sequence"}
            </button>
            <button
              onClick={resetGame}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-blue)]/40 bg-[color:var(--neon-blue)]/10 text-[color:var(--neon-blue)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-blue)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset scores and return to the lobby"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? "Resetting..." : "Reset to Lobby"}
            </button>
            <button
              onClick={() => {
                if (!hasWinner) { toast.message("No winner yet to celebrate"); return; }
                setReplayKey((k) => k + 1);
              }}
              disabled={!hasWinner}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-green)]/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Re-fire the winner celebration"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Replay Celebration
            </button>
          </div>
        )}

        {isHost && (
          <div className="mb-4 rounded-xl border border-[color:var(--neon-green)]/30 bg-[color:var(--neon-green)]/5 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-green)] animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-green)]">
                Manual Score Update · Q{activeQuarterNum}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono ml-auto hidden sm:inline">
                Drafts saved per quarter
              </span>
            </div>
            {/* Quarter chips: jump between drafted quarters without typing */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mr-1">Quarter:</span>
              {[1, 2, 3, 4].map((q) => {
                const has = !!scoreDrafts[q];
                const active = q === activeQuarterNum;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuarterInput(String(q))}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase tracking-widest border transition ${
                      active
                        ? "bg-[color:var(--neon-green)] text-background border-[color:var(--neon-green)]"
                        : has
                          ? "border-[color:var(--neon-green)]/40 text-[color:var(--neon-green)] hover:bg-[color:var(--neon-green)]/10"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    }`}
                    title={has ? `Q${q} draft: ${scoreDrafts[q].home}-${scoreDrafts[q].away}` : `Start Q${q} draft`}
                  >
                    Q{q}{has && !active ? " •" : ""}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <ScoreInput
                label={game.home_team || "Home"}
                colorVar="--neon-blue"
                value={draft.home}
                onChange={(v) => updateActiveDraft({ home: v })}
                inputMode="numeric"
                error={draftErrors.home}
              />
              <ScoreInput
                label={game.away_team || "Away"}
                colorVar="--neon-orange"
                value={draft.away}
                onChange={(v) => updateActiveDraft({ away: v })}
                inputMode="numeric"
                error={draftErrors.away}
              />
              <ScoreInput
                label="Quarter"
                colorVar="--neon-green"
                value={activeQuarter}
                onChange={setQuarterInput}
                inputMode="numeric"
              />
              <ScoreInput
                label="Clock"
                colorVar="--neon-blue"
                value={draft.clock}
                onChange={(v) => updateActiveDraft({ clock: v })}
                placeholder="MM:SS"
                error={draftErrors.clock}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => saveScore()}
                disabled={savingScore || finalizing || !draftValid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-blue)]/40 bg-[color:var(--neon-blue)]/10 text-[color:var(--neon-blue)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-blue)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={!draftValid ? "Fix invalid score or clock first" : undefined}
              >
                <Save className="w-3.5 h-3.5" />
                {savingScore ? "Saving..." : "Update Score"}
              </button>
              <button
                onClick={() => setConfirmFinalOpen(true)}
                disabled={savingScore || finalizing || !draftValid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-green)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={!draftValid ? "Fix invalid score or clock first" : "Mark game complete and lock the winner"}
              >
                <Flag className="w-3.5 h-3.5" />
                {finalizing ? "Finalizing..." : "Set Final Score"}
              </button>
              <button
                onClick={syncDraftFromGame}
                disabled={savingScore || finalizing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-[11px] font-mono uppercase tracking-widest hover:text-foreground hover:border-foreground/40 transition disabled:opacity-40"
                title="Reset the inputs to match the current live score"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sync from Live
              </button>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-auto">
                {draftValid
                  ? `Preview digits ${parseScore().home % 10}-${parseScore().away % 10}`
                  : "Invalid input — fix highlighted fields"}
              </span>
            </div>
          </div>
        )}

        {/* Now winning panel — adapts to no-winner / unclaimed / has-winner. */}
        <div className="rounded-2xl border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 p-4 mb-4 flex items-center gap-4 animate-scale-in">
          {hasWinner ? (
            <PlayerAvatar name={winSq!.owner_name} src={winnerAvatar} size="md" glow />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[color:var(--neon-orange)]/20 flex items-center justify-center text-[color:var(--neon-orange)] shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)]">
              {!scoresEntered
                ? "No winner yet"
                : hasWinner
                  ? "Currently winning"
                  : "Unclaimed square"}
            </div>
            <div className="font-display font-bold text-xl truncate">
              {!scoresEntered ? (
                <span className="text-muted-foreground">Waiting for first score...</span>
              ) : hasWinner ? (
                winSq!.owner_name
              ) : (
                <span className="text-muted-foreground">No owner on the winning square</span>
              )}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              {hasWinner ? "Waiting for next score update" : scoresEntered ? "Hang tight — next score may flip it" : "Scores appear once the game starts"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Digits</div>
            <div className="font-mono font-bold text-2xl text-[color:var(--neon-orange)] tabular-nums">
              {game.home_score % 10}-{game.away_score % 10}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-2 sm:p-4 shadow-[var(--shadow-card)]">
          <SquaresGrid
            game={game}
            squares={squares}
            userId={user?.id ?? null}
            selectedIndex={null}
            winningIndex={winIdx}
            showAxes
          />
        </div>

        {!watchMode && (
          <div className="mt-6">
            <ChatPanel gameId={game.id} />
          </div>
        )}

        {game.status === "completed" && (
          <Link to="/game/$gameId/results" params={{ gameId }} className="block mt-6">
            <NeonButton variant="green" className="w-full">View Final Results →</NeonButton>
          </Link>
        )}

        {!isHost && (
          <p className="text-center text-[10px] text-muted-foreground mt-4 font-mono uppercase tracking-widest">
            Host controls live scoring
          </p>
        )}
      </main>

      {qrOpen && (
        <div
          className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-green)]">Public Overlay</div>
              <div className="font-display font-bold text-xl mt-1">Scan to Watch Live</div>
              <p className="text-xs text-muted-foreground mt-1">Open this game's read-only TV overlay on any device.</p>
            </div>
            <div className="aspect-square rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden">
              {qrLoading || !qrDataUrl ? (
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Generating...</div>
              ) : (
                <img src={qrDataUrl} alt="Overlay QR code" className="w-full h-full object-contain" />
              )}
            </div>
            {overlayUrl && (
              <div className="mt-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Overlay Link</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={overlayUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono text-foreground"
                  />
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(overlayUrl); toast.success("Copied"); }
                      catch { toast.message(overlayUrl); }
                    }}
                    className="px-3 py-1.5 rounded-md border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] hover:border-[color:var(--neon-blue)]/40 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmFinalOpen && game && (() => {
        const p = parseScore();
        const previewIdx = winningSquareIndex(game, p.home, p.away);
        const previewRow = Math.floor(previewIdx / 10);
        const previewCol = previewIdx % 10;
        const previewSq = squares.find((s) => s.row === previewRow && s.col === previewCol);
        const previewOwner = previewSq?.owner_name ?? null;
        const previewAvatar = previewSq?.owner_id
          ? players.find((pl) => pl.user_id === previewSq.owner_id)?.avatar_url ?? null
          : null;
        const homeDigit = p.home % 10;
        const awayDigit = p.away % 10;
        return (
          <div
            className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => !finalizing && setConfirmFinalOpen(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-[color:var(--neon-green)]/40 bg-[color:var(--surface)] p-6 shadow-[var(--shadow-card)] animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => !finalizing && setConfirmFinalOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition disabled:opacity-40"
                disabled={finalizing}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] font-mono text-[10px] uppercase tracking-widest mb-3">
                  <Flag className="w-3 h-3" /> Final Score
                </div>
                <div className="font-display font-bold text-xl">Lock in the winner?</div>
                <p className="text-xs text-muted-foreground mt-1">
                  This marks the game completed. The winning square below will be locked.
                </p>
              </div>

              {/* Drafted score */}
              <div className="rounded-xl border border-border bg-background/40 p-3 mb-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2">
                  Drafted · Q{p.quarter} · {p.clock || "00:00"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[color:var(--neon-blue)]/30 bg-[color:var(--neon-blue)]/5 p-2 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground truncate">
                      {game.home_team || "Home"}
                    </div>
                    <div className="font-mono font-bold text-2xl tabular-nums text-[color:var(--neon-blue)]">
                      {p.home}
                    </div>
                  </div>
                  <div className="rounded-md border border-[color:var(--neon-orange)]/30 bg-[color:var(--neon-orange)]/5 p-2 text-center">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground truncate">
                      {game.away_team || "Away"}
                    </div>
                    <div className="font-mono font-bold text-2xl tabular-nums text-[color:var(--neon-orange)]">
                      {p.away}
                    </div>
                  </div>
                </div>
              </div>

              {/* Computed winning square */}
              <div className="rounded-xl border border-[color:var(--neon-green)]/30 bg-[color:var(--neon-green)]/5 p-3 mb-4 flex items-center gap-3">
                <div className="shrink-0 rounded-lg border border-[color:var(--neon-green)]/40 bg-background px-3 py-2 text-center">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Digits</div>
                  <div className="font-mono font-bold text-xl tabular-nums text-[color:var(--neon-green)]">
                    {homeDigit}-{awayDigit}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[color:var(--neon-green)]">
                    Winning Square
                  </div>
                  {previewOwner ? (
                    <div className="flex items-center gap-2 mt-1">
                      <PlayerAvatar name={previewOwner} src={previewAvatar} size="sm" />
                      <div className="font-display font-bold text-base truncate">{previewOwner}</div>
                    </div>
                  ) : (
                    <div className="font-display font-bold text-base text-muted-foreground mt-1">
                      Unclaimed square
                    </div>
                  )}
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                    Row {previewRow + 1} · Col {previewCol + 1}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmFinalOpen(false)}
                  disabled={finalizing}
                  className="flex-1 px-3 py-2 rounded-md border border-border text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await saveScore({ final: true });
                    setConfirmFinalOpen(false);
                  }}
                  disabled={finalizing || savingScore}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-[color:var(--neon-green)]/60 bg-[color:var(--neon-green)]/15 text-[color:var(--neon-green)] text-[11px] font-mono uppercase tracking-widest hover:bg-[color:var(--neon-green)]/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {finalizing ? "Locking..." : "Lock Winner"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  onBlur,
  colorVar,
  placeholder,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  colorVar: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  error?: string | null;
}) {
  const hasError = !!error;
  return (
    <label className="block">
      <span className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1 truncate">
        {label}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-base font-mono font-bold tabular-nums text-foreground focus:outline-none focus:ring-1 transition"
        style={
          hasError
            ? { borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))" }
            : {
                borderColor: `color-mix(in oklab, var(${colorVar}) 30%, transparent)`,
                color: `var(${colorVar})`,
              }
        }
      />
      {hasError && (
        <span className="block mt-1 font-mono text-[9px] uppercase tracking-widest text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
