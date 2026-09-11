// Live preview of how a branded game board will look. Renders from local
// editor state, so it updates instantly without saving.

import { deriveTheme, themeVars, backgroundLayer, type GameBranding } from "@/lib/branding";

export function BrandingPreview({ branding }: { branding: GameBranding }) {
  const t = deriveTheme(branding);
  const enabled = branding.enabled;

  return (
    <div
      style={enabled ? themeVars(branding) : undefined}
      className="rounded-2xl overflow-hidden border border-border"
    >
      <div
        className="relative p-4 space-y-4"
        style={{
          backgroundColor: enabled ? t.background : "var(--background)",
          backgroundImage: backgroundLayer(branding),
        }}
      >
        {/* Header lockup */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {enabled && branding.logoUrl ? (
              <BrandLogo branding={branding} className="h-6 w-auto max-w-[96px] object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[image:var(--gradient-neon)] flex items-center justify-center font-mono font-black text-[10px] text-background shrink-0">
                CS
              </div>
            )}
            <div className="min-w-0">
              <div className="font-display font-black text-sm leading-none truncate">
                <span style={{ color: "var(--neon-blue)" }}>CLUTCH</span>{" "}
                <span style={{ color: "var(--neon-green)" }}>SQUARES</span>
              </div>
              <div
                className="font-mono text-[8px] uppercase tracking-[0.25em] mt-1 truncate"
                style={{ color: "var(--muted-foreground)" }}
              >
                {enabled && branding.companyName.trim()
                  ? `Presented by ${branding.companyName.trim()}`
                  : "Live Watch Party"}
              </div>
            </div>
          </div>

          {/* Sample scoreboard accent */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="px-2 py-0.5 rounded-md font-display font-black text-[10px]"
              style={{
                backgroundColor: `color-mix(in oklab, var(--neon-blue) 18%, transparent)`,
                color: "var(--neon-blue)",
                border: "1px solid color-mix(in oklab, var(--neon-blue) 40%, transparent)",
              }}
            >
              DAL
            </span>
            <span className="font-mono font-black text-base tabular-nums" style={{ color: "var(--neon-blue)" }}>
              21
            </span>
            <span className="font-mono text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              Q2
            </span>
            <span className="font-mono font-black text-base tabular-nums" style={{ color: "var(--neon-green)" }}>
              17
            </span>
            <span
              className="px-2 py-0.5 rounded-md font-display font-black text-[10px]"
              style={{
                backgroundColor: `color-mix(in oklab, var(--neon-green) 18%, transparent)`,
                color: "var(--neon-green)",
                border: "1px solid color-mix(in oklab, var(--neon-green) 40%, transparent)",
              }}
            >
              PHI
            </span>
          </div>
        </div>

        {/* Sample board */}
        <div
          className="rounded-xl p-3"
          style={{
            backgroundColor: `color-mix(in oklab, var(--surface) 80%, transparent)`,
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex">
            <div className="w-4" />
            <div className="flex-1 grid grid-cols-5 gap-1">
              {[3, 7, 0, 4, 9].map((d) => (
                <div
                  key={d}
                  className="text-center font-mono font-black text-[10px]"
                  style={{ color: "var(--neon-green)" }}
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-stretch mt-1">
            <div className="w-4 grid grid-rows-2 gap-1 mr-1">
              {[2, 6].map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-center font-mono font-black text-[10px]"
                  style={{ color: "var(--neon-blue)" }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-5 grid-rows-2 gap-1">
              {Array.from({ length: 10 }).map((_, i) => {
                const claimed = i === 2 || i === 6 || i === 8;
                const winning = i === 4;
                return (
                  <PreviewSquare key={i} index={i} claimed={claimed} winning={winning} branding={branding} />
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 font-mono text-[8px] uppercase tracking-widest">
            <Legend color="var(--neon-blue)" label="Claimed" />
            <Legend color="var(--neon-orange)" label="Winning" />
            <span style={{ color: "var(--muted-foreground)" }}>Unclaimed stays dark</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSquare({
  index,
  claimed,
  winning,
  branding,
}: {
  index: number;
  claimed: boolean;
  winning: boolean;
  branding: GameBranding;
}) {
  const t = deriveTheme(branding);
  const on = branding.enabled;

  if (winning) {
    return (
      <div
        className="aspect-square rounded flex items-center justify-center font-mono font-bold text-[8px]"
        style={{
          backgroundColor: "var(--neon-orange)",
          border: "1px solid var(--neon-orange)",
          color: on ? t.squareWinningText : "var(--background)",
        }}
      >
        RILEY
      </div>
    );
  }
  if (claimed) {
    return (
      <div
        className="aspect-square rounded flex items-center justify-center font-mono font-bold text-[8px]"
        style={{
          backgroundColor: `color-mix(in oklab, var(--neon-blue) 22%, transparent)`,
          border: "1px solid color-mix(in oklab, var(--neon-blue) 55%, transparent)",
          color: "var(--neon-blue)",
        }}
      >
        JOE
      </div>
    );
  }
  return (
    <div
      className="aspect-square rounded flex items-center justify-center font-mono text-[8px]"
      style={{
        backgroundColor: on ? t.square : "color-mix(in oklab, var(--muted) 40%, transparent)",
        border: `1px solid ${on ? t.squareBorder : "var(--border)"}`,
        color: "var(--muted-foreground)",
        opacity: 0.85,
      }}
    >
      {index + 1}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </span>
  );
}
