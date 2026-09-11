// Game-level branding: types, defaults, colour maths and CSS-variable mapping.
//
// Hosts choose only three core colours (primary / secondary / background) plus
// two optional square colours. Everything else — surfaces, borders, text,
// glows — is derived here so a poor choice can never make text unreadable.

export type SquareStyle = "tinted" | "outline" | "neutral";

export type GameBranding = {
  enabled: boolean;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  claimedSquareColor: string | null;
  winningSquareColor: string | null;
  squareStyle: SquareStyle;
};

/** Clutch Squares house colours, expressed in hex for the branding editor. */
export const DEFAULT_BRANDING: GameBranding = {
  enabled: false,
  companyName: "",
  logoUrl: null,
  primaryColor: "#3B9EFF",
  secondaryColor: "#5DFFA1",
  backgroundColor: "#101218",
  claimedSquareColor: null,
  winningSquareColor: "#FFB35A",
  squareStyle: "tinted",
};

export const SQUARE_STYLE_LABELS: Record<SquareStyle, string> = {
  tinted: "Brand Tinted",
  outline: "Brand Outline",
  neutral: "Dark Neutral",
};

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

type RGB = { r: number; g: number; b: number };

export function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHex(value: string, fallback: string): string {
  const v = value.trim();
  if (!isValidHex(v)) return fallback;
  const hex = v.slice(1);
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
  }
  return `#${hex.toUpperCase()}`;
}

function toRgb(hex: string): RGB {
  const h = normalizeHex(hex, "#000000").slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.45;
}

/** Contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Readable foreground (near-black or near-white) for any background colour. */
export function readableOn(background: string): string {
  return isLight(background) ? "#0B0D12" : "#FFFFFF";
}

