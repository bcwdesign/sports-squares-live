import { KeyRound, MousePointerClick, PartyPopper } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

const STEPS: { num: string; icon: ReactNode; title: string; desc: string; color: string }[] = [
  {
    num: "01",
    icon: <KeyRound className="w-6 h-6" />,
    title: "Join a game",
    desc: "Use an invite code to enter your company, group or event game.",
    color: "var(--neon-blue)",
  },
  {
    num: "02",
    icon: <MousePointerClick className="w-6 h-6" />,
    title: "Pick your squares",
    desc: "Select your squares on the digital 10×10 board.",
    color: "var(--neon-green)",
  },
  {
    num: "03",
    icon: <PartyPopper className="w-6 h-6" />,
    title: "Watch & celebrate",
    desc: "Follow the live score and see which square wins as the game changes.",
    color: "var(--neon-orange)",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 sm:px-8 py-20 sm:py-28">
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">
            How Clutch Squares works
          </p>
          <h2 className="mt-4 font-display font-bold text-3xl sm:text-5xl tracking-tight">
            Three simple steps to get in the game.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 100}>
              <div className="h-full rounded-2xl border border-border bg-[color:var(--surface)] p-7 transition-colors hover:border-[color:var(--neon-blue)]/50">
                <div className="flex items-center justify-between">
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in oklab, ${s.color} 15%, transparent)`, color: s.color }}
                  >
                    {s.icon}
                  </span>
                  <span className="font-mono text-xs tracking-widest text-muted-foreground">{s.num}</span>
                </div>
                <h3 className="mt-5 font-display font-bold text-xl">{s.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
