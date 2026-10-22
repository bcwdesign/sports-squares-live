# Sport filter on the Dashboard

## What changes
- A row of three buttons near the top of the Dashboard: All, NBA, NFL. All is selected when the page opens.
- Picking a sport shows only that sport's games in both the active games and the Past Games lists, with counts to match.
- Changing the filter starts Past Games over at the first 10.
- If a sport has no games, the page says so.

## Technical details
- `src/routes/_app.dashboard.tsx`: add a `sportFilter` state (`"ALL" | "NBA" | "NFL"`). Filter `games` by `sport` before splitting them into active and past, treating a missing sport as NBA. Reset `visiblePast` to 10 when the filter changes.
- Use pill buttons in the existing style, with `aria-pressed`.
- Display only. No backend changes.
