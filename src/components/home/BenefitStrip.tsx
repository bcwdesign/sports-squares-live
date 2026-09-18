import { Users, MonitorPlay, Lock, Trophy } from "lucide-react";
import type { ReactNode } from "react";

const ITEMS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <Users className="w-6 h-6" />, title: "Easy for Everyone", desc: "Simple 10×10 format anyone can understand." },
  { icon: <MonitorPlay className="w-6 h-6" />, title: "Live Score Updates", desc: "Follow the game and see results in real time." },
  { icon: <Lock className="w-6 h-6" />, title: "Private & Secure", desc: "Create invite-only games for your organization or group." },
  { icon: <Trophy className="w-6 h-6" />, title: "Football + Basketball", desc: "Built around the biggest game-day moments." },
];

export function BenefitStrip() {
  return (
    <section className="border-y border-border bg-[color:var(--surface)]/60">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex items-start gap-3 lg:px-6 first:lg:pl-0 last:lg:pr-0">
            <span className="shrink-0 text-[color:var(--neon-blue)]">{item.icon}</span>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-snug mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
