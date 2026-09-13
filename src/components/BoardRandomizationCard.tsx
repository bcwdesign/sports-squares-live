// NFL "Randomized Before Kickoff" panel: entry reservation, countdown,
// host randomize/reset controls, and the post-lock reveal.
// All authoritative randomization happens server-side.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeAuthed } from "@/lib/serverFnClient";
import { randomizeAndLockBoard, resetRandomizedBoard } from "@/lib/board-randomization.functions";
import type { Game, GameEntry, Square } from "@/lib/types";
import { NeonButton } from "@/components/NeonButton";
import { toast } from "sonner";
import { Dices, Lock, Minus, Plus, Timer } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  game: Game;
  entries: GameEntry[];
  squares: Square[];
  userId: string | null;
  displayName: string | null;
  isHost: boolean;
};

const REVEAL_STAGES = (game: Game) => [
  "Randomizing player squares…",
  `Randomizing ${game.away_team} numbers…`,
  `Randomizing ${game.home_team} numbers…`,
  "Board Locked!",
];

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h} : ${m} : ${s}`;
}

export function BoardRandomizationCard({ game, entries, squares, userId, displayName, isHost }: Props) {
  const locked = !!game.board_randomized;
  const myEntry = entries.find((e) => e.user_id === userId);
  const myEntries = myEntry?.entry_count ?? 0;
  const totalEntries = entries.reduce((n, e) => n + e.entry_count, 0);
  const playerCount = entries.filter((e) => e.entry_count > 0).length;

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reveal animation, driven by board_randomized flipping true while mounted.
  const wasLocked = useRef(locked);
  const [stage, setStage] = useState<number | null>(null);
  useEffect(() => {
    if (locked && !wasLocked.current) {
      setStage(0);
      const timers = [1, 2, 3].map((i) => setTimeout(() => setStage(i), i * 800));
      const done = setTimeout(() => setStage(null), 3600);
      wasLocked.current = true;
      return () => { timers.forEach(clearTimeout); clearTimeout(done); };
    }
    wasLocked.current = locked;
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const scheduledAt = game.scheduled_randomization_at ? new Date(game.scheduled_randomization_at) : null;
  const remaining = scheduledAt ? scheduledAt.getTime() - now : null;

  const mySquares = useMemo(
    () =>
      squares
        .filter((s) => s.owner_id && s.owner_id === userId)
        .map((s) => s.row * 10 + s.col + 1)
        .sort((a, b) => a - b),
    [squares, userId],
  );

  const setEntries = async (next: number) => {
    if (!userId || locked) return;
    const clamped = Math.max(0, Math.min(game.max_squares_per_user, next));
    setSaving(true);
    const { error } = await supabase
      .from("game_entries")
      .upsert(
        {
          game_id: game.id,
          user_id: userId,
          display_name: displayName ?? "Player",
          entry_count: clamped,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "game_id,user_id" },
      );
    setSaving(false);
    if (error) toast.error("Couldn't update your entries");
  };

  const randomizeNow = async () => {
    setWorking(true);
    try {
      const res = await invokeAuthed(randomizeAndLockBoard, { gameId: game.id });
      if (res.reason === "already_randomized") toast.message("Board was already locked");
      else if (!res.ok) toast.error("Couldn't randomize this board");
      else toast.success("Board randomized and locked");
    } catch {
      toast.error("Couldn't randomize this board");
    } finally {
      setWorking(false);
      setConfirmOpen(false);
    }
  };

  const resetBoard = async () => {
    setWorking(true);
    try {
      const res = await invokeAuthed(resetRandomizedBoard, { gameId: game.id, confirm: "RESET" as const });
      if (res.ok) toast.success("Board reset — entries kept");
      else toast.error("Couldn't reset this board");
    } catch {
      toast.error("Couldn't reset this board");
    } finally {
      setWorking(false);
      setResetOpen(false);
    }
  };

  return (
    <div className="rounded-xl border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/5 p-4 space-y-4">
      {stage !== null && (
        <div className="rounded-lg border border-[color:var(--neon-orange)]/50 bg-background/70 px-4 py-3 text-center font-display font-bold text-[color:var(--neon-orange)] animate-pulse">
          {REVEAL_STAGES(game)[stage]}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Dices className="w-4 h-4 text-[color:var(--neon-green)]" />
        <div className="font-display font-bold">
          {locked ? "🏈 The Board Is Locked" : "Randomized Before Kickoff"}
        </div>
      </div>

      {!locked ? (
        <>
          <p className="text-sm text-muted-foreground">
            Your {myEntries} {myEntries === 1 ? "square is" : "squares are"} reserved. Your board
            positions and scoring numbers will be randomly assigned before kickoff.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Your entries" value={`${myEntries}`} />
            <Stat label="Claimed" value={`${totalEntries}/100`} />
            <Stat label="Players" value={`${playerCount}`} />
          </div>

          {userId && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Remove an entry"
                disabled={saving || myEntries <= 0}
                onClick={() => setEntries(myEntries - 1)}
                className="w-10 h-10 rounded-xl border border-border bg-[color:var(--surface)] flex items-center justify-center disabled:opacity-40"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center font-mono font-bold text-lg">{myEntries}</div>
              <button
                type="button"
                aria-label="Reserve another entry"
                disabled={saving || myEntries >= game.max_squares_per_user}
                onClick={() => setEntries(myEntries + 1)}
                className="w-10 h-10 rounded-xl border border-[color:var(--neon-green)] text-[color:var(--neon-green)] flex items-center justify-center disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {scheduledAt && remaining !== null && (
            <div className="rounded-lg border border-border bg-background/50 px-4 py-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5">
                <Timer className="w-3 h-3" /> Board randomizes in
              </div>
              <div className="font-mono font-bold text-2xl text-[color:var(--neon-orange)]">
                {formatCountdown(remaining)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Scheduled for {scheduledAt.toLocaleString()}
              </div>
            </div>
          )}

          {isHost && (
            <NeonButton variant="green" className="w-full" onClick={() => setConfirmOpen(true)} disabled={working}>
              <Lock className="w-4 h-4 inline mr-1.5" /> Randomize &amp; Lock Board Now
            </NeonButton>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Your squares have been randomly assigned. Square assignments are locked for this game.
          </p>
          {mySquares.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your squares</div>
              <div className="flex flex-wrap gap-2">
                {mySquares.map((n) => (
                  <span key={n} className="px-2.5 py-1 rounded-lg border border-[color:var(--neon-blue)] text-[color:var(--neon-blue)] font-mono text-sm">
                    #{n}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Squares assigned" value={`${squares.filter((s) => s.owner_id).length}`} />
            <Stat label="Team numbers" value="Randomized ✓" />
            <Stat
              label="Randomized"
              value={game.randomized_at ? new Date(game.randomized_at).toLocaleTimeString() : "—"}
            />
          </div>
          {isHost && game.status === "lobby" && (
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-orange)]"
            >
              Reset this NFL board
            </button>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Randomize and lock this board?</AlertDialogTitle>
            <AlertDialogDescription>
              This will randomly assign all player squares, randomly assign both teams&apos; score
              numbers, and permanently lock the board. This action cannot be undone unless you
              explicitly reset the game.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(e) => { e.preventDefault(); randomizeNow(); }}
              className="bg-[color:var(--neon-green)] text-background hover:bg-[color:var(--neon-green)]/90"
            >
              {working ? "Randomizing…" : "Randomize & Lock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this NFL board?</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase all randomized square assignments and scoring numbers. It is only
              possible before kickoff and is recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(e) => { e.preventDefault(); resetBoard(); }}
              className="bg-[color:var(--neon-orange)] text-background hover:bg-[color:var(--neon-orange)]/90"
            >
              {working ? "Resetting…" : "Reset board"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-2 py-2">
      <div className="font-mono font-bold text-sm truncate">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
