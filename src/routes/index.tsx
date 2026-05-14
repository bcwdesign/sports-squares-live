import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { Users, MousePointerClick, Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clutch Squares — Play. Compete. Win with friends." },
      { name: "description", content: "Join or create live NBA Squares games. Play with friends, pick your square, win when your numbers hit." },
      { property: "og:title", content: "Clutch Squares — Play. Compete. Win with friends." },
      { property: "og:description", content: "Join or create live NBA Squares games. Play with friends, pick your square, win when your numbers hit." },
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
      <main className="flex-1 w-full">
        {/* HERO */}
        <section className="relative px-4 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div
            className="absolute inset-0 -z-10 opacity-80"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden
          />
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--neon-orange)]/40 bg-[color:var(--neon-orange)]/10 text-[color:var(--neon-orange)] font-mono text-[10px] uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-orange)] animate-pulse" />
              NBA · Live Now
            </div>
            <h1 className="font-display font-bold text-5xl sm:text-7xl tracking-tight leading-[0.95]">
              <span className="text-[color:var(--neon-blue)]">CLUTCH</span>{" "}
              <span className="text-[color:var(--neon-green)]">SQUARES</span>
              <span className="sr-only"> — Play NBA Squares with Friends</span>
            </h1>
            <p className="text-muted-foreground mt-5 text-lg sm:text-xl max-w-xl mx-auto">
              Play NBA Squares with friends. Compete. Win.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8 max-w-md mx-auto">
              <Link to="/auth" className="flex-1">
                <NeonButton variant="green" className="w-full">Join a Game</NeonButton>
              </Link>
              <Link to="/auth" className="flex-1">
                <NeonButton variant="blue" className="w-full">Create a Game</NeonButton>
              </Link>
            </div>
          </div>
        </section>

        {/* LIVE ACTIVITY BAR */}
        <section className="px-4 py-4 border-y border-border bg-[color:var(--surface)]/60 backdrop-blur">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 font-mono text-xs uppercase tracking-widest">
            <div className="flex items-center gap-2 text-[color:var(--neon-orange)]">
              <Flame className="w-4 h-4" />
              <span>2,431 games live now</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="flex items-center gap-2 text-[color:var(--neon-green)]">
              <span>🏀</span>
              <span>NBA Finals squares filling fast</span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 py-14 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                How it works
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl">
                Three steps to <span className="text-[color:var(--neon-blue)]">clutch up</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Step
                num="01"
                icon={<Users className="w-6 h-6" />}
                title="Join a game"
                desc="Hop into a public game or use a private invite code from a friend."
                color="blue"
              />
              <Step
                num="02"
                icon={<MousePointerClick className="w-6 h-6" />}
                title="Pick your square"
                desc="Claim your spots on the 10×10 board before tip-off."
                color="green"
              />
              <Step
                num="03"
                icon={<Trophy className="w-6 h-6" />}
                title="Win when your numbers hit"
                desc="Score updates in real time. Quarter winners light up instantly."
                color="orange"
              />
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF */}
        <section className="px-4 py-14 sm:py-16 border-t border-border">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProofCard
              big="Friends or strangers"
              small="Play with friends or join public games"
            />
            <ProofCard
              big="Thousands daily"
              small="Squares filled every day across live games"
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="px-4 py-16 sm:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">
              Ready to play?
            </h2>
            <p className="text-muted-foreground mt-3 text-base sm:text-lg">
              Tip-off is in minutes. Grab your squares.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 max-w-md mx-auto">
              <Link to="/auth" className="flex-1">
                <NeonButton variant="green" className="w-full">Join a Game</NeonButton>
              </Link>
              <Link to="/auth" className="flex-1">
                <NeonButton variant="blue" className="w-full">Create a Game</NeonButton>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Step({
  num,
  icon,
  title,
  desc,
  color,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: "blue" | "green" | "orange";
}) {
  const colorVar =
    color === "blue"
      ? "var(--neon-blue)"
      : color === "green"
      ? "var(--neon-green)"
      : "var(--neon-orange)";
  return (
    <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-6 hover:border-[color:var(--neon-blue)]/50 transition">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${colorVar} 15%, transparent)`, color: colorVar }}
        >
          {icon}
        </div>
        <span className="font-mono text-xs text-muted-foreground tracking-widest">{num}</span>
      </div>
      <h3 className="font-display font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function ProofCard({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-6 text-center sm:text-left">
      <div className="font-display font-bold text-xl sm:text-2xl text-foreground">{big}</div>
      <div className="text-sm text-muted-foreground mt-1">{small}</div>
    </div>
  );
}
