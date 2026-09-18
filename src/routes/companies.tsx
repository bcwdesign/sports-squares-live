import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/SiteFooter";
import celebrate from "@/assets/clutchsquarescelebrate.png.asset.json";

export const Route = createFileRoute("/companies")({
  head: () => ({
    meta: [
      { title: "Clutch Squares for Companies | Employee Game-Day Engagement" },
      { name: "description", content: "Create private squares games for your organization. Simple invite-code access, large-group participation and live game engagement for remote and in-office teams." },
      { property: "og:title", content: "Clutch Squares for Companies" },
      { property: "og:description", content: "Turn game day into a shared employee experience with private, invite-only squares games." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clutchsquares.com/companies" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clutchsquares.com/companies" }],
  }),
  component: CompaniesPage,
});

const BENEFITS = [
  ["Private company games", "Every game is invite-only, so participation stays inside your organization."],
  ["Simple invite-code access", "Share one code. Employees join in seconds, no setup required."],
  ["Large-group participation", "A 100-square board gives a lot of people a reason to watch together."],
  ["Live game engagement", "Scores and winning squares update in real time during the game."],
  ["Remote + in-office friendly", "Everyone plays from their own screen, wherever they are."],
  ["Branded experiences", "Apply your company colours and logo to the board and broadcast view."],
];

function CompaniesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="pt-32 sm:pt-40 pb-16 px-4 sm:px-8">
          <div className="mx-auto max-w-[1440px] grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--neon-blue)]">For Companies</p>
              <h1 className="mt-4 font-display font-bold text-4xl sm:text-5xl xl:text-6xl tracking-tight leading-[0.95]">
                Make game day
                <br />
                <span className="text-[color:var(--neon-green)]">a team experience.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                Turn the games everyone is already talking about into a shared employee experience.
                Create private games, invite your organization and bring teams together across
                offices and locations.
              </p>
              <Link
                to="/auth"
                className="mt-8 inline-block rounded-xl bg-[color:var(--neon-green)] px-6 py-3.5 font-display font-bold uppercase tracking-wide text-sm text-background hover:brightness-110 transition"
              >
                Create a Game
              </Link>
            </div>
            <img
              src={celebrate.url}
              alt="Colleagues celebrating together during a game-day watch party in an office lounge"
              loading="lazy"
              className="rounded-2xl border border-border object-cover w-full"
              style={{ aspectRatio: "16 / 9" }}
            />
          </div>
        </section>

        <section className="px-4 sm:px-8 pb-24">
          <div className="mx-auto max-w-[1440px] grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-border bg-[color:var(--surface)] p-6">
                <h2 className="font-display font-bold text-base">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
