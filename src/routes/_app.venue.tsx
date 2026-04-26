// Minimal "My Venue" settings page. Lets a logged-in user name their venue
// and see which plan they're on. Founders Edge ($100/mo) is the grandfathered
// early-customer plan for the first 10 bars/venues — no payments yet.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NeonButton } from "@/components/NeonButton";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_app/venue")({
  head: () => ({ meta: [{ title: "My Venue — Clutch Squares" }] }),
  component: VenuePage,
});

type Venue = {
  id: string;
  venue_name: string;
  plan_name: string;
  monthly_price: number;
  founder_edge: boolean;
  founder_edge_position: number | null;
  active: boolean;
};

function VenuePage() {
  const { user } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setVenue(data as Venue);
        setName((data as Venue).venue_name);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Venue name required");
      return;
    }
    setSaving(true);
    try {
      if (venue) {
        const { error } = await supabase
          .from("venues")
          .update({ venue_name: name.trim() })
          .eq("id", venue.id);
        if (error) throw error;
        toast.success("Venue updated");
      } else {
        // Compute Founders Edge slot — first 10 venues are grandfathered.
        const { count } = await supabase
          .from("venues")
          .select("id", { count: "exact", head: true });
        const position = (count ?? 0) + 1;
        const isFounder = position <= 10;
        const { data, error } = await supabase
          .from("venues")
          .insert([
            {
              owner_user_id: user.id,
              venue_name: name.trim(),
              plan_name: isFounder ? "founders_edge" : "standard",
              monthly_price: isFounder ? 100 : 200,
              founder_edge: isFounder,
              founder_edge_position: isFounder ? position : null,
            },
          ])
          .select()
          .single();
        if (error) throw error;
        setVenue(data as Venue);
        toast.success(
          isFounder
            ? `Founders Edge slot #${position} reserved`
            : "Venue created on Standard plan",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-xl mx-auto">
      <Link
        to="/dashboard"
        className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase"
      >
        ← Dashboard
      </Link>
      <div className="mt-4 mb-6">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-blue)]">
          <Building2 className="w-3.5 h-3.5" /> My Venue
        </div>
        <h1 className="font-display font-bold text-3xl mt-2">
          {venue ? venue.venue_name : "Set up your venue"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bars and venues use ClutchSquares for in-house watch parties.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 space-y-4">
        <label className="block">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Venue name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Half-Court Bar"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        {venue && (
          <div className="rounded-xl border border-[color:var(--neon-green)]/30 bg-[color:var(--neon-green)]/5 p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--neon-green)]">
              Current plan
            </div>
            <div className="font-display font-bold text-lg mt-1">
              {venue.founder_edge ? "Founders Edge" : "Standard Venue"}{" "}
              <span className="text-muted-foreground font-mono text-sm font-normal">
                · ${venue.monthly_price}/mo
              </span>
            </div>
            {venue.founder_edge && (
              <p className="text-xs text-muted-foreground mt-1">
                Grandfathered early-customer slot
                {venue.founder_edge_position
                  ? ` #${venue.founder_edge_position} of 10`
                  : ""}
                . Locked-in price for life.
              </p>
            )}
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2">
              Billing not enabled yet — you won't be charged.
            </p>
          </div>
        )}

        <NeonButton
          variant="blue"
          className="w-full"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving..." : venue ? "Update Venue" : "Create Venue"}
        </NeonButton>
      </div>
    </div>
  );
}
