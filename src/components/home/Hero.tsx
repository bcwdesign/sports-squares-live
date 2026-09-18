import { Link } from "@tanstack/react-router";
import stadium from "@/assets/clutchsquarestadium.png.asset.json";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 sm:pt-32 lg:pt-40 pb-14 lg:pb-20">
      <img
        src={stadium.url}
        alt=""
        aria-hidden
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "linear-gradient(to right, oklch(0.10 0.015 250 / 0.96) 0%, oklch(0.10 0.015 250 / 0.82) 45%, oklch(0.10 0.015 250 / 0.55) 100%), linear-gradient(to bottom, oklch(0.10 0.015 250 / 0.85), transparent 35%, oklch(0.13 0.01 250) 100%)",
        }}
      />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 grid gap-10 lg:grid-cols-[48fr_52fr] lg:items-center">
        <div className="animate-fade-in">
          <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">
            Live sports. Big moments. Your square.
          </p>
          <h1 className="mt-5 font-display font-bold tracking-tight text-[2.6rem] leading-[0.95] sm:text-6xl xl:text-[4.4rem]">
            Turn game day
            <br />
            into a{" "}
            <span className="text-[color:var(--neon-green)]">shared experience.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Bring your team together around the games they already love. Clutch Squares turns live
            football and basketball into a simple, interactive experience for companies, groups and
            communities.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md">
            <Link
              to="/auth"
              className="flex-1 text-center rounded-xl bg-[color:var(--neon-green)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-background transition hover:brightness-110 hover:shadow-[var(--shadow-neon-green)]"
            >
              Join a Game
            </Link>
            <Link
              to="/auth"
              className="flex-1 text-center rounded-xl border border-[color:var(--neon-blue)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-[color:var(--neon-blue)] transition hover:bg-[color:var(--neon-blue)]/10"
            >
              Create a Game
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted-foreground/80">
            No spreadsheets. No complicated setup. Just pick, watch, and play together.
          </p>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-[color:var(--neon-blue)]/50 bg-background/50 p-1.5 shadow-[0_0_60px_-12px_oklch(0.72_0.22_240_/_0.55)]">
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube-nocookie.com/embed/UHNAU4-sdX4?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1"
                title="Clutch Squares overview video"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Watch the Clutch Squares video — starts muted
          </p>
        </div>
      </div>
    </section>
  );
}
