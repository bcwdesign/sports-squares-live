import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "blue" | "green" | "orange" | "ghost";

export function NeonButton({
  variant = "blue",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  const styles: Record<Variant, string> = {
    blue: "bg-[color:var(--neon-blue)] text-background shadow-[var(--shadow-neon-blue)] hover:brightness-110",
    green: "bg-[color:var(--neon-green)] text-background shadow-[var(--shadow-neon-green)] hover:brightness-110",
    orange: "bg-[color:var(--neon-orange)] text-background shadow-[var(--shadow-neon-orange)] hover:brightness-110",
    ghost: "bg-transparent border border-border text-foreground hover:border-[color:var(--neon-blue)] hover:text-[color:var(--neon-blue)]",
  };

  return (
    <button
      {...props}
      className={cn(
        "px-5 py-3 rounded-xl font-display font-bold tracking-wide text-sm uppercase transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
