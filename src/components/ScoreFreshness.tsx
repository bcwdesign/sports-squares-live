// Small "updated Xs ago" marker so viewers can tell the board is alive even
// when the score has not changed. Purely presentational.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function ago(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function ScoreFreshness({
  lastSyncAt,
  className,
}: {
  lastSyncAt?: string | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!lastSyncAt) return null;

  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap",
        className,
      )}
      title="Time since the live score feed last reported"
    >
      Updated {ago(lastSyncAt, now)}
    </span>
  );
}
