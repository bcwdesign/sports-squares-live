// Authenticated player profile page: edit display name and upload an avatar.
// Avatars are stored in the public `avatars` bucket under <user-id>/avatar.<ext>.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NeonButton } from "@/components/NeonButton";
import { Camera, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Clutch Squares" }] }),
  component: ProfilePage,
});

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  // Revoke object URLs when replaced/unmounted
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 4MB");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  };

  // Crop the chosen image to a centered 1:1 square at max 512x512 before upload.
  const cropTo512Square = async (file: File): Promise<Blob> => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Image load failed"));
        img.src = url;
      });
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;
      const out = 512;
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out);
      return await new Promise<Blob>((res, rej) => {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), "image/jpeg", 0.9);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error("Not signed in");
    const blob = await cropTo512Square(file);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const save = async () => {
    if (!user) return;
    const name = displayName.trim();
    if (name.length < 2) {
      toast.error("Display name must be at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      let nextUrl = avatarUrl;
      if (pendingFile) {
        setUploading(true);
        nextUrl = await uploadAvatar(pendingFile);
        setUploading(false);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name, avatar_url: nextUrl })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(nextUrl);
      setPendingFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      await refreshProfile();
      toast.success("Profile updated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarUrl) return;
    const ok = window.confirm("Remove your profile photo?");
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      await refreshProfile();
      toast.success("Photo removed");
    } catch (e) {
      toast.error("Couldn't remove photo");
    } finally {
      setSaving(false);
    }
  };

  const shownSrc = previewUrl ?? avatarUrl;
  const dirty = !!pendingFile || displayName.trim() !== (profile?.display_name ?? "");

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>

        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-6 sm:p-8 shadow-[var(--shadow-card)]">
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[color:var(--neon-blue)]">
              Player Profile
            </div>
            <h1 className="font-display font-black text-3xl mt-1">Your card</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Used across lobbies, chat, and the live winner celebration.
            </p>
          </div>

          {/* Avatar preview + upload */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <PlayerAvatar
                name={displayName || profile?.display_name}
                src={shownSrc}
                size="2xl"
                glow
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[color:var(--neon-blue)] text-background border-2 border-background hover:scale-110 transition"
                aria-label="Upload photo"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              JPG / PNG / WebP · auto-cropped to square · max 4MB
            </div>
            {avatarUrl && !previewUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-destructive transition"
              >
                <Trash2 className="w-3 h-3" /> Remove photo
              </button>
            )}
          </div>

          {/* Display name */}
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Display Name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={30}
              className="mt-2 w-full bg-background border border-border rounded-md px-3 py-2.5 text-base font-display font-bold focus:outline-none focus:border-[color:var(--neon-blue)] transition"
              placeholder="Your name on the board"
            />
            <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-right">
              {displayName.length}/30
            </div>
          </label>

          <div className="mt-6">
            <NeonButton
              variant="green"
              className="w-full"
              disabled={saving || !dirty}
              onClick={save}
            >
              {saving ? "Saving..." : dirty ? "Save Profile" : "Saved"}
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
  );
}
