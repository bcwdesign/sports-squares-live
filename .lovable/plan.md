## Root cause

The TanStack import-protection plugin walks the import graph from each client entry (route files in `src/routeTree.gen.ts`, components, hooks) and fails the build if any reachable module imports `@/integrations/supabase/client.server` at module scope.

Today three "server" modules live at `src/server/*.functions.ts` and import `client.server` at the top of the file:

- `src/server/balldontlie.functions.ts`
- `src/server/commentator.functions.ts`
- `src/server/admin.functions.ts`

These are imported directly by client-reachable code:

- `src/components/LiveScoreSyncPanel.tsx` → `@/server/balldontlie.functions`
- `src/components/CommentatorCard.tsx` → `@/server/commentator.functions`
- `src/routes/_app.game.$gameId.overlay.tsx` → `@/server/commentator.functions`
- `src/routes/_app.game.$gameId.results.tsx` → `@/server/commentator.functions`
- `src/routes/_app.create.tsx` → `@/server/commentator.functions`
- `src/routes/_app.admin.tsx` → `@/server/admin.functions`

Two structural problems compound it:

1. **Wrong directory.** TanStack's server-fn splitter only strips `.handler()` bodies (and their imports) from the client bundle when the module lives in a **client-safe path** (`src/lib/`, `src/utils/`, route-adjacent). `src/server/` is treated as server-only by the plugin — any client-side import of a file there fails import protection, so the splitter never gets a chance to help.
2. **`.functions.ts` files mix server fns with plain exports.** `balldontlie.functions.ts` exports `runSync` (a plain async helper, not a `createServerFn`). Plain exports defeat the splitter — the top-level `client.server` import then ships with the file even after the move.

Separately, the public cron route is also broken:

- `src/routes/api/public/hooks/sync-live-scores.ts` imports `./sync-live-scores.server` at top level. That route file is referenced by `routeTree.gen.ts` (client-reachable), and `.server.ts` is blocked from any client-side importer by import-protection. This is the file currently triggering the build error.

## Fix

Apply the four-part remedy below. No build checks get disabled.

### 1. Relocate `.functions.ts` modules to a client-safe path

Move and rewrite:

```text
src/server/balldontlie.functions.ts  →  src/lib/balldontlie.functions.ts
src/server/commentator.functions.ts  →  src/lib/commentator.functions.ts
src/server/admin.functions.ts        →  src/lib/admin.functions.ts
```

Each new `src/lib/*.functions.ts` file contains **only** `createServerFn` declarations + their imports. No helper functions, no plain exports, no shared constants beyond what the handlers themselves need at compile time.

### 2. Extract plain helpers into sibling `.server.ts` files

Pure server-only logic moves into `.server.ts` neighbours, which the splitter and import-protection both keep off the client:

```text
src/lib/balldontlie.server.ts   ← runSync, callBalldontlieLive, normalizeBoxScore,
                                  lastSyncByGame map, MIN_SYNC_INTERVAL_MS, NormalizedLiveGame type
src/lib/commentator.server.ts   ← assertHost, buildPrompt, DEFAULT_HEYGEN_* constants
src/lib/admin.server.ts         ← assertSuperAdmin (and any helper-only logic)
```

The new `*.functions.ts` files import from these `.server.ts` siblings. Because the splitter strips `.handler()` bodies (and their imports) from the client bundle, the `client.server` chain disappears for client builds. The `*.server.ts` extension is the strongest backstop — import-protection refuses any client-side import directly.

Public type exports that the client legitimately needs (`NormalizedLiveGame`, `AdminOverview`, `AdminStats`, `AdminGame`, `AdminUser`, `AdminWinner`) move to a plain `.ts` types module so consumers don't reach into a `.server.ts` file:

```text
src/lib/balldontlie.types.ts   ← NormalizedLiveGame
src/lib/admin.types.ts         ← AdminOverview, AdminStats, AdminGame, AdminUser, AdminWinner
```

`*.functions.ts` and `*.server.ts` both re-import these types as needed. Client components import types from `*.types.ts` and server fns from `*.functions.ts`.

### 3. Update every client import

Rewrite imports in the six client files listed above:

```text
@/server/balldontlie.functions  →  @/lib/balldontlie.functions     (+ @/lib/balldontlie.types for NormalizedLiveGame)
@/server/commentator.functions  →  @/lib/commentator.functions
@/server/admin.functions        →  @/lib/admin.functions           (+ @/lib/admin.types for AdminOverview)
```

No behavioural change — same exported names, same `invokeAuthed(fn, …)` / `useServerFn(fn)` call sites.

### 4. Fix the public cron server route

`src/routes/api/public/hooks/sync-live-scores.ts` is in the client routeTree, so its top-level `import { handleSyncLiveScores } from "./sync-live-scores.server"` is the direct cause of today's build failure.

Move the handler logic behind a `createServerFn` declared in the client-safe path and call it from the route:

```text
src/lib/sync-live-scores.functions.ts  ← syncLiveScoresFn = createServerFn({ method: "POST" })
                                          .handler(async () => { ...uses runSync from balldontlie.server... })
src/routes/api/public/hooks/sync-live-scores.ts
  - delete the .server.ts file
  - POST handler: read x-cron-secret from request headers, then `return Response.json(await syncLiveScoresFn())`
```

The route file no longer imports anything from `*.server.ts` or `client.server`. The cron secret check stays in the route handler (it needs the raw `Request`); the database work runs inside the server fn's `.handler()` body where `client.server` is safe.

### 5. Verify

- `npm run build` (auto-run by harness) must succeed with no import-protection errors.
- Smoke-check that overlay, results, create, admin, and live-score-sync panels still load.
- Hit `POST /api/public/hooks/sync-live-scores` with the cron secret to confirm the cron path still works.

## Out of scope

- No RLS or business-logic changes.
- No changes to `src/integrations/supabase/client.server.ts` itself (it remains server-only, untouched).
- No changes to authentication, route guards, or the `_app` layout.

## Technical notes

- The `src/server/` directory is left empty after the move; we can delete it or keep it as a marker. Recommend deleting to prevent future confusion.
- `routeTree.gen.ts` is auto-generated; no manual edit needed — the route file path doesn't change.
- `createServerOnlyFn` is available from `@tanstack/react-start` (re-exported via `@tanstack/start-client-core`). We don't actually need it for this fix because the `.server.ts` extension already provides hard protection, but it remains an option for one-off helpers.
- Risk: any `.functions.ts` file that accidentally re-introduces a plain export (helper, constant, type at value position) re-breaks the client bundle. Convention going forward: server fns in `.functions.ts`, helpers in `.server.ts`, shared types in `.types.ts`.
