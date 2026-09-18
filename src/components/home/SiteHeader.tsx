import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

type NavItem =
  | { label: string; kind: "anchor"; href: string }
  | { label: string; kind: "route"; to: "/companies" | "/groups" };

const NAV: NavItem[] = [
  { label: "How It Works", kind: "anchor", href: "/#how-it-works" },
  { label: "For Companies", kind: "route", to: "/companies" },
  { label: "For Groups", kind: "route", to: "/groups" },
  { label: "FAQ", kind: "anchor", href: "/#faq" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "bg-background/90 backdrop-blur-xl border-b border-border"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 h-16 sm:h-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Link to="/" className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--neon-blue)]">
          <Wordmark withTagline />
        </Link>

        <nav className="hidden lg:flex items-center gap-8" aria-label="Main">
          {NAV.map((item) =>
            item.kind === "route" ? (
              <Link
                key={item.label}
                to={item.to}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ),
          )}
          <Link
            to="/auth"
            className="rounded-lg border border-[color:var(--neon-blue)]/60 px-4 py-2 text-sm font-semibold text-[color:var(--neon-blue)] hover:bg-[color:var(--neon-blue)]/10 transition-colors"
          >
            Login
          </Link>
          <Link
            to="/auth"
            className="rounded-lg bg-[color:var(--neon-green)] px-5 py-2.5 text-sm font-bold text-background hover:brightness-110 transition"
          >
            Join a Game
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="lg:hidden p-2 -mr-2 rounded-md text-foreground"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl">
          <nav className="px-4 py-4 flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) =>
              item.kind === "route" ? (
                <Link key={item.label} to={item.to} onClick={() => setOpen(false)} className="py-3 text-base text-foreground">
                  {item.label}
                </Link>
              ) : (
                <a key={item.label} href={item.href} onClick={() => setOpen(false)} className="py-3 text-base text-foreground">
                  {item.label}
                </a>
              ),
            )}
            <div className="flex gap-3 pt-3">
              <Link to="/auth" className="flex-1 text-center rounded-lg border border-[color:var(--neon-blue)]/60 px-4 py-3 text-sm font-semibold text-[color:var(--neon-blue)]">
                Login
              </Link>
              <Link to="/auth" className="flex-1 text-center rounded-lg bg-[color:var(--neon-green)] px-4 py-3 text-sm font-bold text-background">
                Join a Game
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
