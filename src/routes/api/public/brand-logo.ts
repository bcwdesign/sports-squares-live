// Serves a game's uploaded brand logo publicly.
//
// The brand-logos bucket is private (public buckets are disabled for this
// workspace), so the file is streamed here through the server. Only paths that
// match the `<uuid>/<file>` upload convention are accepted, and only image
// bytes are returned.

import { createFileRoute } from "@tanstack/react-router";

const PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,120}$/;

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export const Route = createFileRoute("/api/public/brand-logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        if (!PATH_RE.test(path)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("brand-logos").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        const type = data.type && ALLOWED.has(data.type) ? data.type : "image/png";
        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
