// Applies a game's branding as scoped CSS variables. Children read the
// `--game-*` tokens (and the remapped Clutch Squares tokens) — no component
// ever hard-codes a customer's colours.

import { useMemo } from "react";
import { brandingFromGame, themeVars, type GameBranding } from "@/lib/branding";

export function GameThemeProvider({
  branding,
  game,
  className,
  children,
}: {
  /** Explicit branding (live preview / editor). */
  branding?: GameBranding;
  /** Or a game row to read branding columns from. */
  game?: unknown;
  className?: string;
  children: React.ReactNode;
}) {
  const resolved = useMemo(
    () => branding ?? brandingFromGame(game),
    [branding, game],
  );
  const style = useMemo(() => themeVars(resolved), [resolved]);

  return (
    <div className={className ?? "contents"} style={style}>
      {children}
    </div>
  );
}
