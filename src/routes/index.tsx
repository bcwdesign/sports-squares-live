import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { Trophy, Zap, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clutch Squares — Watch Parties for NBA" },
      { name: "description", content: "Create private NBA Squares games for live watch parties. Invite friends with a code, claim squares, win each quarter." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full flex flex-col justify-center">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] font-mono text-[10px] uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-orange)] animate-pulse" />
            NBA · Live
          </div>
          <h1 className="font-display font-bold text-5xl sm:text-6xl tracking-tight leading-[0.95]">
            SPORTS<br />
            <span className="text-[color:var(--neon-blue)]">SQUARES</span>
            <span className="text-[color:var(--neon-green)]">.LIVE</span>
          </h1>
          <p className="text-muted-foreground mt-5 text-base sm:text-lg max-w-md mx-auto">
            Create private squares games for live NBA watch parties.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Feature icon={<Users className="w-5 h-5" />} label="Invite friends" />
          <Feature icon={<Zap className="w-5 h-5" />} label="Live scoring" />
          <Feature icon={<Trophy className="w-5 h-5" />} label="Quarter winners" />
        </div>

        <div className="flex flex-col gap-3">
          <Link to="/auth">
            <NeonButton variant="blue" className="w-full">Sign In · Sign Up</NeonButton>
          </Link>
          <Link to="/auth" search={{ guest: true }}>
            <NeonButton variant="ghost" className="w-full">Continue as Guest</NeonButton>
          </Link>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-[color:var(--surface)] p-3 text-center">
      <div className="flex items-center justify-center text-[color:var(--neon-green)] mb-1">{icon}</div>
      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">{label}</div>
    </div>
  );
}
