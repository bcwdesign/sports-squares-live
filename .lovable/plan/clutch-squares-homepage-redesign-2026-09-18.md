# Clutch Squares Homepage Redesign

A full visual rebuild of the public homepage only. Nothing in sign-in, game creation, joining, invite codes, scoring, or the database is touched.

## What the new homepage contains

1. **Header** — logo left; How It Works, For Companies, For Groups, FAQ; Login link; green "Join a Game" button. Transparent over the hero, becomes a solid dark sticky bar on scroll. Hamburger sheet on mobile.
2. **Hero** — stadium photo background with dark gradient overlay. Left (48%): eyebrow "Live sports. Big moments. Your square.", the three-line headline with "shared experience." in Clutch green, supporting copy, Join a Game / Create a Game buttons, and the "No spreadsheets…" microcopy. Right (52%): the YouTube video in a rounded card with a blue border and soft glow, autoplaying muted with controls available, privacy-enhanced embed, no loop. On mobile the order is headline, copy, buttons, video.
3. **Benefit strip** — four icon items (Easy for Everyone, Live Score Updates, Private & Secure, Football + Basketball) with thin dividers on desktop, stacked on mobile.
4. **How Clutch Squares Works** — three numbered steps, each illustrated with the real product board rather than a mock screenshot.
5. **See How It Works** — the educational panel: two fictional teams (River City Hawks 27, Metro Knights 24), the real 10×10 board with the 7,4 square highlighted and pulsing, plus the "Winning square 7,4 — last digits 7 – 4" callout.
6. **Make game day a team experience** — the corporate watch-party photo paired with the headline, copy, six benefit chips, and a "Clutch Squares for Companies" button linking to a new `/companies` page.
7. **Built for Every Group** — three image cards (Companies & Teams, Groups & Events, Friends & Family) with hover zoom; the corporate card gets the largest visual weight.
8. **Product experience** — a compact strip showing the real interface: invite-code entry, the board with a selected square, score and highlighted winner. Minimal copy.
9. **FAQ** — accessible accordion with the eight questions; answers describe the product as it actually works, with no legal claims.
10. **Final CTA** — wide stadium photo, dark gradient, "Ready to play together?" with the highlight in green, and both buttons.
11. **Footer** — logo, "Play together. Every game counts.", nav links, Terms and Privacy. No social icons (no verified accounts). Contact links to a mailto only if you give me an address — otherwise I leave it out.

No statistics, testimonials, customer logos, or gambling language anywhere on the page.

## New pages

`/companies`, `/groups`, and a simple `/contact`-free footer. `/companies` and `/groups` are lightweight static marketing pages in the same style so the links and card CTAs never dead-end. `/terms` and `/privacy` get placeholder pages with a short note that content is pending — tell me if you'd rather I omit those links until you have copy.

## Technical notes

- New components under `src/components/home/`: `SiteHeader`, `Hero`, `BenefitStrip`, `HowItWorks`, `ExplainSquares`, `CorporateSection`, `AudienceCards`, `ProductShowcase`, `FaqSection`, `FinalCta`, `SiteFooter`. `src/routes/index.tsx` composes them and keeps its existing redirect-to-dashboard behaviour for signed-in users.
- The five uploaded photos are uploaded through `lovable-assets` and referenced by their CDN pointers; below-the-fold images get `loading="lazy"` plus explicit aspect ratios to avoid layout shift.
- The board demos reuse the real `SquaresGrid` component with locally constructed demo data — no new queries, no backend calls.
- FAQ uses the existing shadcn `accordion`. Buttons reuse `NeonButton`.
- Scroll reveal is a small IntersectionObserver hook with CSS transitions — no animation library. All motion is disabled under `prefers-reduced-motion`.
- Homepage `head()` gets the new title and description; one `h1`, semantic `h2`/`h3` below it.
- New design tokens (section surfaces, glow shadows, heading scale) are added to `src/styles.css` alongside the existing neon variables; existing tokens are not changed, so in-game screens keep their look.
- No migrations, no server functions, no auth or API changes.
