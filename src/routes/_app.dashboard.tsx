import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { Plus, KeyRound, LogOut, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Game } from "@/lib/types";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sports Squares Live" },
      { name: "description", content: "Your active and past Squares games." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      // Fetch player rows for this user, then fetch games
      const { data: playerRows } = await supabase
        .from("game_players")
        .select("game_id")
        .eq("user_id", user.id);
      const ids = (playerRows ?? []).map((p) => p.game_id);
      if (ids.length === 0) {
        if (active) { setGames([]); setLoading(false); }
        return;
      }
      const { data: gameRows } = await supabase
        .from("games")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (active) {
        setGames((gameRows ?? []) as Game[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const join = async () => {
    if (!user || !profile) return;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) return toast.error("Enter a valid code");
    setJoining(true);
    try {
      const { data: game, error } = await supabase
        .from("games")
        .select("*")
        .eq("invite_code", cleaned)
        .maybeSingle();
      if (error) throw error;
      if (!game) throw new Error("No game found with that code");

      // Insert player (idempotent via unique constraint)
      const { error: insErr } = await supabase.from("game_players").insert({
        game_id: game.id,
        user_id: user.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
      if (insErr && !insErr.message.includes("duplicate")) throw insErr;

      toast.success(`Joined ${game.name}`);
      navigate({ to: "/game/$gameId/lobby", params: { gameId: game.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join game");
    } finally {
      setJoining(false);
    }
  };

  const active = games.filter((g) => g.status !== "completed");
  const past = games.filter((g) => g.status === "completed");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[image:var(--gradient-neon)] flex items-center justify-center font-mono font-bold text-background text-xs">SQ</div>
            <div className="font-display font-bold text-sm">SQUARES<span className="text-[color:var(--neon-green)]">.LIVE</span></div>
          </Link>
          <button
            onClick={async () => {
              await signOut();
              toast.success("Signed out");
              navigate({ to: "/auth" });
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--surface)] px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-[color:var(--neon-orange)]/60 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <div className="mb-6 animate-fade-in">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Welcome back</div>
          <h1 className="font-display font-bold text-3xl">
            {profile?.display_name ?? "Player"}
            {profile?.is_guest && (
              <span className="ml-2 align-middle text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-[color:var(--neon-orange)]/40 text-[color:var(--neon-orange)]">Guest</span>
            )}
          </h1>
        </div>

        {/* Primary CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <Link to="/create">
            <NeonButton variant="green" className="w-full !py-4">
              <Plus className="w-4 h-4 inline mr-2" /> Create New Game
            </NeonButton>
          </Link>
          <button onClick={() => setShowJoin((v) => !v)}>
            <NeonButton variant="ghost" className="w-full !py-4">
              <KeyRound className="w-4 h-4 inline mr-2" /> Join with Code
            </NeonButton>
          </button>
        </div>

        {showJoin && (
          <div className="rounded-xl border border-border bg-[color:var(--surface)] p-4 mb-8 animate-scale-in">
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="INVITE CODE"
                maxLength={8}
                className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono font-bold text-center tracking-[0.3em] uppercase focus:outline-none focus:border-[color:var(--neon-blue)]"
              />
              <NeonButton variant="blue" disabled={joining} onClick={join}>
                {joining ? "..." : "Join"}
              </NeonButton>
            </div>
          </div>
        )}

        {/* Active games */}
        <Section title="Active Games" count={active.length}>
          {loading ? (
            <Skeleton />
          ) : active.length === 0 ? (
            <Empty text="No active games. Create one or join with a code." />
          ) : (
            <div className="space-y-2">
              {active.map((g) => <GameCard key={g.id} game={g} hostId={user?.id} />)}
            </div>
          )}
        </Section>

        {/* Past games */}
        {past.length > 0 && (
          <Section title="Past Games" count={past.length}>
            <div className="space-y-2">
              {past.map((g) => <GameCard key={g.id} game={g} hostId={user?.id} />)}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display font-bold text-lg">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function GameCard({ game, hostId }: { game: Game; hostId: string | undefined }) {
  const isHost = game.host_id === hostId;
  const route = game.status === "completed" ? "/game/$gameId/results"
    : (game.status === "live" || game.status === "locked") ? "/game/$gameId/live"
    : "/game/$gameId/lobby";
  return (
    <Link to={route} params={{ gameId: game.id }} className="block">
      <div className="rounded-xl border border-border bg-[color:var(--surface)] p-4 hover:border-[color:var(--neon-blue)]/60 transition group">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{game.sport}</span>
              {isHost && <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[color:var(--neon-green)]/20 text-[color:var(--neon-green)]">Host</span>}
              <StatusPill status={game.status} />
            </div>
            <div className="font-display font-bold truncate">{game.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {game.away_team} @ {game.home_team}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-[color:var(--neon-orange)]">#{game.invite_code}</div>
            {game.status === "completed" && (
              <div className="font-mono text-xs text-muted-foreground mt-1">
                <Trophy className="w-3 h-3 inline mr-1" />{game.away_score}-{game.home_score}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: Game["status"] }) {
  const styles: Record<Game["status"], string> = {
    lobby: "bg-[color:var(--neon-blue)]/20 text-[color:var(--neon-blue)]",
    locked: "bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)]",
    live: "bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)] animate-pulse",
    completed: "bg-muted text-muted-foreground",
  };
  return <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${styles[status]}`}>{status}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-[color:var(--surface)] p-4 h-20 animate-pulse" />
      ))}
    </div>
  );
}
