import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.ts';

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cached) {
    const { supabaseUrl, supabaseAnonKey } = env();
    cached = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cached;
}
