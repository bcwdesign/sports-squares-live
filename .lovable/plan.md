# Show NBA games on the New Game screen

## What's happening now
- On New Game, only NFL shows a game list. When NBA is picked, the screen shows just the "Away team" and "Home team" boxes. The NBA score service is not called from this screen at all.
- The NBA list exists only on the host's live board ("Connect NBA Live Score"), and it only shows games being played right now.

## What will change
- Picking NBA on New Game shows an NBA game list, the same way NFL does: games for today and the next 14 days.
- Picking a game fills in the team names and links the live score feed when the game is created. You won't need to connect it again from the live board.
- Typing team names by hand still works if you don't pick a game.
- The "Connect NBA Live Score" button on the live board keeps working as it does now.

## Technical details
- `balldontlie.server.ts`: add `fetchUpcomingNbaSchedule(daysAhead)`, which calls `GET /v1/games?dates[]=...&per_page=100` with cursor paging (max 5 pages). Add an NBA schedule normalizer to `balldontlie.normalize.ts` (`home_team`/`visitor_team`, `status`, `datetime`).
- `balldontlie.functions.ts`: add `fetchUpcomingNbaGames`, using the same auth and input as the NFL function.
- Change `NflGamePicker` into a general `GamePicker` with a `sport` prop that calls the right function. The NFL picker keeps working the same way.
- `_app.create.tsx`: show the picker for both sports. The current NFL save path, which stores the provider mapping, also covers NBA.
- NBA score updates: `runSync` currently matches NBA games only against the live box-score feed, so it keeps working once the game starts. No database changes.
