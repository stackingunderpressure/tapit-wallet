// Env access for the browser bundle. Vite inlines anything prefixed
// VITE_ at build time. Missing values throw at first use, not at
// import, so a misconfigured production deploy fails loudly in the
// login flow rather than at startup before the user sees anything.

interface Env {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
    );
  }
  cached = { supabaseUrl: url, supabaseAnonKey: key };
  return cached;
}
