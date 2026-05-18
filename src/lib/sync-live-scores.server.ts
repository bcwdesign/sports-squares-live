// Server-only re-exports for the public cron endpoint.
export { runSync } from "./balldontlie.server";
export { supabaseAdmin as supabaseAdminForSync } from "@/integrations/supabase/client.server";
