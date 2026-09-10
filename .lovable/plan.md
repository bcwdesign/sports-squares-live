# One square per player option

Yes — the host already sets a "Max squares per player" limit when creating a game, but the choices are only 5, 10, 15, 20 and 25. There's no way to pick 1.

## What changes

On the New Game screen, add smaller options so a host can limit each player to a single square:

- Choices become: 1, 2, 3, 5, 10, 15, 20, 25
- Selecting 1 means each player can claim exactly one square

No other behaviour changes. The limit is already enforced everywhere:

- The lobby blocks a claim past the limit and shows "Max N squares per player"
- The lobby counter shows "Yours: 1/1"
- The database rule that guards square claiming already reads the game's limit, so nobody can bypass it by other means

## Technical notes

- `src/routes/_app.create.tsx`: extend the `[5, 10, 15, 20, 25]` button list and adjust the grid columns so the extra buttons wrap cleanly on mobile.
- No migration needed — `games.max_squares_per_user` is an integer and `private.can_claim_square` compares the player's current count against it.
- Wording in the lobby toast already pluralises awkwardly for 1 ("Max 1 squares"); fix it to read "Max 1 square per player".
