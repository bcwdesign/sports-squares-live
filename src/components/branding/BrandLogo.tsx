// Renders a customer logo safely on the branded surface. Most company logos
// are dark marks made for white paper, so on a dark board they are placed on a
// light plate; light marks are shown bare.

import { isLight, type GameBranding } from "@/lib/branding";

export function BrandLogo({
  branding,
  className,
}: {
  branding: GameBranding;
  className?: string;
}) {
  if (!branding.logoUrl) return null;
  const darkSurface = !isLight(branding.backgroundColor);

  return (
    <span
      className={
        darkSurface
          ? "inline-flex items-center rounded-lg bg-white/92 px-2 py-1 shrink-0"
          : "inline-flex items-center shrink-0"
      }
    >
      <img
        src={branding.logoUrl}
        alt={branding.companyName ? `${branding.companyName} logo` : "Company logo"}
        className={className}
      />
    </span>
  );
}
