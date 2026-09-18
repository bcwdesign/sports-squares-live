export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid grid-cols-2 gap-[3px] shrink-0" aria-hidden>
        <span className="w-[9px] h-[9px] rounded-[2px] bg-[color:var(--neon-blue)]" />
        <span className="w-[9px] h-[9px] rounded-[2px] bg-[color:var(--neon-blue)]" />
        <span className="w-[9px] h-[9px] rounded-[2px] bg-transparent" />
        <span className="w-[9px] h-[9px] rounded-[2px] bg-[color:var(--neon-green)]" />
      </span>
      <span className="leading-none">
        <span className="block font-display font-bold tracking-tight text-base sm:text-lg">
          <span className="text-foreground">CLUTCH</span>{" "}
          <span className="text-[color:var(--neon-green)]">SQUARES</span>
        </span>
        {withTagline && (
          <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
            Play together. Every game counts.
          </span>
        )}
      </span>
    </span>
  );
}
