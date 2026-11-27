"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared browser client: multiple createBrowserClient instances on the same
// page race on the Web Locks auth mutex and can hang an effect indefinitely
// (page stuck on the loading gate). One instance serializes session access
// safely in-process.
let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
