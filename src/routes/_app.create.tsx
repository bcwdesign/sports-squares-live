import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { generateInviteCode } from "@/lib/types";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Create Game — Clutch Squares" },
      { name: "description", content: "Set up a new private squares game." },
    ],
  }),
  component: CreateGame,
});

function CreateGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("NBA Finals Watch Party");
  const [homeTeam, setHomeTeam] = useState("Celtics");
  const [awayTeam, setAwayTeam] = useState("Mavericks");
  const [dateTime, setDateTime] = useState("");
  const [maxSquares, setMaxSquares] = useState(10);
  const [entryLabel, setEntryLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase
        .from("games")
        .insert({
          host_id: user.id,
          name: name.trim(),
          sport: "NBA",
          home_team: homeTeam.trim(),
          away_team: awayTeam.trim(),
          game_date_time: dateTime ? new Date(dateTime).toISOString() : null,
          invite_code: inviteCode,
          max_squares_per_user: maxSquares,
          entry_amount_label: entryLabel.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Game created!");
      navigate({ to: "/game/$gameId/invite", params: { gameId: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" aria-label="Back to dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display font-bold">New Game</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <form onSubmit={submit} className="space-y-5">
          <FieldGroup label="Game name">
            <Input value={name} onChange={setName} placeholder="NBA Finals Watch Party" maxLength={60} required />
          </FieldGroup>

          <FieldGroup label="Sport">
            <div className="px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] font-display font-bold">
              🏀 NBA
            </div>
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Away team">
              <Input value={awayTeam} onChange={setAwayTeam} placeholder="Mavericks" maxLength={30} required />
            </FieldGroup>
            <FieldGroup label="Home team">
              <Input value={homeTeam} onChange={setHomeTeam} placeholder="Celtics" maxLength={30} required />
            </FieldGroup>
          </div>

          <FieldGroup label="Game date & time (optional)">
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)] text-foreground"
            />
          </FieldGroup>

          <FieldGroup label="Max squares per player">
            <div className="grid grid-cols-5 gap-2">
              {[5, 10, 15, 20, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxSquares(n)}
                  className={`py-3 rounded-xl border font-display font-bold transition ${
                    maxSquares === n
                      ? "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)] text-background"
                      : "bg-[color:var(--surface)] border-border hover:border-[color:var(--neon-blue)]/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup label="Entry / payout label (optional, tracking only)">
            <Input value={entryLabel} onChange={setEntryLabel} placeholder="$20 buy-in · $500/quarter" maxLength={60} />
          </FieldGroup>

          <FieldGroup label="Privacy">
            <div className="px-4 py-3 rounded-xl border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 text-[color:var(--neon-green)] font-display font-bold flex items-center gap-2">
              🔒 Private — invite only
            </div>
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <Link to="/dashboard">
              <NeonButton type="button" variant="ghost" className="w-full">Cancel</NeonButton>
            </Link>
            <NeonButton type="submit" variant="green" disabled={submitting}>
              {submitting ? "Creating..." : "Create Game"}
            </NeonButton>
          </div>
        </form>
      </main>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, maxLength, required, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; required?: boolean; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className="w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)]"
    />
  );
}
