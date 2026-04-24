import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { GamePlayer, Message } from "@/lib/types";

export function ChatPanel({ gameId }: { gameId: string }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Map of user_id -> avatar_url for quick lookup when rendering chat rows.
  const avatarMap = useMemo(() => {
    const m = new Map<string, string | null>();
    players.forEach((p) => m.set(p.user_id, p.avatar_url));
    return m;
  }, [players]);

  useEffect(() => {
    let active = true;

    // Load messages + players in parallel.
    Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true })
        .limit(100),
      supabase.from("game_players").select("*").eq("game_id", gameId),
    ]).then(([msgRes, playerRes]) => {
      if (!active) return;
      if (msgRes.data) setMessages(msgRes.data as Message[]);
      if (playerRes.data) setPlayers(playerRes.data as GamePlayer[]);
    });

    const channel = supabase
      .channel(`messages:${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message].slice(-100));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE")
              return prev.filter((p) => p.id !== (payload.old as GamePlayer).id);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t || !user || !profile) return;
    setText("");
    await supabase.from("messages").insert({
      game_id: gameId,
      user_id: user.id,
      display_name: profile.display_name,
      text: t,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[color:var(--surface)] rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold text-sm">LIVE CHAT</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-green)] animate-pulse" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{messages.length} msgs</span>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[260px] min-h-[160px]">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground italic">No messages yet. Say hi 👋</div>
        )}
        {messages.map((m) => {
          const isMe = m.user_id === user?.id;
          const src = isMe ? profile?.avatar_url ?? null : avatarMap.get(m.user_id) ?? null;
          return (
            <div key={m.id} className="flex items-start gap-2 text-sm animate-fade-in">
              <PlayerAvatar name={m.display_name} src={src} size="xs" />
              <div className="min-w-0 flex-1">
                <span
                  className="font-bold mr-2"
                  style={{ color: isMe ? "var(--neon-blue)" : "var(--neon-green)" }}
                >
                  {m.display_name}
                </span>
                <span className="text-foreground/90 break-words">{m.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-border flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Say something..."
          maxLength={500}
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[color:var(--neon-blue)]"
        />
        <button
          onClick={send}
          className="px-3 rounded-md bg-[color:var(--neon-blue)] text-background hover:opacity-90 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
