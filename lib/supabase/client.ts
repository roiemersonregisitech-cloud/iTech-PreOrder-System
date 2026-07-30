import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for browser-side use.
 * Uses the ANON key only — all writes must go through API routes.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
