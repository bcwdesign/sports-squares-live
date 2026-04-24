// Public, auth-free overlay accessible via share token. Uses an RPC that
// bypasses RLS only for the matching token, plus 3s polling because anonymous
// realtime subscriptions are blocked by RLS.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Game, Square } from "@/lib/types";
import { Overlay } from "@/components/Overlay";

export const Route = createFileRoute("/overlay/$token")({
  head: () => ({ meta: [{ title: "Live Watch Party — Clutch Squares" }] }),
  component: PublicOverlayPage,
});

type OverlayPayload = { game: Game; squares: Square[] } | null;

function PublicOverlayPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<OverlayPayload>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchOnce = async () => {
      const { data: payload, error: err } = await supabase.rpc("get_overlay_by_token", {
        _token: token,
      });
      if (!active) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!payload) {
        setError("This overlay link is invalid or has been revoked.");
        setLoading(false);
        return;
      }
      setData(payload as OverlayPayload);
      setLoading(false);
    };

    fetchOnce();
    const id = setInterval(fetchOnce, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center text-sm font-mono uppercase tracking-widest text-muted-foreground">
        Loading watch party...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-2 text-center px-6">
        <div className="font-display font-black text-3xl text-[color:var(--neon-orange)]">Overlay Unavailable</div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {error ?? "This link is invalid."}
        </div>
      </div>
    );
  }

  return <Overlay game={data.game} squares={data.squares} />;
}
