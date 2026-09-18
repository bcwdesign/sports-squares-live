import { SquaresGrid } from "@/components/SquaresGrid";
import { DEMO_GAME, DEMO_SQUARES, DEMO_WINNING_INDEX } from "./demoBoard";
import { Reveal } from "./Reveal";

export function ExplainSquares() {
  return (
    <section id="see-how-it-works" className="px-4 sm:px-8 py-20 sm:py-28 border-t border-border">
      <div className="mx-auto max-w-[1440px] grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">
            See how it works
          </p>
          <h2 className="mt-4 font-display font-bold text-3xl sm:text-5xl tracking-tight leading-[1.02]">
            The last digit of each team's score decides the winning square.
          </h2>
          <div className="mt-8 rounded-2xl border border-border bg-[color:var(--surface)] p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-blue)]">Away</p>
                <p className="font-display font-bold text-lg truncate">Metro Knights</p>
              </div>
              <p className="font-display font-bold text-4xl tabular-nums">24</p>
            </div>
            <div className="my-4 h-px bg-border" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-green)]">Home</p>
                <p className="font-display font-bold text-lg truncate">River City Hawks</p>
              </div>
              <p className="font-display font-bold text-4xl tabular-nums">27</p>
            </div>
          </div>
          <div className="mt-6 inline-flex flex-col gap-1 rounded-xl border border-[color:var(--neon-orange)]/50 bg-[color:var(--neon-orange)]/10 px-5 py-4">
            <span className="font-display font-bold text-[color:var(--neon-orange)]">Winning square 7, 4</span>
            <span className="font-mono text-xs text-muted-foreground">Last digits: 4 (Knights) – 7 (Hawks)</span>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 sm:p-6">
            <SquaresGrid
              game={DEMO_GAME}
              squares={DEMO_SQUARES}
              userId={null}
              selectedIndex={null}
              winningIndex={DEMO_WINNING_INDEX}
              showAxes
            />
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sample board — fictional teams
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
