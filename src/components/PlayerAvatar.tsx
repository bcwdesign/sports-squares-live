// Reusable player avatar with image + initials fallback.
// Used in lobby player list, chat, winner cards, and overlay.

import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const sizeMap: Record<Size, string> = {
  xs: "w-5 h-5 text-[8px]",
  sm: "w-7 h-7 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-2xl",
  "2xl": "w-28 h-28 text-3xl",
};

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PlayerAvatar({
  name,
  src,
  size = "md",
  className,
  ring,
  glow,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: Size;
  className?: string;
  ring?: boolean;
  glow?: boolean;
}) {
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center overflow-hidden font-display font-black text-background shrink-0",
        sizeMap[size],
        ring && "ring-2 ring-[color:var(--neon-orange)] ring-offset-2 ring-offset-background",
        className,
      )}
      style={{
        backgroundImage: src ? undefined : "var(--gradient-neon)",
        boxShadow: glow ? "var(--shadow-neon-orange)" : undefined,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `${name} avatar` : "Player avatar"}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
