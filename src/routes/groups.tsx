import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import watchParty from "@/assets/clutchwatchparty.png.asset.json";
import family from "@/assets/clutchsquaresfamily.png.asset.json";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Clutch Squares for Groups & Events | Shared Game-Day Play" },
      { name: "description", content: "Bring your crowd together with a simple interactive squares game for watch parties, community events, friends and family." },
      { property: "og:title", content: "Clutch Squares for Groups & Events" },
      { property: "og:description", content: "A simple interactive squares game for watch parties, community events, friends and family." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clutchsquares.com/groups" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clutchsquares.com/groups" }],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="pt-32 sm:pt-40 pb-16 px-4 sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">For Groups & Events</p>
            <h1 className="mt-4 font-display font-bold text-4xl sm:text-5xl xl:text-6xl tracking-tight leading-[0.95] max-w-3xl">
              Bring your crowd
              <br />
              <span className="text-[color:var(--neon-green)]">into the game.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Whether it's a watch party, a community event or a living room full of family, a
              shared board gives everyone a reason to watch every quarter.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-block rounded-xl bg-[color:var(--neon-green)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-background hover:brightness-110 transition"
            >
              Join a Game
            </Link>
          </div>
        </section>

        <section className="px-4 sm:px-8 pb-24">
          <div className="mx-auto max-w-[1440px] grid gap-6 md:grid-cols-2">
            {[
              { img: watchParty.url, alt: "A packed venue watch party with friends high-fiving at a table", title: "Groups & Events", desc: "Set up one board for the room and let the crowd follow along on their own phones." },
              { img: family.url, alt: "A family celebrating a play together in their living room", title: "Friends & Family", desc: "Create a private game and play with the people who matter most." },
            ].map((c) => (
              <article key={c.title} className="overflow-hidden rounded-2xl border border-border bg-[color:var(--surface)]">
                <img src={c.img} alt={c.alt} loading="lazy" className="w-full object-cover" style={{ aspectRatio: "3 / 2" }} />
                <div className="p-6">
                  <h2 className="font-display font-bold text-xl">{c.title}</h2>
                  <p className="mt-2 text-muted-foreground">{c.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
