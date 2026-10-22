# Show 10 past games at a time on the Dashboard

## What changes
- The Past Games section shows the 10 most recent finished games first.
- A "Show more" button under the list adds the next 10 each time you click it. The button goes away once every game is showing.
- The count next to the "Past Games" title still shows your total number of past games.
- Live and upcoming games stay as they are.

## Technical details
- `src/routes/_app.dashboard.tsx`: add a `visiblePast` state that starts at 10. Render `past.slice(0, visiblePast)`, and have a "Show more" button add 10 to it. Past games sort by game date, newest first.
- The page already loads every game in one request, so this only changes how many show on screen. No backend or database changes.
