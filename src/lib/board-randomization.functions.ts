// NFL board randomization server functions. Thin file: createServerFn only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Host-triggered "Randomize & Lock Board Now". The server owns the outcome. */
export const randomizeAndLockBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertGameAdmin, finalizeBoard } = await import("./board-randomization.server");
    await assertGameAdmin(data.gameId, context.userId);
    return finalizeBoard(data.gameId, context.userId, "manual");
  });

/** High-friction reset of a randomized board, host only, before kickoff. */
export const resetRandomizedBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ gameId: z.string().uuid(), confirm: z.literal("RESET") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertGameAdmin, resetBoard } = await import("./board-randomization.server");
    await assertGameAdmin(data.gameId, context.userId);
    const res = await resetBoard(data.gameId, context.userId);
    console.log(
      `[board-randomization] reset game=${data.gameId} by=${context.userId} result=${res.reason}`,
    );
    return res;
  });
