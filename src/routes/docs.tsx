// Public documentation page describing the realtime game state system
// and the (currently manual) NBA score entry flow.

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "API & Integration Docs — Clutch Squares" },
      {
        name: "description",
        content:
          "Developer documentation for Clutch Squares: realtime game state subscriptions and NBA live score updates.",
      },
      { property: "og:title", content: "API & Integration Docs — Clutch Squares" },
      {
        property: "og:description",
        content:
          "How to subscribe to realtime game state and push NBA live score updates in Clutch Squares.",
      },
    ],
  }),
  component: DocsPage,
});

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-10 border-b border-border/50">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-orange)] mb-2">
        {eyebrow}
      </div>
      <h2 className="font-display font-bold text-3xl sm:text-4xl mb-6 tracking-tight">
        {title}
      </h2>
      <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto text-xs sm:text-sm font-mono text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-[0.85em] text-[color:var(--neon-green)]">
      {children}
    </code>
  );
}

function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-lg tracking-tight">
            <span className="text-[color:var(--neon-blue)]">CLUTCH</span>{" "}
            <span className="text-[color:var(--neon-green)]">SQUARES</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Docs · v1
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-20">
        <div className="pt-12 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-blue)] mb-3">
            Developer reference
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight leading-[1.05]">
            Integration & API Documentation
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            How Clutch Squares delivers realtime game state to every connected
            client and how NBA live scores flow into the board.
          </p>

          <nav className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-widest">
            <a href="#overview" className="px-3 py-1 rounded-full border border-border hover:border-[color:var(--neon-blue)]/60">Overview</a>
            <a href="#realtime" className="px-3 py-1 rounded-full border border-border hover:border-[color:var(--neon-green)]/60">Realtime</a>
            <a href="#scores" className="px-3 py-1 rounded-full border border-border hover:border-[color:var(--neon-orange)]/60">NBA Scores</a>
            <a href="#schema" className="px-3 py-1 rounded-full border border-border hover:border-[color:var(--neon-blue)]/60">Schema</a>
            <a href="#auth" className="px-3 py-1 rounded-full border border-border hover:border-[color:var(--neon-green)]/60">Auth</a>
          </nav>
        </div>

        <Section id="overview" eyebrow="01 — Overview" title="Architecture at a glance">
          <p>
            Clutch Squares runs on Lovable Cloud, which provides a Postgres
            database, row-level security, and a realtime channel layer. Every
            connected player, host, and TV overlay subscribes to the same
            game-scoped channel and receives row-level changes as they happen.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><InlineCode>games</InlineCode> — the source of truth for score, clock, quarter, and status.</li>
            <li><InlineCode>squares</InlineCode> — 100 cells per game, owned by players.</li>
            <li><InlineCode>game_players</InlineCode> — roster of who is in the lobby.</li>
            <li><InlineCode>messages</InlineCode> — chat stream during the game.</li>
          </ul>
        </Section>

        <Section id="realtime" eyebrow="02 — Realtime" title="Subscribing to game state">
          <p>
            Realtime updates use Postgres change data capture exposed over a
            websocket channel. A single channel per game streams inserts,
            updates, and deletes for the four tables above.
          </p>
          <p>
            The reference implementation lives in{" "}
            <InlineCode>src/hooks/useGame.ts</InlineCode>. Subscribe with the
            client SDK like this:
          </p>
          <Code>{`import { supabase } from "@/integrations/supabase/client";

const channel = supabase
  .channel(\`game:\${gameId}\`)
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "games", filter: \`id=eq.\${gameId}\` },
    (payload) => {
      // payload.new is the updated game row
      // payload.eventType is "INSERT" | "UPDATE" | "DELETE"
    },
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "squares", filter: \`game_id=eq.\${gameId}\` },
    (payload) => { /* a square was claimed or released */ },
  )
  .subscribe();

// Always clean up on unmount
return () => { supabase.removeChannel(channel); };`}</Code>
          <p>
            Payloads follow the standard Postgres CDC format:{" "}
            <InlineCode>eventType</InlineCode>, <InlineCode>new</InlineCode>,
            <InlineCode>old</InlineCode>, and <InlineCode>schema</InlineCode>.
            Treat them as authoritative — do not optimistically mutate state
            without reconciling against the broadcast.
          </p>
          <p>
            Anonymous subscribers (e.g. the public TV overlay) cannot use
            realtime because RLS gates the channel. For those views, poll{" "}
            <InlineCode>get_overlay_by_token</InlineCode> on a 3-second interval
            instead — see <InlineCode>src/routes/overlay.$token.tsx</InlineCode>.
          </p>
        </Section>

        <Section id="scores" eyebrow="03 — Live scores" title="NBA score ingestion">
          <p>
            Scores currently flow into the board through the host's scoring
            console rather than an upstream NBA feed. The host edits a draft in{" "}
            <InlineCode>score_drafts</InlineCode> and commits it to the{" "}
            <InlineCode>games</InlineCode> row, which broadcasts to every
            client and triggers winner detection.
          </p>
          <p>Commit a score update from the host UI:</p>
          <Code>{`await supabase
  .from("games")
  .update({
    home_score: 88,
    away_score: 85,
    quarter: 4,
    clock: "2:14",
  })
  .eq("id", gameId);`}</Code>
          <p>
            Validation rules (enforced client-side in the scoring console):
            scores must be non-negative integers, quarter is{" "}
            <InlineCode>1–4</InlineCode> or overtime, and clock matches{" "}
            <InlineCode>M:SS</InlineCode> or <InlineCode>MM:SS</InlineCode>.
          </p>
          <p>
            <strong className="text-foreground">Plugging in a live NBA provider.</strong>{" "}
            To replace manual entry with an upstream feed (e.g. a sports data
            API), call the same update from a server function on a poll or
            webhook. The realtime layer downstream does not change:
          </p>
          <Code>{`// Pseudocode for a future server-side ingest
const live = await fetch("https://your-nba-provider/games/" + externalId).then(r => r.json());

await supabaseAdmin
  .from("games")
  .update({
    home_score: live.homeScore,
    away_score: live.awayScore,
    quarter: live.period,
    clock: live.clock,
    status: live.isFinal ? "completed" : "live",
  })
  .eq("id", gameId);`}</Code>
          <p>
            Winner calculation is deterministic and runs on the client from the
            committed score — see <InlineCode>winningSquareIndex</InlineCode> in{" "}
            <InlineCode>src/lib/types.ts</InlineCode>.
          </p>
        </Section>

        <Section id="schema" eyebrow="04 — Schema" title="Key tables">
          <p>The shape of each broadcast payload mirrors these tables:</p>
          <Code>{`games (
  id uuid primary key,
  status        game_status,        -- lobby | locked | live | completed
  home_score    int,
  away_score    int,
  quarter       int,
  clock         text,               -- "M:SS"
  home_axis     int[],              -- shuffled 0..9
  away_axis     int[],              -- shuffled 0..9
  share_token   text                -- public overlay token
)

squares (
  id uuid primary key,
  game_id uuid references games(id),
  row int, col int,                 -- 0..9
  owner_id uuid, owner_name text
)`}</Code>
        </Section>

        <Section id="auth" eyebrow="05 — Auth" title="Access rules">
          <p>
            All write paths are protected by row-level security. A user can
            update <InlineCode>games</InlineCode> only if they are the host
            (<InlineCode>is_game_host</InlineCode>), and can claim a square
            only if <InlineCode>can_claim_square</InlineCode> returns true.
            Reads are scoped to game members via{" "}
            <InlineCode>is_game_member</InlineCode>.
          </p>
          <p>
            For the public watch-party overlay, the host shares a URL containing{" "}
            <InlineCode>games.share_token</InlineCode>. The{" "}
            <InlineCode>get_overlay_by_token</InlineCode> RPC is the only path
            that returns game data without an authenticated session, and it
            exposes a read-only snapshot.
          </p>
        </Section>

        <div className="pt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
