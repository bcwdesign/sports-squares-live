// Host-facing Custom Branding controls. Used on the New Game screen and in
// host options for a running game. Keeps a reusable Brand Kit library so a
// business customer sets their look up once.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palette, RotateCcw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LogoUploader } from "./LogoUploader";
import { BrandingPreview } from "./BrandingPreview";
import {
  DEFAULT_BRANDING,
  SQUARE_STYLE_LABELS,
  contrastRatio,
  deriveTheme,
  isValidHex,
  normalizeHex,
  type GameBranding,
  type SquareStyle,
} from "@/lib/branding";

type BrandKit = {
  id: string;
  name: string;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  claimed_square_color: string | null;
  winning_square_color: string | null;
  square_style: string;
};

export function BrandingSection({
  value,
  onChange,
}: {
  value: GameBranding;
  onChange: (next: GameBranding) => void;
}) {
  const { user } = useAuth();
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [kitName, setKitName] = useState("");
  const [savingKit, setSavingKit] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = useCallback(
    (patch: Partial<GameBranding>) => onChange({ ...value, ...patch }),
    [onChange, value],
  );

  const loadKits = useCallback(async () => {
    if (!user) return;
    setLoadingKits(true);
    const { data, error } = await supabase
      .from("brand_kits")
      .select("*")
      .order("created_at", { ascending: false });
    setLoadingKits(false);
    if (error) {
      toast.error("Could not load your brand kits");
      return;
    }
    setKits((data ?? []) as BrandKit[]);
  }, [user]);

  useEffect(() => {
    void loadKits();
  }, [loadKits]);

  const applyKit = (id: string) => {
    const kit = kits.find((k) => k.id === id);
    if (!kit) return;
    onChange({
      enabled: true,
      companyName: kit.company_name ?? kit.name,
      logoUrl: kit.logo_url,
      primaryColor: kit.primary_color,
      secondaryColor: kit.secondary_color,
      backgroundColor: kit.background_color,
      claimedSquareColor: kit.claimed_square_color,
      winningSquareColor: kit.winning_square_color,
      squareStyle: (kit.square_style as SquareStyle) ?? "tinted",
    });
    toast.success(`Applied “${kit.name}”`);
  };

  const saveKit = async () => {
    const name = kitName.trim();
    if (!name) {
      toast.error("Name your brand kit first");
      return;
    }
    if (!user) return;
    setSavingKit(true);
    const { error } = await supabase.from("brand_kits").upsert(
      {
        owner_user_id: user.id,
        name,
        company_name: value.companyName.trim() || null,
        logo_url: value.logoUrl,
        primary_color: value.primaryColor,
        secondary_color: value.secondaryColor,
        background_color: value.backgroundColor,
        claimed_square_color: value.claimedSquareColor,
        winning_square_color: value.winningSquareColor,
        square_style: value.squareStyle,
      },
      { onConflict: "owner_user_id,name" },
    );
    setSavingKit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setKitName("");
    toast.success(`Saved “${name}”`);
    void loadKits();
  };

  const deleteKit = async (id: string, name: string) => {
    const { error } = await supabase.from("brand_kits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted “${name}”`);
    void loadKits();
  };

  const theme = deriveTheme(value);
  const lowContrast =
    value.enabled && contrastRatio(value.primaryColor, value.backgroundColor) < 2.4;

  return (
    <section className="rounded-2xl border border-border bg-[color:var(--surface)]/60 p-4 sm:p-5 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[image:var(--gradient-neon)] flex items-center justify-center shrink-0">
            <Palette className="w-4.5 h-4.5 text-background" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base">Custom Branding</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              Make this game match your company. Optional — leave off for the standard Clutch Squares look.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {value.enabled ? "On" : "Off"}
          </span>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={value.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            aria-label="Enable custom branding"
          />
          <span className="w-11 h-6 rounded-full bg-secondary peer-checked:bg-[color:var(--neon-green)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--neon-blue)] transition relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-background after:transition peer-checked:after:translate-x-5" />
        </label>
      </header>

      {value.enabled && (
        <div className="space-y-5 animate-fade-in">
          {/* Kits */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="brand-kit">Brand kit</FieldLabel>
              <select
                id="brand-kit"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) applyKit(e.target.value);
                  e.target.value = "";
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-[color:var(--surface-elevated)] border border-border text-sm focus:outline-none focus:border-[color:var(--neon-blue)]"
              >
                <option value="">
                  {loadingKits ? "Loading kits..." : kits.length ? "Apply a saved kit..." : "No saved kits yet"}
                </option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
              {kits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {kits.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => void deleteKit(k.id, k.name)}
                      className="px-2 py-1 rounded-md border border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:border-destructive hover:text-destructive transition flex items-center gap-1"
                      aria-label={`Delete brand kit ${k.name}`}
                    >
                      <Trash2 className="w-3 h-3" /> {k.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="kit-name">Save current look as a kit</FieldLabel>
              <div className="flex gap-2">
                <input
                  id="kit-name"
                  value={kitName}
                  onChange={(e) => setKitName(e.target.value)}
                  placeholder="e.g. Continental"
                  maxLength={60}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[color:var(--surface-elevated)] border border-border text-sm focus:outline-none focus:border-[color:var(--neon-blue)]"
                />
                <button
                  type="button"
                  onClick={() => void saveKit()}
                  disabled={savingKit}
                  className="px-3 rounded-lg border border-[color:var(--neon-green)]/60 text-[color:var(--neon-green)] font-mono text-[10px] uppercase tracking-widest hover:bg-[color:var(--neon-green)]/10 transition flex items-center gap-1.5"
                >
                  {savingKit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="company-name">Company name</FieldLabel>
              <input
                id="company-name"
                value={value.companyName}
                onChange={(e) => set({ companyName: e.target.value })}
                placeholder="Continental"
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-lg bg-[color:var(--surface-elevated)] border border-border text-sm focus:outline-none focus:border-[color:var(--neon-blue)]"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Shown as “Presented by …” on the board and overlay.
              </p>
            </div>
            <div>
              <FieldLabel>Company logo</FieldLabel>
              <LogoUploader value={value.logoUrl} onChange={(logoUrl) => set({ logoUrl })} />
            </div>
          </div>

          {/* Colours */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField
              id="brand-primary"
              label="Primary"
              hint="Accents & highlights"
              value={value.primaryColor}
              onChange={(primaryColor) => set({ primaryColor })}
            />
            <ColorField
              id="brand-secondary"
              label="Secondary"
              hint="Supporting accent"
              value={value.secondaryColor}
              onChange={(secondaryColor) => set({ secondaryColor })}
            />
            <ColorField
              id="brand-background"
              label="Background"
              hint="Board backdrop"
              value={value.backgroundColor}
              onChange={(backgroundColor) => set({ backgroundColor })}
            />
            <ColorField
              id="brand-claimed"
              label="Claimed square"
              hint="Defaults to primary"
              value={value.claimedSquareColor ?? value.primaryColor}
              onChange={(claimedSquareColor) => set({ claimedSquareColor })}
            />
            <ColorField
              id="brand-winning"
              label="Winning square"
              hint="Must stand out"
              value={value.winningSquareColor ?? DEFAULT_BRANDING.winningSquareColor!}
              onChange={(winningSquareColor) => set({ winningSquareColor })}
            />
            <div>
              <FieldLabel htmlFor="square-style">Square style</FieldLabel>
              <select
                id="square-style"
                value={value.squareStyle}
                onChange={(e) => set({ squareStyle: e.target.value as SquareStyle })}
                className="w-full px-3 py-2.5 rounded-lg bg-[color:var(--surface-elevated)] border border-border text-sm focus:outline-none focus:border-[color:var(--neon-blue)]"
              >
                {(Object.keys(SQUARE_STYLE_LABELS) as SquareStyle[]).map((s) => (
                  <option key={s} value={s}>
                    {SQUARE_STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {lowContrast && (
            <p
              className="text-xs rounded-lg px-3 py-2 border"
              style={{
                borderColor: "color-mix(in oklab, var(--neon-orange) 40%, transparent)",
                color: "var(--neon-orange)",
              }}
              role="status"
            >
              Your primary colour is close to the background — Clutch Squares will brighten it automatically so
              players can still read the board.
            </p>
          )}

          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Live preview</FieldLabel>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-2.5 py-1.5 rounded-lg border border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:border-[color:var(--neon-orange)] hover:text-[color:var(--neon-orange)] transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" /> Reset to Clutch Squares
              </button>
            </div>
            <BrandingPreview branding={value} />
            <p className="text-[10px] text-muted-foreground mt-2 font-mono">
              Derived surface {theme.surface} · text {theme.text}
            </p>
          </div>

          {confirmReset && (
            <div className="rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Reset branding back to the default Clutch Squares look? Saved brand kits are kept.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-[10px] font-mono uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...DEFAULT_BRANDING, enabled: value.enabled });
                    setConfirmReset(false);
                    toast.success("Branding reset");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[color:var(--neon-orange)] text-background text-[10px] font-mono uppercase tracking-widest font-bold"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5"
    >
      {children}
    </label>
  );
}

function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(normalizeHex(e.target.value, value))}
          className="w-11 h-11 rounded-lg border border-border bg-transparent cursor-pointer shrink-0"
          aria-label={`${label} colour picker`}
        />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (isValidHex(e.target.value)) onChange(normalizeHex(e.target.value, value));
          }}
          onBlur={() => setText(value)}
          spellCheck={false}
          aria-label={`${label} hex value`}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-[color:var(--surface-elevated)] border border-border text-sm font-mono uppercase focus:outline-none focus:border-[color:var(--neon-blue)]"
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">{hint}</p>
    </div>
  );
}
