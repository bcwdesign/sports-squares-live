import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import celebrate from "@/assets/clutchsquarescelebrate.png.asset.json";
import watchParty from "@/assets/clutchwatchparty.png.asset.json";
import family from "@/assets/clutchsquaresfamily.png.asset.json";
import { Reveal } from "./Reveal";

const CARDS = [
  {
    img: celebrate.url,
    alt: "Coworkers cheering together around a screen in an office lounge",
    eyebrow: "Corporate",
    title: "Companies & Teams",
    desc: "Turn game day into an interactive employee experience that brings teams together.",
    to: "/companies" as const,
    featured: true,
  },
  {
    img: watchParty.url,
    alt: "A lively watch party crowd celebrating during a live game",
    eyebrow: "Groups",
    title: "Groups & Events",
    desc: "Bring your crowd together with a simple interactive game experience.",
    to: "/groups" as const,
    featured: false,
  },
  {
    img: family.url,
    alt: "A family watching a game together at home and celebrating",
    eyebrow: "Friends",
    title: "Friends & Family",
    desc: "Create a private game and play with the people who matter most.",
    to: "/groups" as const,
    featured: false,
  },
];

export function AudienceCards() {
  return (
    <section id="for-groups" className="scroll-mt-24 px-4 sm:px-8 py-20 sm:py-28">
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="max-w-2xl">
          <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">
            Built for every group.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Whether it's the office, a watch party, or a community event, Clutch Squares brings
            people together around the game.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr_1fr]">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 100}>
              <article
                className={`group h-full overflow-hidden rounded-2xl border bg-[color:var(--surface)] transition-colors ${
                  c.featured
                    ? "border-[color:var(--neon-green)]/45"
                    : "border-border hover:border-[color:var(--neon-blue)]/50"
                }`}
              >
                <div className="overflow-hidden">
                  <img
                    src={c.img}
                    alt={c.alt}
                    loading="lazy"
                    className="w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    style={{ aspectRatio: c.featured ? "16 / 11" : "16 / 10" }}
                  />
                </div>
                <div className="p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {c.eyebrow}
                  </p>
                  <h3 className={`mt-3 font-display font-bold ${c.featured ? "text-2xl" : "text-xl"}`}>
                    {c.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{c.desc}</p>
                  <Link
                    to={c.to}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--neon-blue)] hover:gap-3 transition-all"
                  >
                    Learn more <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
