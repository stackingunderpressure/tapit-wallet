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

/**
 * The Beat the HODL price oracle, if one is configured. Optional — the
 * arena works with a hand-entered price when this is absent, and only
 * offers a verified "fetch signed price" when both the endpoint and the
 * oracle's public key are set. Never throws: returns null when unset.
 */
export function arenaOracle(): { url: string; pubkey: string } | null {
  const url = import.meta.env.VITE_ARENA_ORACLE_URL;
  const pubkey = import.meta.env.VITE_ARENA_ORACLE_PUBKEY;
  if (!url || !pubkey) return null;
  return { url, pubkey };
}
