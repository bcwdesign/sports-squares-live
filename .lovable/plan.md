# Moving Clutch Squares from Lovable Cloud to Firebase

## Where the data lives today
Everything is in Lovable Cloud, the backend built into this project: a relational database (games, squares, players, entries, results, profiles, roles, brand kits, audit logs), sign-in (email/password, Google, guests), file storage (brand logos), live updates (boards refresh instantly), and the every-minute background job that pulls scores, runs the NFL draw, and requests final recap videos.

## Recommendation
Stay on Lovable Cloud unless you have a hard business reason, such as a company rule that requires Google Cloud. A move is essentially a rebuild of the backend: every screen that reads or saves data would need rewriting, and it carries real risk of breaking scoring, winners, and prize claims during the NFL season. Lovable Cloud is also the backend Lovable supports best, so later changes will be faster and more reliable here.

## What a full move would take

1. **Data model rewrite.** Firebase stores documents rather than linked tables. Games, squares, players, entries and quarter results would need restructuring, and every count, join, and "one square per player" check would have to be rebuilt.
2. **Security rules rewrite.** All of the current access rules (host-only actions, members-only boards, super admin, prize-claim protection) would need rewriting as Firebase rules and testing again from scratch.
3. **Server logic rewrite.** The NFL draw, which is guaranteed to run only once, the score-freshness guard, result snapshots, and role checks currently run inside the database. They would move into server code with Firebase transactions.
4. **Sign-in migration.** Accounts would be exported and imported into Firebase Auth. Password users may need to reset their passwords, Google sign-in has to be set up again, and guest accounts would need a new approach.
5. **Live updates.** Every live board, player list and entry subscription would switch to Firebase listeners.
6. **Background job.** The every-minute scheduled task would be recreated with Firebase or Google Cloud scheduling.
7. **Storage.** Brand logos would move to Firebase Storage, with new access rules.
8. **Data copy and cutover.** You would export all existing games, users and results, import them, check they match, then switch over during a period with no live games.
9. **Full retest** of create, join, claim, live scoring, randomization, recaps, prize verification, admin and branding.

## Cost and effort
- A large, multi-week effort touching almost every file that saves or reads data.
- You would need your own Firebase project and billing account. Firebase keys would be added as secrets.
- There would be ongoing maintenance outside Lovable's built-in tooling.

## Middle-ground options
- **Keep Lovable Cloud and export data to Firebase or BigQuery** for reporting only.
- **Use Firebase for one piece only**, such as push notifications, and keep everything else here.

## Next step
Tell me why you want Firebase (a company requirement, cost, familiarity, or something else) and which option you prefer. I will then either write a detailed migration plan or set up the lighter integration.
