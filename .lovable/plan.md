# Host Access Control + Super Admin Host Management

Today anyone signed in can create a game. This adds a formal "Host" permission that only a Super Admin can grant, plus a Host Management screen in the admin console.

## What changes for people using the app

- Only users granted Host (and Super Admins) can create a new game.
- Everyone else can still join games, claim squares, chat, watch live boards, and see results/recaps.
- Someone without Host who opens the Create Game page sees a polished message: "Hosting access required — You can join and play in existing games. Creating a new Squares game currently requires Host access." with a button back to the dashboard.
- Existing game owners keep their access: they are granted Host automatically as part of the upgrade (guest accounts are not).
- If Host is revoked, the person can still finish games they already own, but cannot start new ones. Nothing about their existing games is deleted or transferred.

## Super Admin: Host Management

A new tab in the admin console, styled to match the existing neon broadcast look:

- Search box (matches display name or email)
- Paginated user list: avatar, display name, email, badges (Super Admin / Host / User, plus Guest), games hosted, most recent hosted game date
- "Make Host" and "Revoke Host" buttons; revoke asks for confirmation first
- Loading, empty, and error states, plus success toasts
- A recent activity list showing who granted or revoked Host and when
- Guests cannot be made Host; the screen cannot touch Super Admin or Admin roles, and cannot change your own elevated access
- The tab and its actions are only shown to, and only work for, Super Admins

## Technical details

**Migration (single forward-only migration)**
- `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'host';` (committed before use; role backfill runs in a follow-up statement/migration section so the new enum label is visible)
- Backfill: insert `host` rows into `user_roles` for every distinct `games.host_id` whose profile has `is_guest = false`, `ON CONFLICT (user_id, role) DO NOTHING`
- Confirm/keep the unique constraint on `user_roles (user_id, role)`
- New table `public.role_audit_log` (id, target_user_id, role, action `assigned|revoked`, performed_by, created_at) with GRANTs (`SELECT` to authenticated, `ALL` to service_role), RLS enabled, SELECT policy limited to `has_role(auth.uid(),'super_admin')`, and no client INSERT policy — writes happen through the service-role server function only
- New security-definer helpers with `SET search_path = public`, `STABLE`, granted to `authenticated`:
  - `public.can_host(_user_id uuid)` → `has_role(_user_id,'host') OR has_role(_user_id,'super_admin')`
  - `public.can_admin_game(_game_id uuid, _user_id uuid)` → `is_game_host(...) OR has_role(_user_id,'super_admin')`
- RLS updates:
  - `games` INSERT policy becomes `host_id = auth.uid() AND public.can_host(auth.uid())` — this is the hard server-side gate against direct API calls
  - `games` UPDATE/DELETE, `squares` host-manage, and `score_drafts` policies switch from `is_game_host(...)` to `can_admin_game(...)` so Super Admins keep emergency access; existing owner behavior is unchanged
  - `user_roles` insert/delete stay Super-Admin-only (already the case), so no self-assignment is possible

**Server code**
- `src/lib/authz.server.ts`: `assertSuperAdmin` (moved/reused), `isSuperAdmin`, `hasRole`, `canHost`, `assertCanHost`, `assertCanManageHosts`
- `src/lib/admin.functions.ts` gains protected server functions: `listManagedUsers` (paginated + search, joins profiles, `auth.users` email via admin API, roles, hosted counts/last hosted date), `assignHostRole`, `revokeHostRole`, `listRoleAuditLog`. All use `requireSupabaseAuth` + `assertSuperAdmin`; mutations are idempotent, refuse guests, refuse self, refuse any role other than `host`, and write a `role_audit_log` row
- `src/lib/admin.types.ts`: new `ManagedUser`, `RoleAuditEntry`, paginated result types
- Only non-sensitive fields returned (id, display name, email, avatar, guest flag, created_at, roles, hosted stats)

**Client**
- `src/hooks/useCanHost.ts` (or extend `AuthContext`) reads the current user's roles via RLS-safe `user_roles` select for UI purposes only
- `src/routes/_app.create.tsx`: gate renders the "Hosting access required" panel; the DB policy remains the real enforcement
- `src/routes/_app.dashboard.tsx`: hide/disable "Create Game" for non-hosts with the same messaging on click-through
- `src/routes/_app.admin.tsx`: new "Hosts" tab + `src/components/admin/HostManagement.tsx`

**Validation**
- `bunx tsgo` typecheck and lint
- Browser pass as Super Admin: search, assign, duplicate-assign, revoke + confirm, audit list
- Verify a non-host's direct create attempt is rejected by the database policy
- Regression check: NBA/NFL pickers, score sync, joining, square claiming, chat, overlay, results

Nothing is deployed; implementation stops after validation for review.
