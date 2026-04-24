import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { getUser } from "@/lib/gameState";
import { Send } from "lucide-react";

export function ChatPanel() {
  const [state, update] = useGameState();
  const [text, setText] = useState("");
  const user = getUser();

  const send = () => {
    if (!text.trim()) return;
    update((s) => ({
      ...s,
      chat: [...s.chat, { id: crypto.randomUUID(), user, text: text.trim(), ts: Date.now() }].slice(-50),
    }));
    setText("");
  };

  return (
    <div className="flex flex-col h-full bg-[color:var(--surface)] rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold text-sm">LIVE CHAT</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--neon-green)] animate-pulse" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{state.chat.length} msgs</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[260px] min-h-[160px]">
        {state.chat.map((m) => (
          <div key={m.id} className="text-sm animate-fade-in">
            <span
              className="font-bold mr-2"
              style={{
                color: m.user === user ? "var(--neon-blue)" : "var(--neon-green)",
              }}
            >
              {m.user}
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
