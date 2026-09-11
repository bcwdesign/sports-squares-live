# Custom Game Branding (Enterprise Theming)

Let hosts brand an individual game — logo, company name, colors, square style — with a live preview, reusable Brand Kits, and automatic contrast protection. Clutch Squares branding always stays visible.

## Where hosts control it

- **New Game screen**: a new "Game Branding" section, styled like the existing Prize Mode / AI Commentator sections (toggle + collapsible controls).
- **Live game screen (host only)**: the same branding panel, so branding can be changed after a game exists and saved without recreating the game.

Controls: enable toggle, company/sponsor name, logo upload (PNG/JPG/WebP, max 5 MB, preview, replace, remove), primary / secondary / background colors (swatch picker + HEX field), optional claimed-square and winning-square colors, and square style (Brand Tinted / Brand Outline / Dark Neutral, default Tinted).

SVG uploads will be excluded — SVG can carry scripts and our logo files are served from a public bucket. PNG with transparency is recommended in the helper text.

## Live preview

A miniature board rendered next to the controls: branded background, logo, company name + Clutch Squares lockup, row/column digits, one unclaimed, one claimed and one winning square, plus a sample scoreboard strip. It re-renders instantly from local state — no save required.

## Theme system

One `GameThemeProvider` computes a set of CSS variables (`--game-primary`, `--game-background`, `--game-square`, `--game-square-claimed`, `--game-square-winning`, `--game-text`, `--game-glow`, etc.) from the branding record and applies them to a wrapper element. Components read the variables; no customer colors are hard-coded anywhere.

When branding is off or missing, the variables resolve to today's Clutch Squares neon values, so every existing game looks exactly as it does now.

Branded surfaces: page background (dark base + brand-tinted gradients and glow, never a flat company color), the squares grid, row/column digits, scoreboard accents (team scores keep their own readability), commentator panel borders, winner panel accents, and the join/QR area (QR stays high-contrast black-on-white).

## Contrast protection

Utility functions compute relative luminance, pick a readable foreground (light or dark) for any brand color, and derive lighter/darker shades plus low-alpha tints. Used for square text, usernames, digits, buttons, labels, scoreboard text and the winning square, so a poorly chosen brand color can never make text unreadable. The host only picks three core colors; the rest is derived.

## Header / logo placement

Default: `CLUTCH SQUARES / LIVE WATCH PARTY` as today. Branded: `[company logo] CLUTCH SQUARES` with `Presented by <Company>` beneath. Logo is height-capped and aspect-preserved, scaling down on tablet/mobile; long company names truncate rather than wrap the header.

## Data model

Branding lives on the **game record** (snapshot), so kits can later be edited or deleted without changing historical games:

- New nullable columns on `games`: `branding_enabled` (default false), `branding_company_name`, `branding_logo_url`, `branding_primary`, `branding_secondary`, `branding_background`, `branding_claimed_color`, `branding_winning_color`, `branding_square_style` (default `tinted`). All defaults keep existing games identical.
- New `brand_kits` table: `id`, `owner_user_id`, `name`, the same branding fields, `created_at`. RLS: owners manage their own kits; super admins may read. Grants for `authenticated` / `service_role`.
- New public storage bucket `brand-logos` with a 5 MB limit; upload path scoped to the uploader's user id, RLS allowing owners to write/delete and anyone to read (overlay pages are public).

Brand Kit UI: dropdown (Default Clutch Squares / saved kits / Create New), with Save as Brand Kit, Update, Delete. Selecting a kit copies its values into the game's branding fields.

## Reset

"Reset to Clutch Squares Branding" with a confirmation dialog: disables branding and clears the game's branding values. Saved Brand Kits are untouched.

## Out of scope (intentionally)

Fonts, layout, component positioning, scoreboard/commentator architecture, QR layout and core interactions stay fixed. This is controlled theming, not a page builder.

## Technical notes

- Migration: additive `ALTER TABLE games ADD COLUMN ... DEFAULT`, plus `brand_kits` with GRANTs and RLS; no destructive changes.
- New files: `src/lib/branding.ts` (types, defaults, color/contrast utilities), `src/components/branding/GameThemeProvider.tsx`, `BrandingSection.tsx` (controls + kit management), `BrandingPreview.tsx`, `LogoUploader.tsx`, `src/lib/brandKits.functions.ts` (authenticated CRUD server functions).
- Edited: `_app.create.tsx`, `_app.game.$gameId.live.tsx`, `_app.game.$gameId.lobby.tsx`, `components/Overlay.tsx`, `overlay.$token.tsx`, `SquaresGrid.tsx`, `TopBar.tsx`, `CommentatorCard.tsx`, `WinnerCelebration.tsx`, plus `overlay.functions.ts` to return branding fields.
- Verification: typecheck, then a browser pass at desktop/tablet/mobile widths on a branded game (board, overlay, winner state) and an unbranded game to confirm no visual change.
- A sample "Continental" brand kit will be created with placeholder colors (orange primary, dark base); real colors and logo are entered by the host, no code change needed.
