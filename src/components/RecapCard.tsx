// Shareable Recap Card
//
// Neon-styled, screenshottable summary of a finished game:
// - Final score banner
// - Per-quarter winners (Q1..Q4)
// - Final MVP (the Q4 / final winner)
// - Branding footer
//
// Designed at a fixed 1080x1350 (Instagram portrait) intrinsic size so the
// PNG export is consistent regardless of viewport. Visually it's wrapped in
// a `transform: scale(...)` container by callers when shown on small screens.

import { Trophy, Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Game } from "@/lib/types";

export type QuarterResult = {
  quarter: number;
  home_score: number;
  away_score: number;
  home_digit: number;
  away_digit: number;
  winner_name: string | null;
  is_final: boolean;
};

export type RecapCardProps = {
  game: Game;
  results: QuarterResult[];
  /** MVP name override (defaults to the final/Q4 winner). */
  mvpName?: string | null;
  mvpAvatarUrl?: string | null;
};

const CARD_W = 1080;
const CARD_H = 1350;

export function RecapCard({ game, results, mvpName, mvpAvatarUrl }: RecapCardProps) {
  // Sort and pick a final/MVP entry.
  const sorted = [...results].sort((a, b) => a.quarter - b.quarter);
  const finalEntry = sorted.find((r) => r.is_final) ?? sorted[sorted.length - 1];
  const mvp = mvpName ?? finalEntry?.winner_name ?? null;

  // Always show 4 quarter slots so the layout reads as a complete game card,
  // even if some quarter snapshots are missing (e.g. a game ended early).
  const slots: (QuarterResult | null)[] = [1, 2, 3, 4].map(
    (q) => sorted.find((r) => r.quarter === q) ?? null,
  );

  return (
    <div
      className="relative overflow-hidden font-sans text-white"
      style={{
        width: CARD_W,
        height: CARD_H,
        background:
          "radial-gradient(ellipse at top left, #0b1f3a 0%, #050912 55%, #000 100%)",
      }}
    >
      {/* Neon grid backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(93,255,161,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(93,255,161,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 70%, transparent 100%)",
        }}
      />
      {/* Glow blobs */}
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(59,158,255,0.45) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -right-32 w-[640px] h-[640px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,179,90,0.4) 0%, transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-16 py-14">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-black text-black"
              style={{ background: "linear-gradient(135deg, #5dffa1, #3b9eff)" }}
            >
              CS
            </div>
            <div className="font-mono uppercase tracking-[0.4em] text-xs text-[#5dffa1]">
              Clutch Squares · Recap
            </div>
          </div>
          <div className="font-mono uppercase tracking-[0.3em] text-xs text-white/60">
            {game.sport}
          </div>
        </div>

        {/* Final score banner */}
        <div className="mt-12 text-center">
          <div className="font-mono uppercase tracking-[0.4em] text-[11px] text-white/60 mb-4">
            Final Score
          </div>
          <div className="flex items-center justify-center gap-10">
            <ScoreBlock team={game.away_team} score={game.away_score} color="#3b9eff" />
            <div className="text-6xl font-black text-white/30 tabular-nums">—</div>
            <ScoreBlock team={game.home_team} score={game.home_score} color="#5dffa1" />
          </div>
          <div className="mt-3 font-display text-2xl font-black tracking-wide text-white/80">
            {game.name}
          </div>
        </div>

        {/* Quarter winners grid */}
        <div className="mt-12 grid grid-cols-2 gap-5">
          {slots.map((slot, idx) => (
            <QuarterTile
              key={idx}
              quarter={idx + 1}
              entry={slot}
              awayTeam={game.away_team}
              homeTeam={game.home_team}
            />
          ))}
        </div>

        {/* MVP */}
        <div
          className="mt-auto rounded-3xl p-8 flex items-center gap-6 border-2"
          style={{
            borderColor: "#ffb35a",
            background:
              "linear-gradient(135deg, rgba(255,179,90,0.18), rgba(255,179,90,0.04))",
            boxShadow: "0 0 60px rgba(255,179,90,0.35)",
          }}
        >
          <PlayerAvatar name={mvp ?? "—"} src={mvpAvatarUrl ?? null} size="2xl" ring glow />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[#ffb35a] font-mono uppercase tracking-[0.4em] text-[11px]">
              <Crown className="w-4 h-4" /> MVP · Final Payout
            </div>
            <div className="font-display font-black text-5xl mt-2 truncate">
              {mvp ?? "Unclaimed"}
            </div>
            {game.entry_amount_label && (
              <div className="mt-2 font-mono text-base text-white/70">
                Pot · {game.entry_amount_label}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.3em] text-white/50">
          <span>clutchsquares.com</span>
          <span>{new Date(game.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ team, score, color }: { team: string; score: number; color: string }) {
  return (
    <div className="text-center">
      <div
        className="inline-block px-4 py-1.5 rounded-md font-mono font-black text-base mb-2"
        style={{
          color,
          background: `color-mix(in oklab, ${color} 22%, transparent)`,
          border: `1px solid ${color}`,
        }}
      >
        {team}
      </div>
      <div
        className="font-mono font-black text-8xl tabular-nums leading-none"
        style={{ color, textShadow: `0 0 30px ${color}` }}
      >
        {score}
      </div>
    </div>
  );
}

function QuarterTile({
  quarter,
  entry,
  awayTeam,
  homeTeam,
}: {
  quarter: number;
  entry: QuarterResult | null;
  awayTeam: string;
  homeTeam: string;
}) {
  const accent = entry?.is_final ? "#ffb35a" : "#5dffa1";
  return (
    <div
      className="rounded-2xl p-5 border-2 backdrop-blur-sm"
      style={{
        borderColor: entry ? `color-mix(in oklab, ${accent} 65%, transparent)` : "rgba(255,255,255,0.12)",
        background: entry
          ? `linear-gradient(135deg, color-mix(in oklab, ${accent} 14%, transparent), rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.03)",
        boxShadow: entry ? `0 0 40px color-mix(in oklab, ${accent} 25%, transparent)` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="font-mono uppercase tracking-[0.3em] text-[11px] font-bold"
          style={{ color: entry ? accent : "rgba(255,255,255,0.5)" }}
        >
          {entry?.is_final ? `Final · Q${quarter}` : `Quarter ${quarter}`}
        </div>
        {entry?.is_final && <Trophy className="w-4 h-4" style={{ color: accent }} />}
      </div>

      {entry ? (
        <>
          <div className="mt-3 font-display font-black text-3xl truncate" title={entry.winner_name ?? "Unclaimed"}>
            {entry.winner_name ?? <span className="text-white/40">Unclaimed</span>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <DigitChip digit={entry.away_digit} label={shortTeam(awayTeam)} color="#3b9eff" />
            <span className="font-mono font-black text-white/40 text-xl">×</span>
            <DigitChip digit={entry.home_digit} label={shortTeam(homeTeam)} color="#5dffa1" />
            <div className="ml-auto font-mono text-white/50 text-sm tabular-nums">
              {entry.away_score}–{entry.home_score}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 text-center font-mono uppercase tracking-[0.3em] text-xs text-white/40">
          Not played
        </div>
      )}
    </div>
  );
}

function DigitChip({ digit, label, color }: { digit: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center font-mono font-black text-2xl"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`,
          color,
          border: `2px solid ${color}`,
          boxShadow: `0 0 18px color-mix(in oklab, ${color} 45%, transparent)`,
        }}
      >
        {digit}
      </div>
      <div className="font-mono uppercase tracking-widest text-[9px] text-white/50 mt-1">
        {label}
      </div>
    </div>
  );
}

function shortTeam(name: string) {
  if (!name) return "—";
  return name.length <= 4 ? name.toUpperCase() : name.slice(0, 3).toUpperCase();
}

export const RECAP_CARD_SIZE = { width: CARD_W, height: CARD_H };
