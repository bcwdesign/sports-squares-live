import { Link } from "@tanstack/react-router";
import corporateStadium from "@/assets/corporatestatdium.png.asset.json";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={corporateStadium.url}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.10 0.015 250 / 0.92), oklch(0.10 0.015 250 / 0.75), oklch(0.10 0.015 250 / 0.95))",
        }}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-20 sm:py-28 text-center">
        <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">
          Ready to <span className="text-[color:var(--neon-green)]">play together?</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Create a game for your team or join with an invite code and make the next game day more
          engaging.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <Link
            to="/auth"
            className="flex-1 rounded-xl bg-[color:var(--neon-green)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-background transition hover:brightness-110 hover:shadow-[var(--shadow-neon-green)]"
          >
            Join a Game
          </Link>
          <Link
            to="/auth"
            className="flex-1 rounded-xl border border-[color:var(--neon-blue)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-[color:var(--neon-blue)] transition hover:bg-[color:var(--neon-blue)]/10"
          >
            Create a Game
          </Link>
        </div>
      </div>
    </section>
  );
}
