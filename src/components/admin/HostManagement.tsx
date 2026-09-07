import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck, UserPlus, UserMinus, AlertTriangle, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { invokeAuthed } from "@/lib/serverFnClient";
import {
  assignHostRole,
  listManagedUsers,
  listRoleAudit,
  revokeHostRole,
} from "@/lib/hosts.functions";
import type { ManagedUser, ManagedUserPage, RoleAuditEntry } from "@/lib/admin.types";

const PAGE_SIZE = 20;

export function HostManagement() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ManagedUserPage | null>(null);
  const [audit, setAudit] = useState<RoleAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<ManagedUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, log] = await Promise.all([
        invokeAuthed(listManagedUsers, { search: debounced, page, pageSize: PAGE_SIZE }),
        invokeAuthed(listRoleAudit, undefined as never),
      ]);
      setData(users);
      setAudit(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [debounced, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const doAssign = async (u: ManagedUser) => {
    setBusyId(u.id);
    try {
      const res = await invokeAuthed(assignHostRole, { userId: u.id });
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const doRevoke = async (u: ManagedUser) => {
    setBusyId(u.id);
    setConfirmUser(null);
    try {
      const res = await invokeAuthed(revokeHostRole, { userId: u.id });
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <section aria-label="Host management" className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="host-search" className="sr-only">Search users by name or email</label>
        <input
          id="host-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-lg border border-border bg-[color:var(--surface)] pl-9 pr-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--neon-blue)]"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[color:var(--neon-orange)]/50 bg-[color:var(--neon-orange)]/10 p-4 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2 text-[color:var(--neon-orange)]" />
          {error}
          <button onClick={() => void load()} className="ml-3 underline font-mono text-xs uppercase tracking-widest">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-[color:var(--surface)] animate-pulse" />
          ))}
        </div>
      ) : !data || data.users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
          No users match that search.
        </div>
      ) : (
        <ul className="rounded-xl border border-border bg-[color:var(--surface)] divide-y divide-border overflow-hidden">
          {data.users.map((u) => {
            const isSuper = u.roles.includes("super_admin");
            const isHost = u.roles.includes("host");
            return (
              <li key={u.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <PlayerAvatar name={u.display_name} src={u.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium truncate">{u.display_name}</span>
                      {isSuper && <Badge tone="green">Super Admin</Badge>}
                      {isHost && <Badge tone="blue">Host</Badge>}
                      {!isSuper && !isHost && <Badge tone="muted">User</Badge>}
                      {u.is_guest && <Badge tone="orange">Guest</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {u.email ?? "no email"} · {u.games_hosted} hosted
                      {u.last_hosted_at ? ` · last ${new Date(u.last_hosted_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {isSuper ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Protected
                    </span>
                  ) : isHost ? (
                    <button
                      type="button"
                      onClick={() => setConfirmUser(u)}
                      disabled={busyId === u.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--neon-orange)]/60 bg-[color:var(--neon-orange)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[color:var(--neon-orange)] transition hover:bg-[color:var(--neon-orange)]/20 focus-visible:ring-2 focus-visible:ring-[color:var(--neon-orange)] disabled:opacity-50"
                    >
                      {busyId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                      Revoke Host
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void doAssign(u)}
                      disabled={busyId === u.id || u.is_guest}
                      title={u.is_guest ? "Guest accounts cannot be hosts" : undefined}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--neon-blue)]/60 bg-[color:var(--neon-blue)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-[color:var(--neon-blue)] transition hover:bg-[color:var(--neon-blue)]/20 focus-visible:ring-2 focus-visible:ring-[color:var(--neon-blue)] disabled:opacity-40"
                    >
                      {busyId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Make Host
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:text-foreground"
          >
            Prev
          </button>
          <span>Page {page} / {totalPages} · {data.total} users</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:text-foreground"
          >
            Next
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-[color:var(--surface)] p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Recent host role activity
        </h3>
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No role changes recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className={a.action === "assigned" ? "text-[color:var(--neon-green)]" : "text-[color:var(--neon-orange)]"}>
                  {a.action === "assigned" ? "Granted" : "Revoked"} host
                </span>
                <span className="text-foreground">{a.target_name ?? a.target_user_id}</span>
                <span>by {a.performed_by_name ?? "system"}</span>
                <span>· {new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
          <div className="w-full max-w-sm rounded-xl border border-border bg-[color:var(--surface)] p-6">
            <h2 id="revoke-title" className="font-display font-bold text-lg mb-2">Revoke host access?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {confirmUser.display_name} will no longer be able to create new games. Their existing games stay
              untouched and they can keep running any game already in progress.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmUser(null)}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-mono uppercase tracking-widest hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doRevoke(confirmUser)}
                className="px-3 py-1.5 rounded-md border border-[color:var(--neon-orange)]/60 bg-[color:var(--neon-orange)]/15 text-[color:var(--neon-orange)] text-xs font-mono uppercase tracking-widest"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Badge({ tone, children }: { tone: "green" | "blue" | "orange" | "muted"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    green: "bg-[color:var(--neon-green)]/20 text-[color:var(--neon-green)]",
    blue: "bg-[color:var(--neon-blue)]/20 text-[color:var(--neon-blue)]",
    orange: "bg-[color:var(--neon-orange)]/20 text-[color:var(--neon-orange)]",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${tones[tone]}`}>
      {children}
    </span>
  );
}
