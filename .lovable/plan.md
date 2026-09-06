# Make "Continue with Google" work

Two things are needed: the Google sign-in method has to be switched on for the app's backend, and the sign-in code needs one small correction.

## What's wrong today

1. Google sign-in is not enabled as a login method yet, so the first click fails with an "unsupported provider" style error.
2. After Google finishes, the app sends people straight to `/dashboard`, which is a protected page. On a full-page return the login session isn't ready yet, so the guard can bounce the user back to the sign-in screen.

## The fix

1. Enable Google as a managed sign-in method (no Google Cloud account or keys needed from you — Lovable's managed credentials are used).
2. In the sign-in code, send people back to the site's home address after Google, then forward them to the dashboard (or wherever they were headed) once the session is confirmed.
3. Keep email/password and guest sign-in exactly as they are.

## Technical details

- Call `supabase--configure_social_auth` with `providers: ["google"]` in the same change (do not disable email).
- `src/contexts/AuthContext.tsx`: change `signInWithGoogle` `redirect_uri` from `${window.location.origin}/dashboard` to `window.location.origin`.
- `src/routes/auth.tsx`: store the intended same-origin path (existing `search.redirect`) in `sessionStorage` before starting Google; the existing `useEffect` that navigates once `user` is set then reads it and routes there, defaulting to `/dashboard`.
- No database or schema changes.

## Verify

Load the sign-in page, click "Continue with Google", complete consent, and confirm the app lands on the dashboard with the account signed in.
