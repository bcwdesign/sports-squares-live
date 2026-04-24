import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { ChatPanel } from "@/components/ChatPanel";
import { NeonButton } from "@/components/NeonButton";
import { supabase } from "@/integrations/supabase/client";
import { shuffle10 } from "@/lib/types";
import { Maximize2, Lock, Play, Share2, Users, Crown, Hourglass, Tv } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/game/$gameId/lobby")({
  head: () => ({ meta: [{ title: "Game Lobby — Clutch Squares" }] }),
  component: LobbyPage,
});

function LobbyPage() {
  const { gameId } = Route.useParams();
  const { game, squares, players, loading } = useGame(gameId);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number | null>(null);
  const [watchMode, setWatchMode] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [starting, setStarting] = useState(false);

  // Auto-route if game is past lobby
  useEffect(() => {
    if (!game) return;
    if (game.status === "live" || game.status === "locked") {
      navigate({ to: "/game/$gameId/live", params: { gameId } });
    } else if (game.status === "completed") {
      navigate({ to: "/game/$gameId/results", params: { gameId } });
    }
  }, [game, gameId, navigate]);

  if (loading || !game) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading game...</div>;
  }

  const isHost = user?.id === game.host_id;
  const myCount = squares.filter((s) => s.owner_id === user?.id).length;
  const filled = squares.filter((s) => s.owner_id).length;
  const host = players.find((p) => p.user_id === game.host_id);

  const claim = async () => {
    if (selected === null || !user || !profile) return;
    const row = Math.floor(selected / 10);
    const col = selected % 10;
    const target = squares.find((s) => s.row === row && s.col === col);
    if (!target || target.owner_id) return;

    if (myCount >= game.max_squares_per_user) {
      toast.error(`Max ${game.max_squares_per_user} squares per player`);
      return;
    }

    setClaiming(true);
    const { error } = await supabase
      .from("squares")
      .update({ owner_id: user.id, owner_name: profile.display_name })
      .eq("id", target.id)
      .is("owner_id", null);
    setClaiming(false);

    if (error) {
      toast.error("Couldn't claim square — it may be taken");
    } else {
      toast.success(`Square claimed`);
      setSelected(null);
    }
  };

  const startGame = async () => {
    if (!isHost) return;
    setStarting(true);
    const { error } = await supabase
      .from("games")
      .update({
        status: "live",
        home_axis: shuffle10(),
        away_axis: shuffle10(),
        clock: "12:00",
        quarter: 1,
      })
      .eq("id", game.id);
    setStarting(false);
    if (error) return toast.error(error.message);
    toast.success("Game locked. Tip-off!");
    navigate({ to: "/game/$gameId/live", params: { gameId } });
  };

  const share = async () => {
    const url = `${window.location.origin}/join/${game.invite_code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: game.name, text: `Join my Squares game! Code: ${game.invite_code}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied");
      }
    } catch {/* cancelled */}
  };

  return (
    <div className={watchMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "min-h-screen"}>
      <TopBar game={game} />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-32">
        {/* Header strip */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Dashboard</Link>
          <div className="flex items-center gap-3">
            <Link
              to="/game/$gameId/overlay"
              params={{ gameId }}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-orange)] transition"
            >
              <Tv className="w-3.5 h-3.5" /> View Live Overlay
            </Link>
            <button
              onClick={() => setWatchMode((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Watch Mode
            </button>
          </div>
        </div>

        <div className={watchMode ? "max-w-3xl mx-auto" : ""}>
          {/* Game name + host */}
          <div className="rounded-xl border border-border bg-[color:var(--surface)] p-4 mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-display font-bold text-lg truncate">{game.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-[color:var(--neon-green)]" />
                Hosted by {host?.display_name ?? "—"}
                <span className="mx-1">·</span>
                <span className="font-mono text-[color:var(--neon-orange)]">#{game.invite_code}</span>
              </div>
            </div>
            <button onClick={share} className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] flex items-center gap-1 shrink-0">
              <Share2 className="w-3.5 h-3.5" /> Invite
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Pill label="Squares" value={`${filled}/100`} color="var(--neon-blue)" />
            <Pill label="Yours" value={`${myCount}/${game.max_squares_per_user}`} color="var(--neon-green)" />
            <Pill label="Players" value={`${players.length}`} color="var(--neon-orange)" />
          </div>

          {/* Grid */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-2 sm:p-4 shadow-[var(--shadow-card)]">
            <SquaresGrid
              game={game}
              squares={squares}
              userId={user?.id ?? null}
              selectedIndex={selected}
              onSelect={(i) => {
                if (game.status !== "lobby") return;
                const row = Math.floor(i / 10);
                const col = i % 10;
                const sq = squares.find((s) => s.row === row && s.col === col);
                if (!sq || sq.owner_id) return;
                setSelected(selected === i ? null : i);
              }}
              showAxes
            />
          </div>

          {/* Players list */}
          <div className="mt-4 rounded-xl border border-border bg-[color:var(--surface)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="font-display font-bold text-sm">Players</div>
              <span className="font-mono text-[10px] text-muted-foreground">{players.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => {
                const count = squares.filter((s) => s.owner_id === p.user_id).length;
                const isHostP = p.user_id === game.host_id;
                return (
                  <div key={p.id} className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg border ${isHostP ? "border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10" : "border-border bg-background/50"}`}>
                    <PlayerAvatar name={p.display_name} src={p.avatar_url} size="sm" />
                    <span className="font-bold text-sm">{p.display_name}</span>
                    {isHostP && <Crown className="w-3 h-3 text-[color:var(--neon-green)]" />}
                    <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {!watchMode && (
            <div className="mt-6">
              <ChatPanel gameId={game.id} />
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2">
          <NeonButton
            variant="blue"
            className="flex-1"
            disabled={selected === null || claiming}
            onClick={claim}
          >
            {claiming ? "..." : selected !== null ? `Claim Square` : "Tap a square"}
          </NeonButton>
          {isHost ? (
            <NeonButton variant="green" onClick={startGame} disabled={starting} className="!px-4">
              {starting ? "..." : (
                <>
                  <Lock className="w-4 h-4 inline mr-1.5" /> Start
                </>
              )}
            </NeonButton>
          ) : (
            <div className="px-4 py-3 rounded-xl border border-border bg-muted/40 text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5" /> Waiting for host
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border bg-background/40 px-3 py-2" style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}>
      <div className="font-mono font-bold text-sm truncate" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

// avoid unused import
void Play;