/** Blend `amount` (0–1) of `b` into `a`. */
export function mix(a: string, b: string, amount: number): string {
  const A = toRgb(a);
  const B = toRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return toHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, "#FFFFFF", amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Nudge a colour until it reads clearly against `bg`. Keeps the hue, moves
 * lightness. Used so brand colours stay visible on the dark board.
 */
export function ensureContrast(color: string, bg: string, target = 3.2): string {
  let out = color;
  const goLighter = !isLight(bg);
  for (let i = 0; i < 12 && contrastRatio(out, bg) < target; i++) {
    out = goLighter ? lighten(out, 0.08) : darken(out, 0.08);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Reading branding off a game record                                  */
/* ------------------------------------------------------------------ */

type BrandingRow = {
  branding_enabled?: boolean | null;
  branding_company_name?: string | null;
  branding_logo_url?: string | null;
  branding_primary?: string | null;
  branding_secondary?: string | null;
  branding_background?: string | null;
  branding_claimed_color?: string | null;
  branding_winning_color?: string | null;
  branding_square_style?: string | null;
};

export function brandingFromGame(game: unknown): GameBranding {
  const g = (game ?? {}) as BrandingRow;
  const style = (g.branding_square_style ?? "tinted") as SquareStyle;
  return {
    enabled: !!g.branding_enabled,
    companyName: g.branding_company_name ?? "",
    logoUrl: g.branding_logo_url ?? null,
    primaryColor: normalizeHex(g.branding_primary ?? "", DEFAULT_BRANDING.primaryColor),
    secondaryColor: normalizeHex(g.branding_secondary ?? "", DEFAULT_BRANDING.secondaryColor),
    backgroundColor: normalizeHex(g.branding_background ?? "", DEFAULT_BRANDING.backgroundColor),
    claimedSquareColor: g.branding_claimed_color
      ? normalizeHex(g.branding_claimed_color, DEFAULT_BRANDING.primaryColor)
      : null,
    winningSquareColor: g.branding_winning_color
      ? normalizeHex(g.branding_winning_color, DEFAULT_BRANDING.winningSquareColor!)
      : null,
    squareStyle: (["tinted", "outline", "neutral"] as const).includes(style) ? style : "tinted",
  };
}

/** Column payload for writing branding back onto a game row. */
export function brandingToGameColumns(b: GameBranding) {
  return {
    branding_enabled: b.enabled,
    branding_company_name: b.companyName.trim() || null,
    branding_logo_url: b.logoUrl,
    branding_primary: b.primaryColor,
    branding_secondary: b.secondaryColor,
    branding_background: b.backgroundColor,
    branding_claimed_color: b.claimedSquareColor,
    branding_winning_color: b.winningSquareColor,
    branding_square_style: b.squareStyle,
  };
}

/* ------------------------------------------------------------------ */
/* Derived theme                                                       */
/* ------------------------------------------------------------------ */

export type DerivedTheme = {
  primary: string;
  secondary: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  square: string;
  squareBorder: string;
  squareClaimed: string;
  squareClaimedText: string;
  squareWinning: string;
  squareWinningText: string;
  text: string;
  textMuted: string;
  accent: string;
  glow: string;
};

export function deriveTheme(b: GameBranding): DerivedTheme {
  const background = b.backgroundColor;
  const dark = !isLight(background);
  const step = (amount: number) => (dark ? lighten(background, amount) : darken(background, amount));

  const surface = step(0.07);
  const surfaceElevated = step(0.13);
  const text = readableOn(background);
  const textMuted = mix(text, background, 0.42);

  const primary = ensureContrast(b.primaryColor, background);
  const secondary = ensureContrast(b.secondaryColor, background);
  const claimed = ensureContrast(b.claimedSquareColor ?? b.primaryColor, background);

  // The winning colour must stay obviously different from the claimed colour.
  let winning = ensureContrast(b.winningSquareColor ?? DEFAULT_BRANDING.winningSquareColor!, background);
  if (contrastRatio(winning, claimed) < 1.35) {
    const alt = DEFAULT_BRANDING.winningSquareColor!;
    winning =
      contrastRatio(alt, claimed) >= 1.35 ? alt : ensureContrast(lighten(claimed, 0.45), background, 4);
  }

  let square: string;
  let squareBorder: string;
  if (b.squareStyle === "tinted") {
    square = mix(surface, primary, 0.14);
    squareBorder = mix(surface, primary, 0.3);
  } else if (b.squareStyle === "outline") {
    square = mix(surface, background, 0.4);
    squareBorder = mix(surface, primary, 0.6);
  } else {
    square = mix(surface, background, 0.4);
    squareBorder = step(0.16);
  }

  return {
    primary,
    secondary,
    background,
    backgroundSecondary: step(0.04),
    surface,
    surfaceElevated,
    border: step(0.18),
    square,
    squareBorder,
    squareClaimed: claimed,
    squareClaimedText: readableOn(mix(square, claimed, 0.35)),
    squareWinning: winning,
    squareWinningText: readableOn(winning),
    text,
    textMuted,
    accent: secondary,
    glow: withAlpha(primary, 0.22),
  };
}

/**
 * CSS custom properties for a branded game. Exposes the `--game-*` design
 * tokens and remaps the shared Clutch Squares tokens onto them, so every
 * board component adapts without hard-coding a customer's colours.
 */
export function themeVars(b: GameBranding): React.CSSProperties {
  if (!b.enabled) return {};
  const t = deriveTheme(b);

  return {
    // Game design tokens
    "--game-primary": t.primary,
    "--game-secondary": t.secondary,
    "--game-background": t.background,
    "--game-background-secondary": t.backgroundSecondary,
    "--game-surface": t.surface,
    "--game-surface-elevated": t.surfaceElevated,
    "--game-square": t.square,
    "--game-square-border": t.squareBorder,
    "--game-square-claimed": t.squareClaimed,
    "--game-square-claimed-text": t.squareClaimedText,
    "--game-square-winning": t.squareWinning,
    "--game-square-winning-text": t.squareWinningText,
    "--game-text": t.text,
    "--game-text-muted": t.textMuted,
    "--game-accent": t.accent,
    "--game-glow": t.glow,

    // Shared Clutch Squares tokens remapped onto the branded palette
    "--background": t.background,
    "--foreground": t.text,
    "--surface": t.surface,
    "--surface-elevated": t.surfaceElevated,
    "--card": t.surface,
    "--card-foreground": t.text,
    "--popover": t.surface,
    "--popover-foreground": t.text,
    "--muted": t.square,
    "--muted-foreground": t.textMuted,
    "--border": t.border,
    "--input": t.surfaceElevated,
    "--secondary": t.surfaceElevated,
    "--secondary-foreground": t.text,
    "--ring": t.primary,
    "--neon-blue": t.squareClaimed,
    "--neon-green": t.secondary,
    "--neon-orange": t.squareWinning,
    "--gradient-neon": `linear-gradient(90deg, ${t.squareClaimed}, ${t.secondary})`,
    "--shadow-neon-blue": `0 0 24px ${withAlpha(t.squareClaimed, 0.5)}, 0 0 60px ${withAlpha(t.squareClaimed, 0.25)}`,
    "--shadow-neon-green": `0 0 24px ${withAlpha(t.secondary, 0.5)}, 0 0 60px ${withAlpha(t.secondary, 0.25)}`,
    "--shadow-neon-orange": `0 0 24px ${withAlpha(t.squareWinning, 0.55)}, 0 0 60px ${withAlpha(t.squareWinning, 0.3)}`,
  } as React.CSSProperties;
}

/** Atmospheric background layer for a branded (or default) game surface. */
export function backgroundLayer(b: GameBranding): string {
  if (!b.enabled) {
    return "radial-gradient(circle at 12% 0%, oklch(0.72 0.22 240 / 0.18), transparent 50%), radial-gradient(circle at 88% 100%, oklch(0.82 0.24 145 / 0.16), transparent 50%)";
  }
  const t = deriveTheme(b);
  return [
    `radial-gradient(circle at 12% 0%, ${withAlpha(t.primary, 0.2)}, transparent 52%)`,
    `radial-gradient(circle at 88% 100%, ${withAlpha(t.secondary, 0.16)}, transparent 52%)`,
    `linear-gradient(160deg, ${withAlpha(t.surfaceElevated, 0.5)}, transparent 60%)`,
  ].join(", ");
}
