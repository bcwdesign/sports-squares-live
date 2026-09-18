import { Link } from "@tanstack/react-router";
import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-12 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <Link to="/" className="inline-block">
          <Wordmark withTagline />
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground" aria-label="Footer">
          <a href="/#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
          <Link to="/companies" className="hover:text-foreground transition-colors">For Companies</Link>
          <Link to="/groups" className="hover:text-foreground transition-colors">For Groups</Link>
          <a href="/#faq" className="hover:text-foreground transition-colors">FAQ</a>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-5 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Clutch Squares. Play together. Every game counts.
        </div>
      </div>
    </footer>
  );
}
