import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Database } from "../types/supabase";

// Service-role client — apps/api only, never apps/web (CLAUDE.md §A, CLAUDE2 §6).
// This key bypasses RLS entirely; every scoping rule (contractor_id, etc.)
// must be enforced in application code, not assumed from the database.
export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
