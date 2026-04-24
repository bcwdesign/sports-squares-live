// Real-time hook: subscribes to a game and its squares/players, returns synced state.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Game, GamePlayer, Square } from "@/lib/types";

export function useGame(gameId: string | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  const [squares, setSquares] = useState<Square[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let active = true;
    setLoading(true);

    const load = async () => {
      const [g, sq, pl] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
        supabase.from("squares").select("*").eq("game_id", gameId),
        supabase.from("game_players").select("*").eq("game_id", gameId).order("joined_at"),
      ]);
      if (!active) return;
      if (g.error) setError(g.error.message);
      if (g.data) setGame(g.data as Game);
      if (sq.data) setSquares(sq.data as Square[]);
      if (pl.data) setPlayers(pl.data as GamePlayer[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setGame(null);
          else setGame(payload.new as Game);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squares", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setSquares((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((s) => s.id !== (payload.old as Square).id);
            const next = payload.new as Square;
            const idx = prev.findIndex((s) => s.id === next.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = next;
              return copy;
            }
            return [...prev, next];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== (payload.old as GamePlayer).id);
            const next = payload.new as GamePlayer;
            const idx = prev.findIndex((p) => p.id === next.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = next;
              return copy;
            }
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return { game, squares, players, loading, error };
}
