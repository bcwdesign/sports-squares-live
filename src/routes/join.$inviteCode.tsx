import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { joinGameByCode } from "@/lib/overlay.functions";
import { invokeAuthed } from "@/lib/serverFnClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$inviteCode")({
  head: () => ({
    meta: [
      { title: "Join Game — Clutch Squares" },
      { name: "description", content: "You've been invited to a Clutch Squares game. Sign in to claim your squares before tip-off and play live with friends." },
      { property: "og:title", content: "Join Game — Clutch Squares" },
      { property: "og:description", content: "You've been invited to a Clutch Squares game. Claim your squares before tip-off." },
    ],
  }),
  component: JoinByCode,
});

function JoinByCode() {
  const { inviteCode } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Looking up game...");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/join/${inviteCode}` } });
      return;
    }
    if (!profile) return;

    const join = async () => {
      const code = inviteCode.toUpperCase();
      let game: { id: string; name: string; status: string };
      try {
        setStatus("Joining game...");
        game = await invokeAuthed(joinGameByCode, { code });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invalid invite code");
        navigate({ to: "/dashboard" });
        return;
      }
      toast.success(`Joined ${game.name}`);
      const route = game.status === "completed" ? "/game/$gameId/results"
        : (game.status === "live" || game.status === "locked") ? "/game/$gameId/live"
        : "/game/$gameId/lobby";
      navigate({ to: route, params: { gameId: game.id } });
    };
    join();
  }, [user, profile, loading, inviteCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[image:var(--gradient-neon)] flex items-center justify-center font-display font-bold text-background animate-pulse">SQ</div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{status}</div>
      </div>
    </div>
  );
}
