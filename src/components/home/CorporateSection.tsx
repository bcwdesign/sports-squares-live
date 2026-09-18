import { Link } from "@tanstack/react-router";
import celebrate from "@/assets/clutchsquarescelebrate.png.asset.json";
import { Reveal } from "./Reveal";

const CHIPS = [
  "Private company games",
  "Simple invite-code access",
  "Large-group participation",
  "Live game engagement",
  "Remote + in-office friendly",
  "Branded experiences",
];

export function CorporateSection() {
  return (
    <section id="for-companies" className="scroll-mt-24 border-y border-border bg-[color:var(--surface)]/40 px-4 sm:px-8 py-20 sm:py-28">
      <div className="mx-auto max-w-[1440px] grid gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <img
            src={celebrate.url}
            alt="Colleagues celebrating a play together during an office game-day watch party"
            loading="lazy"
            className="w-full rounded-2xl border border-border object-cover"
            style={{ aspectRatio: "4 / 3" }}
          />
        </Reveal>
        <Reveal delay={100}>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-green)]">
            For companies
          </p>
          <h2 className="mt-4 font-display font-bold text-3xl sm:text-5xl tracking-tight leading-[1.02]">
            Make game day a <span className="text-[color:var(--neon-green)]">team experience.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Turn the games everyone is already talking about into a shared employee experience.
            Create private games, invite your organization and bring teams together across offices
            and locations.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <li
                key={c}
                className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground"
              >
                {c}
              </li>
            ))}
          </ul>
          <Link
            to="/companies"
            className="mt-9 inline-block rounded-xl bg-[color:var(--neon-green)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-background transition hover:brightness-110 hover:shadow-[var(--shadow-neon-green)]"
          >
            Clutch Squares for Companies
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
