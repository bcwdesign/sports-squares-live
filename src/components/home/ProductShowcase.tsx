import { SquaresGrid } from "@/components/SquaresGrid";
import { DEMO_GAME, DEMO_SQUARES, DEMO_WINNING_INDEX } from "./demoBoard";
import { Reveal } from "./Reveal";

export function ProductShowcase() {
  return (
    <section className="border-y border-border bg-[color:var(--surface)]/40 px-4 sm:px-8 py-20 sm:py-28">
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">
            The product
          </p>
          <h2 className="mt-4 font-display font-bold text-3xl sm:text-5xl tracking-tight">
            Everything happens on one screen.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,320px)] items-start">
          <Reveal>
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Step 1</p>
              <h3 className="mt-2 font-display font-bold text-lg">Enter your invite code</h3>
              <div className="mt-5 flex gap-2">
                {"DEMO".split("").map((ch, i) => (
                  <span
                    key={i}
                    className="flex-1 aspect-square rounded-lg border border-[color:var(--neon-blue)]/50 bg-[color:var(--neon-blue)]/10 grid place-items-center font-mono font-bold text-xl text-[color:var(--neon-blue)]"
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-[color:var(--neon-green)] py-3 text-center font-display font-bold uppercase text-xs tracking-wide text-background">
                Join game
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)]">
                  Q3 · 04:12
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">
                  MET 24 <span className="text-muted-foreground">·</span> RIV 27
                </span>
              </div>
              <SquaresGrid
                game={DEMO_GAME}
                squares={DEMO_SQUARES}
                userId="u-4"
                selectedIndex={null}
                winningIndex={DEMO_WINNING_INDEX}
                showAxes
              />
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live result</p>
              <h3 className="mt-2 font-display font-bold text-lg">The winning square lights up</h3>
              <div className="mt-5 rounded-xl border border-[color:var(--neon-orange)]/50 bg-[color:var(--neon-orange)]/10 p-5 text-center">
                <p className="font-display font-bold text-3xl text-[color:var(--neon-orange)]">7 · 4</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Quarter 3 winner
                </p>
              </div>
              <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                Scores update live, so everyone watching sees the board change as the game does.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
