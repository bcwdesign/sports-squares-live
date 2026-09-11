import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { NeonButton } from "@/components/NeonButton";
import { ArrowLeft, Mic, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { generateInviteCode } from "@/lib/types";
import { invokeAuthed } from "@/lib/serverFnClient";
import { generateHeyGenCommentatorVideo } from "@/lib/commentator.functions";
import { COMMENTATORS, COMMENTATOR_NAMES, getCommentatorByName } from "@/lib/commentators";
import { NflGamePicker } from "@/components/NflGamePicker";
import type { NormalizedLiveGame, SportKey } from "@/lib/balldontlie.types";
import { BrandingSection } from "@/components/branding/BrandingSection";
import { DEFAULT_BRANDING, brandingToGameColumns, type GameBranding } from "@/lib/branding";



export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Create Game — Clutch Squares" },
      { name: "description", content: "Set up a new private squares game." },
    ],
  }),
  component: CreateGame,
});

const PERSONALITIES = COMMENTATOR_NAMES;
const VOICE_STYLES = ["Energetic", "Deep Voice", "Funny", "Professional", "Streetball", "Dramatic"];

function defaultIntroScript(name: string, away: string, home: string, personality: string) {
  const preset = getCommentatorByName(personality);
  const role = preset?.description.toLowerCase() ?? "commentator";
  return `Welcome to ${name}! I'm ${personality}, your ${role} for tonight, calling every score as the ${away} take on the ${home}. Grab your square, lock in, and let's run it.`;
}

const SPORT_DEFAULTS: Record<SportKey, { name: string; away: string; home: string }> = {
  NBA: { name: "NBA Finals Watch Party", away: "Mavericks", home: "Celtics" },
  NFL: { name: "NFL Watch Party", away: "Eagles", home: "Cowboys" },
};

