import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useGame } from "@/hooks/useGame";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { ArrowLeft, Copy, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/game/$gameId/invite")({
  head: () => ({ meta: [{ title: "Invite Friends — Sports Squares Live" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { gameId } = Route.useParams();
  const { game, loading } = useGame(gameId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const inviteUrl = useMemo(() => {
    if (!game) return "";
    return `${window.location.origin}/join/${game.invite_code}`;
  }, [game]);

  if (loading || !game) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading...</div>;
  }

  const isHost = user?.id === game.host_id;

  const copy = async (val: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(kind);
      toast.success(kind === "link" ? "Link copied" : "Code copied");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Could not copy");
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join my ${game.sport} Squares game`,
          text: `${game.name} — code ${game.invite_code}`,
          url: inviteUrl,
        });
      } else {
        copy(inviteUrl, "link");
      }
    } catch {/* cancelled */}
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/_app/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold truncate">{game.name}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] font-mono text-[10px] uppercase tracking-widest mb-4">
            🎉 Game Created
          </div>
          <h2 className="font-display font-bold text-3xl">Invite Your Crew</h2>
          <p className="text-muted-foreground mt-2 text-sm">Share the code or link — anyone with it can join.</p>
        </div>

        {/* Big code */}
        <div className="rounded-2xl border-2 border-[color:var(--neon-blue)]/40 bg-[color:var(--neon-blue)]/5 p-8 text-center mb-4 animate-scale-in shadow-[var(--shadow-neon-blue)]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Invite Code</div>
          <div className="font-display font-bold text-5xl sm:text-6xl tracking-[0.15em] text-[color:var(--neon-blue)] mb-4">
            {game.invite_code}
          </div>
          <button
            onClick={() => copy(game.invite_code, "code")}
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-[color:var(--neon-blue)] inline-flex items-center gap-1"
          >
            {copied === "code" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Tap to copy</>}
          </button>
        </div>

        {/* Link */}
        <div className="rounded-xl border border-border bg-[color:var(--surface)] p-3 flex items-center gap-2 mb-6">
          <div className="flex-1 min-w-0 font-mono text-xs text-muted-foreground truncate">{inviteUrl}</div>
          <button
            onClick={() => copy(inviteUrl, "link")}
            className="px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono uppercase tracking-widest hover:border-[color:var(--neon-blue)] flex items-center gap-1"
          >
            {copied === "link" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <button onClick={share}>
            <NeonButton variant="ghost" className="w-full">
              <Share2 className="w-4 h-4 inline mr-2" /> Share
            </NeonButton>
          </button>
          <NeonButton variant="green" onClick={() => navigate({ to: "/game/$gameId/lobby", params: { gameId } })}>
            Start Filling Board →
          </NeonButton>
        </div>

        {!isHost && (
          <p className="text-center text-xs text-muted-foreground mt-4">Only the host can start the game.</p>
        )}
      </main>
    </div>
  );
}
