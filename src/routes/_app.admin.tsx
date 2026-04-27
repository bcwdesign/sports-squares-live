import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Users, Gamepad2, Trophy, Activity, Radio, Building2, MessageSquare, ArrowLeft, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { invokeAuthed } from "@/lib/serverFnClient";
import { getAdminOverview, type AdminOverview } from "@/server/admin.functions";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — Clutch Squares" },
      { name: "description", content: "Super admin overview of games, hosts, users, and platform usage." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<"games" | "users" | "winners">("games");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    invokeAuthed(getAdminOverview, undefined as never)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("forbidden")) {
          setForbidden(true);
        } else {
          toast.error(msg);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-xl border border-border bg-[color:var(--surface)] p-8">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[color:var(--neon-orange)]" />
          <h1 className="font-display font-bold text-2xl mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-4">You don't have super admin privileges.</p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="font-mono text-xs uppercase tracking-widest text-[color:var(--neon-blue)] hover:underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--surface)] px-2.5 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[color:var(--neon-green)]" />
              <div className="font-display font-bold text-sm">
                <span className="text-[color:var(--neon-green)]">SUPER</span> ADMIN
              </div>
            </div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Clutch Squares Console
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {loading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border bg-[color:var(--surface)] animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <StatsGrid stats={data.stats} />

            <div className="mt-8 mb-4 flex items-center gap-2">
              <TabButton active={tab === "games"} onClick={() => setTab("games")}>
                <Gamepad2 className="w-3.5 h-3.5 inline mr-1.5" /> Games ({data.games.length})
              </TabButton>
              <TabButton active={tab === "users"} onClick={() => setTab("users")}>
                <Users className="w-3.5 h-3.5 inline mr-1.5" /> Users ({data.users.length})
              </TabButton>
              <TabButton active={tab === "winners"} onClick={() => setTab("winners")}>
                <Trophy className="w-3.5 h-3.5 inline mr-1.5" /> Winners ({data.winners.length})
              </TabButton>
            </div>

            {tab === "games" && <GamesTable games={data.games} />}
            {tab === "users" && <UsersTable users={data.users} />}
            {tab === "winners" && <WinnersTable winners={data.winners} />}
          </>
        )}
      </main>
    </div>
  );
}

function StatsGrid({ stats }: { stats: AdminOverview["stats"] }) {
  const cards = [
    { label: "Total Users", value: stats.total_users, sub: `${stats.total_guests} guests`, icon: Users, color: "var(--neon-blue)" },
    { label: "Active Games", value: stats.active_games, sub: `${stats.live_games} live · ${stats.lobby_games} lobby`, icon: Activity, color: "var(--neon-orange)" },
    { label: "Total Games", value: stats.total_games, sub: `${stats.completed_games} completed`, icon: Gamepad2, color: "var(--neon-green)" },
    { label: "Squares Claimed", value: stats.total_squares_claimed, sub: `${stats.total_players} player seats`, icon: Trophy, color: "var(--neon-blue)" },
    { label: "Auto-Sync Games", value: stats.auto_synced_games, sub: "via BALLDONTLIE", icon: Radio, color: "var(--neon-orange)" },
    { label: "Messages", value: stats.total_messages, sub: "in chats", icon: MessageSquare, color: "var(--neon-green)" },
    { label: "Venues", value: stats.total_venues, sub: "registered", icon: Building2, color: "var(--neon-blue)" },
    { label: "Last 7 Days", value: stats.games_last_7d, sub: `${stats.users_last_7d} new users`, icon: Activity, color: "var(--neon-orange)" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-[color:var(--surface)] p-4 hover:border-[color:var(--neon-blue)]/40 transition">
          <div className="flex items-start justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
            <c.icon className="w-4 h-4" style={{ color: `var(--${c.color.replace('var(--','').replace(')','')})` }} />
          </div>
          <div className="font-display font-bold text-3xl tabular-nums">{c.value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-widest border transition ${
        active
          ? "bg-[color:var(--neon-blue)]/10 border-[color:var(--neon-blue)]/60 text-[color:var(--neon-blue)]"
          : "border-border bg-[color:var(--surface)] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function GamesTable({ games }: { games: AdminOverview["games"] }) {
  if (games.length === 0) return <Empty text="No games yet." />;
  return (
    <div className="rounded-xl border border-border bg-[color:var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <Th>Game</Th><Th>Host</Th><Th>Status</Th><Th>Score</Th><Th>Players</Th><Th>Squares</Th><Th>Code</Th><Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-t border-border hover:bg-background/30">
                <Td>
                  <Link to="/game/$gameId/live" params={{ gameId: g.id }} className="font-medium hover:text-[color:var(--neon-blue)]">
                    {g.name}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">{g.away_team} @ {g.home_team}</div>
                </Td>
                <Td>{g.host_name ?? <span className="text-muted-foreground">—</span>}</Td>
                <Td><StatusPill status={g.status} /></Td>
                <Td className="font-mono tabular-nums">{g.away_score}–{g.home_score}</Td>
                <Td className="tabular-nums">{g.player_count}</Td>
                <Td className="tabular-nums">{g.squares_claimed}/100</Td>
                <Td className="font-mono text-[color:var(--neon-orange)]">#{g.invite_code}</Td>
                <Td className="text-[11px] text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTable({ users }: { users: AdminOverview["users"] }) {
  if (users.length === 0) return <Empty text="No users yet." />;
  return (
    <div className="rounded-xl border border-border bg-[color:var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <Th>User</Th><Th>Type</Th><Th>Hosted</Th><Th>Joined</Th><Th>Joined On</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-background/30">
                <Td>
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={u.display_name} src={u.avatar_url} size="sm" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {u.display_name}
                        {u.is_super_admin && (
                          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[color:var(--neon-green)]/20 text-[color:var(--neon-green)]">
                            Super Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  {u.is_guest ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)]">Guest</span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">User</span>
                  )}
                </Td>
                <Td className="tabular-nums">{u.games_hosted}</Td>
                <Td className="tabular-nums">{u.games_joined}</Td>
                <Td className="text-[11px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WinnersTable({ winners }: { winners: AdminOverview["winners"] }) {
  if (winners.length === 0) return <Empty text="No completed games yet." />;
  return (
    <div className="rounded-xl border border-border bg-[color:var(--surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <Th>Game</Th><Th>Winner</Th><Th>Final Score</Th><Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {winners.map((w) => (
              <tr key={w.game_id} className="border-t border-border hover:bg-background/30">
                <Td>
                  <Link to="/game/$gameId/results" params={{ gameId: w.game_id }} className="font-medium hover:text-[color:var(--neon-blue)]">
                    {w.game_name}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">{w.away_team} @ {w.home_team}</div>
                </Td>
                <Td className="font-medium text-[color:var(--neon-green)]">
                  {w.winner_name ?? <span className="text-muted-foreground">Unclaimed</span>}
                </Td>
                <Td className="font-mono tabular-nums">{w.away_score}–{w.home_score}</Td>
                <Td className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    lobby: "bg-[color:var(--neon-blue)]/20 text-[color:var(--neon-blue)]",
    locked: "bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)]",
    live: "bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)] animate-pulse",
    completed: "bg-muted text-muted-foreground",
  };
  return <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${styles[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
