// Helper for invoking TanStack server functions with the user's Supabase auth
// token attached. The `requireSupabaseAuth` middleware reads the token from
// the `Authorization: Bearer ...` header, so any server function protected by
// that middleware needs this wrapper on the client.
//
// Usage:
//   const data = await invokeAuthed(myServerFn, { foo: "bar" });
//
// For unprotected server functions, just call them directly.

import { supabase } from "@/integrations/supabase/client";

type ServerFn<TInput, TOutput> = (args: { data: TInput; headers?: HeadersInit }) => Promise<TOutput>;

export async function invokeAuthed<TInput, TOutput>(
  fn: ServerFn<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("You must be signed in.");
  }
  return fn({
    data: input,
    headers: { Authorization: `Bearer ${token}` },
  });
}
