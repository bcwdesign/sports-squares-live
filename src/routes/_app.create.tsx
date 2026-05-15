import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { NeonButton } from "@/components/NeonButton";
import { ArrowLeft, Mic } from "lucide-react";
import { toast } from "sonner";
import { generateInviteCode } from "@/lib/types";
import { invokeAuthed } from "@/lib/serverFnClient";
import { generateHeyGenCommentatorVideo } from "@/server/commentator.functions";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Create Game — Clutch Squares" },
      { name: "description", content: "Set up a new private squares game." },
    ],
  }),
  component: CreateGame,
});

const PERSONALITIES = [
  "Hype Announcer",
  "Trash Talk Uncle",
  "ESPN Analyst",
  "Twitch Streamer",
  "Rival Fan",
  "Family Friendly Host",
];
const VOICE_STYLES = ["Energetic", "Deep Voice", "Funny", "Professional", "Streetball", "Dramatic"];

function defaultIntroScript(name: string, away: string, home: string, personality: string) {
  return `Welcome to ${name}! I'm your ${personality.toLowerCase()} for tonight, calling every bucket as the ${away} take on the ${home}. Grab your square, lock in, and let's run it.`;
}

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

  // Commentator state
  const [commentatorEnabled, setCommentatorEnabled] = useState(false);
  const [commName, setCommName] = useState("Coach Chaos");
  const [commPersonality, setCommPersonality] = useState(PERSONALITIES[0]);
  const [commVoice, setCommVoice] = useState(VOICE_STYLES[0]);
  const [commCatchphrases, setCommCatchphrases] = useState("That square is heating up!");
  const [commIntro, setCommIntro] = useState("");
  const [commIntroEdited, setCommIntroEdited] = useState(false);
  const [heygenIntro, setHeygenIntro] = useState(false);
  const [heygenReactions, setHeygenReactions] = useState(false);

  const introScriptValue =
    commIntroEdited ? commIntro : defaultIntroScript(name, awayTeam, homeTeam, commPersonality);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const inviteCode = generateInviteCode();
      const insertPayload: Record<string, unknown> = {
        host_id: user.id,
        name: name.trim(),
        sport: "NBA",
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        game_date_time: dateTime ? new Date(dateTime).toISOString() : null,
        invite_code: inviteCode,
        max_squares_per_user: maxSquares,
        entry_amount_label: entryLabel.trim() || null,
        commentator_enabled: commentatorEnabled,
      };
      if (commentatorEnabled) {
        Object.assign(insertPayload, {
          commentator_name: commName.trim() || "Coach Chaos",
          commentator_personality: commPersonality,
          commentator_voice_style: commVoice,
          commentator_catchphrases: commCatchphrases.trim() || null,
          commentator_intro_script: introScriptValue,
          heygen_intro_enabled: heygenIntro,
          heygen_reactions_enabled: heygenReactions,
        });
      }
      const { data, error } = await supabase
        .from("games")
        .insert(insertPayload as never)
        .select()
        .single();
      if (error) throw error;
      toast.success("Game created!");

      // Fire-and-forget HeyGen intro generation; never block navigation.
      if (commentatorEnabled && heygenIntro) {
        invokeAuthed(generateHeyGenCommentatorVideo, { gameId: data.id }).catch((err) => {
          console.error("HeyGen intro generation failed:", err);
        });
      }

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

          {/* AI Commentator section */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)]/60 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-bold flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[color:var(--neon-blue)]" /> 🎙 AI Commentator
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Give this game its own host for hype, trash talk, score updates, halftime reactions, and final calls.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommentatorEnabled((v) => !v)}
                aria-pressed={commentatorEnabled}
                aria-label="Enable AI Commentator"
                className={`relative w-12 h-7 rounded-full border transition flex-shrink-0 ${
                  commentatorEnabled
                    ? "bg-[color:var(--neon-green)] border-[color:var(--neon-green)]"
                    : "bg-muted border-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                    commentatorEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {commentatorEnabled && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                <FieldGroup label="Commentator name">
                  <Input value={commName} onChange={setCommName} placeholder="Coach Chaos" maxLength={40} />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Personality">
                    <Select value={commPersonality} onChange={setCommPersonality} options={PERSONALITIES} />
                  </FieldGroup>
                  <FieldGroup label="Voice style">
                    <Select value={commVoice} onChange={setCommVoice} options={VOICE_STYLES} />
                  </FieldGroup>
                </div>

                <FieldGroup label="Catchphrases">
                  <Input
                    value={commCatchphrases}
                    onChange={setCommCatchphrases}
                    placeholder="That square is heating up!"
                    maxLength={120}
                  />
                </FieldGroup>

                <FieldGroup label="Intro script">
                  <textarea
                    value={introScriptValue}
                    onChange={(e) => {
                      setCommIntro(e.target.value);
                      setCommIntroEdited(true);
                    }}
                    rows={3}
                    maxLength={600}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)] text-sm resize-y"
                  />
                </FieldGroup>

                <Checkbox
                  checked={heygenIntro}
                  onChange={setHeygenIntro}
                  label="Generate HeyGen intro video"
                />
                <Checkbox
                  checked={heygenReactions}
                  onChange={setHeygenReactions}
                  label="Generate HeyGen halftime/final reaction clips"
                />
              </div>
            )}
          </div>

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

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)] text-foreground"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
          checked
            ? "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)]"
            : "border-border bg-[color:var(--surface)]"
        }`}
      >
        {checked && <span className="text-background font-bold text-xs">✓</span>}
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}
