import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Message } from "@/lib/types";

export function ChatPanel({ gameId }: { gameId: string }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("messages")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (active && data) setMessages(data as Message[]);
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
        {messages.map((m) => (
          <div key={m.id} className="text-sm animate-fade-in">
            <span
              className="font-bold mr-2"
              style={{ color: m.user_id === user?.id ? "var(--neon-blue)" : "var(--neon-green)" }}
            >
              {m.display_name}
            </span>
            <span className="text-foreground/90">{m.text}</span>
          </div>
        ))}
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
