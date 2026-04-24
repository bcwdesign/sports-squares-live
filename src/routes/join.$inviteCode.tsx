import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$inviteCode")({
  head: () => ({ meta: [{ title: "Join Game — Sports Squares Live" }] }),
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
      const { data: game, error } = await supabase
        .from("games")
        .select("*")
        .eq("invite_code", code)
        .maybeSingle();
      if (error || !game) {
        toast.error("Invalid invite code");
        navigate({ to: "/dashboard" });
        return;
      }
      setStatus(`Joining ${game.name}...`);
      const { error: insErr } = await supabase.from("game_players").insert({
        game_id: game.id,
        user_id: user.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
      if (insErr && !insErr.message.includes("duplicate")) {
        toast.error(insErr.message);
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
