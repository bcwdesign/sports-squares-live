import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { getUser } from "@/lib/gameState";
import { TopBar } from "@/components/TopBar";
import { SquaresGrid } from "@/components/SquaresGrid";
import { NeonButton } from "@/components/NeonButton";
import { ChatPanel } from "@/components/ChatPanel";
import { Maximize2, Share2, Lock, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/squares")({
  head: () => ({
    meta: [
      { title: "Squares — Pick Your Square" },
      { name: "description", content: "Tap a square to claim it before tip-off." },
    ],
  }),
  component: SquaresPage,
});

function SquaresPage() {
  const [state, update] = useGameState();
  const navigate = useNavigate();
  const user = getUser();
  const [selected, setSelected] = useState<number | null>(null);
  const [watchMode, setWatchMode] = useState(false);

  const myCount = state.squares.filter((s) => s.owner === user).length;
  const filled = state.squares.filter((s) => s.owner).length;

  const claim = () => {
    if (selected === null) return;
    update((s) => {
      const sq = s.squares[selected];
      if (sq.owner) return s;
      const next = { ...s, squares: s.squares.map((x) => (x.index === selected ? { ...x, owner: user } : x)) };
      return next;
    });
    toast.success(`Square ${selected + 1} claimed`, {
      description: "Locked in. Good luck!",
    });
    setSelected(null);
  };

  const lockAndStart = () => {
    update((s) => ({
      ...s,
      locked: true,
      tipoff: Date.now(),
      homeAxis: shuffle10(),
      awayAxis: shuffle10(),
    }));
    toast.success("Game locked. Tip-off!");
    navigate({ to: "/live" });
  };

  const share = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Squares.Live", text: "Join my NBA Squares game!", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied");
      }
    } catch {/* user cancelled */}
  };

  return (
    <div className={watchMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "min-h-screen"}>
      <TopBar state={state} />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-32">
        {/* Status bar */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase">← Lobby</Link>
            {state.locked && (
              <span className="px-2 py-1 rounded-md bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)] font-mono text-[10px] uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </div>
          <button
            onClick={() => setWatchMode((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Watch Mode
          </button>
        </div>

        <div className={watchMode ? "max-w-3xl mx-auto" : ""}>
          {/* Grid */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-2 sm:p-4 shadow-[var(--shadow-card)]">
            <SquaresGrid
              state={state}
              user={user}
              selectedIndex={selected}
              onSelect={(i) => {
                if (state.locked) return;
                const sq = state.squares[i];
                if (sq.owner) return;
                setSelected(selected === i ? null : i);
              }}
              showAxes
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <Pill label="Filled" value={`${filled}/100`} color="var(--neon-blue)" />
            <Pill label="Yours" value={`${myCount}`} color="var(--neon-green)" />
            <Pill label="You" value={user} color="var(--neon-orange)" />
          </div>

          {/* Chat */}
          {!watchMode && (
            <div className="mt-6">
              <ChatPanel />
            </div>
          )}
        </div>
      </main>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2">
          {!state.locked ? (
            <>
              <NeonButton
                variant="blue"
                className="flex-1"
                disabled={selected === null}
                onClick={claim}
              >
                {selected !== null ? `Claim #${selected + 1}` : "Tap a square"}
              </NeonButton>
              <NeonButton variant="ghost" onClick={share} className="!px-4">
                <Share2 className="w-4 h-4" />
              </NeonButton>
              <NeonButton variant="green" onClick={lockAndStart} className="!px-4">
                <Play className="w-4 h-4" />
              </NeonButton>
            </>
          ) : (
            <Link to="/live" className="flex-1">
              <NeonButton variant="orange" className="w-full">
                Watch Live →
              </NeonButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg border bg-background/40 px-3 py-2"
      style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}
    >
      <div className="font-mono font-bold text-sm truncate" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function shuffle10() {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
