// Company logo upload for game branding. Stores the file in the private
// brand-logos bucket under the uploader's user id and returns the public
// streaming URL used by the board.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function LogoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!user) {
      toast.error("Sign in to upload a logo");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use a PNG, JPG or WebP image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be 5 MB or smaller");
      return;
    }

    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("brand-logos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      onChange(`/api/public/brand-logo?path=${encodeURIComponent(path)}`);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        aria-label="Upload company logo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-16 w-32 rounded-xl border border-border bg-white/92 flex items-center justify-center p-2">
            <img src={value} alt="Company logo preview" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="px-3 py-2 rounded-lg border border-border text-xs font-mono uppercase tracking-widest hover:border-[color:var(--neon-blue)] transition"
            >
              {uploading ? "Uploading..." : "Replace logo"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="px-3 py-2 rounded-lg border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground hover:border-destructive hover:text-destructive transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="w-full py-6 rounded-xl border border-dashed border-border hover:border-[color:var(--neon-blue)] transition flex flex-col items-center gap-2 text-muted-foreground"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          <span className="font-mono text-[10px] uppercase tracking-widest">
            {uploading ? "Uploading..." : "Upload company logo"}
          </span>
          <span className="text-[10px] text-muted-foreground/70">PNG, JPG or WebP · max 5 MB · transparent preferred</span>
        </button>
      )}
    </div>
  );
}