/** Convert an ISO timestamp into a value the datetime-local input accepts. */
function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateGame() {
  const { user } = useAuth();
  const { canHost, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [sport, setSport] = useState<SportKey>("NBA");
  const [name, setName] = useState(SPORT_DEFAULTS.NBA.name);
  const [nameEdited, setNameEdited] = useState(false);
  const [homeTeam, setHomeTeam] = useState("Celtics");
  const [awayTeam, setAwayTeam] = useState("Mavericks");
  const [dateTime, setDateTime] = useState("");
  const [maxSquares, setMaxSquares] = useState(10);
  const [entryLabel, setEntryLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiGame, setApiGame] = useState<NormalizedLiveGame | null>(null);

  // Custom branding (optional; off by default)
  const [branding, setBranding] = useState<GameBranding>(DEFAULT_BRANDING);




  // Prize Mode state (optional, disabled by default)
  const [prizeEnabled, setPrizeEnabled] = useState(false);
  const [prizeType, setPrizeType] = useState<"food" | "alcohol" | "money" | "gift">("food");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeTiming, setPrizeTiming] =
    useState<"q1" | "q2" | "q3" | "final" | "every_quarter">("final");
  const requiresAgeVerification = prizeType === "alcohol" || prizeType === "money";



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

  const changeSport = (next: SportKey) => {
    if (next === sport) return;
    setSport(next);
    setApiGame(null);
    const d = SPORT_DEFAULTS[next];
    setHomeTeam(d.home);
    setAwayTeam(d.away);
    setDateTime("");
    if (!nameEdited) setName(d.name);
  };

  const selectApiGame = (g: NormalizedLiveGame) => {
    setApiGame(g);
    setHomeTeam(g.home_team_name || g.home_team_abbreviation);
    setAwayTeam(g.away_team_name || g.away_team_abbreviation);
    setDateTime(toLocalInputValue(g.start_time));
    if (!nameEdited) {
      setName(`${g.away_team_abbreviation || g.away_team_name} @ ${g.home_team_abbreviation || g.home_team_name} Squares`);
    }
  };

  const clearApiGame = () => setApiGame(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const inviteCode = generateInviteCode();
      const insertPayload: Record<string, unknown> = {
        host_id: user.id,
        name: name.trim(),
        sport,
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        game_date_time: dateTime ? new Date(dateTime).toISOString() : null,
        invite_code: inviteCode,
        max_squares_per_user: maxSquares,
        entry_amount_label: entryLabel.trim() || null,
        commentator_enabled: commentatorEnabled,
        prize_enabled: prizeEnabled,
        prize_type: prizeEnabled ? prizeType : null,
        prize_description: prizeEnabled ? (prizeDescription.trim() || null) : null,
        prize_timing: prizeEnabled ? prizeTiming : null,
        requires_age_verification: prizeEnabled && requiresAgeVerification,
        ...brandingToGameColumns(branding),
      };


      if (apiGame) {
        Object.assign(insertPayload, {
          external_provider: "balldontlie",
          external_game_id: apiGame.external_game_id,
          external_home_team_id: apiGame.home_team_id || null,
          external_away_team_id: apiGame.away_team_id || null,
          external_home_team_name: apiGame.home_team_name || null,
          external_away_team_name: apiGame.away_team_name || null,
          game_status: apiGame.game_status,
          score_source: "api",
          auto_sync_enabled: true,
        });
      }


      if (commentatorEnabled) {
        const preset = getCommentatorByName(commPersonality);
        Object.assign(insertPayload, {
          commentator_name: commName.trim() || commPersonality,
          commentator_personality: commPersonality,
          commentator_voice_style: commVoice,
          commentator_catchphrases: commCatchphrases.trim() || null,
          commentator_intro_script: introScriptValue,
          heygen_intro_enabled: heygenIntro,
          heygen_reactions_enabled: heygenReactions,
          heygen_avatar_id: preset?.heygenAvatarId ?? null,
          heygen_voice_id: preset?.heygenVoiceId ?? null,
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

  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!canHost) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-xl border border-border bg-[color:var(--surface)] p-8">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-[color:var(--neon-orange)]" aria-hidden="true" />
          <h1 className="font-display font-bold text-2xl mb-2">Hosting access required</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You can join and play in existing games. Creating a new Squares game currently requires Host access.
          </p>
          <Link to="/dashboard">
            <NeonButton variant="ghost" className="w-full">Back to dashboard</NeonButton>
          </Link>
        </div>
      </div>
    );
  }

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
            <Input
              value={name}
              onChange={(v) => {
                setName(v);
                setNameEdited(true);
              }}
              placeholder={SPORT_DEFAULTS[sport].name}
              maxLength={60}
              required
            />
          </FieldGroup>

          <FieldGroup label="Sport">
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose sport">
              {(["NBA", "NFL"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSport(s)}
                  aria-pressed={sport === s}
                  className={`px-4 py-3 rounded-xl border font-display font-bold flex items-center justify-center gap-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--neon-blue)] ${
                    sport === s
                      ? "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)] text-background"
                      : "bg-[color:var(--surface)] border-border hover:border-[color:var(--neon-blue)]/60"
                  }`}
                >
                  <span aria-hidden="true">{s === "NBA" ? "🏀" : "🏈"}</span> {s}
                </button>
              ))}
            </div>
          </FieldGroup>

          {sport === "NFL" && (
            <NflGamePicker
              selectedId={apiGame?.external_game_id ?? null}
              onSelect={selectApiGame}
            />
          )}

          {apiGame && (
            <div className="rounded-xl border border-[color:var(--neon-green)]/40 bg-[color:var(--neon-green)]/10 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-display font-bold">
                  {apiGame.away_team_abbreviation} @ {apiGame.home_team_abbreviation}
                </span>
                <div className="text-xs text-muted-foreground">
                  Live scores connected — teams and kickoff are locked to this matchup.
                </div>
              </div>
              <button
                type="button"
                onClick={clearApiGame}
                className="shrink-0 px-3 py-1.5 rounded-md border border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
              >
                Edit manually
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Away team">
              <Input
                value={awayTeam}
                onChange={setAwayTeam}
                placeholder={SPORT_DEFAULTS[sport].away}
                maxLength={30}
                required
                readOnly={!!apiGame}
              />
            </FieldGroup>
            <FieldGroup label="Home team">
              <Input
                value={homeTeam}
                onChange={setHomeTeam}
                placeholder={SPORT_DEFAULTS[sport].home}
                maxLength={30}
                required
                readOnly={!!apiGame}
              />
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
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {[1, 2, 3, 5, 10, 15, 20, 25].map((n) => (
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

          {/* Prize Mode section */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)]/60 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-bold flex items-center gap-2">
                  🏆 Prize Mode
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Attach a real-world prize to one or every quarter.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrizeEnabled((v) => !v)}
                aria-pressed={prizeEnabled}
                aria-label="Enable quarterly prizes"
                className={`relative w-12 h-7 rounded-full border transition flex-shrink-0 ${
                  prizeEnabled
                    ? "bg-[color:var(--neon-green)] border-[color:var(--neon-green)]"
                    : "bg-muted border-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                    prizeEnabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {prizeEnabled && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                <FieldGroup label="Prize type">
                  <div className="grid grid-cols-4 gap-2">
                    {(["food", "alcohol", "money", "gift"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPrizeType(t)}
                        className={`py-3 rounded-xl border font-display font-bold capitalize transition ${
                          prizeType === t
                            ? "bg-[color:var(--neon-blue)] border-[color:var(--neon-blue)] text-background"
                            : "bg-[color:var(--surface)] border-border hover:border-[color:var(--neon-blue)]/60"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label="Prize description">
                  <Input
                    value={prizeDescription}
                    onChange={setPrizeDescription}
                    placeholder="Example: Free wings, $25 gift card, $100 cash prize"
                    maxLength={120}
                  />
                </FieldGroup>

                <FieldGroup label="Prize timing">
                  <select
                    value={prizeTiming}
                    onChange={(e) => setPrizeTiming(e.target.value as typeof prizeTiming)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)] text-foreground"
                  >
                    <option value="q1">Q1 Winner</option>
                    <option value="q2">Q2 Winner</option>
                    <option value="q3">Q3 Winner</option>
                    <option value="final">Final Winner</option>
                    <option value="every_quarter">Every Quarter</option>
                  </select>
                </FieldGroup>


                {requiresAgeVerification && (
                  <div className="px-4 py-3 rounded-xl border border-[color:var(--neon-red,theme(colors.red.500))]/40 bg-red-500/10 text-red-400 text-sm">
                    ⚠️ Age verification required before prize can be claimed.
                  </div>
                )}
              </div>
            )}
          </div>

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
                    <Select
                      value={commPersonality}
                      onChange={(v) => {
                        setCommPersonality(v);
                        const preset = getCommentatorByName(v);
                        if (preset) {
                          setCommName(preset.name);
                          setCommVoice(preset.voiceStyle);
                          if (!commCatchphrases.trim() || COMMENTATORS.some((c) => c.catchphrase === commCatchphrases)) {
                            setCommCatchphrases(preset.catchphrase);
                          }
                        }
                      }}
                      options={PERSONALITIES}
                    />
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

          {/* Custom Branding section */}
          <BrandingSection value={branding} onChange={setBranding} />



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
  value, onChange, placeholder, maxLength, required, type = "text", readOnly,
}: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; required?: boolean; type?: string; readOnly?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      readOnly={readOnly}
      className={`w-full px-4 py-3 rounded-xl border border-border bg-[color:var(--surface)] focus:outline-none focus:border-[color:var(--neon-blue)] ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
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
