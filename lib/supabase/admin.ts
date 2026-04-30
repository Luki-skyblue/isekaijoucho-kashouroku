import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  }

  return url;
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return key;
}

export const supabaseAdmin = createClient(
  getSupabaseUrl(),
  getServiceRoleKey(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);