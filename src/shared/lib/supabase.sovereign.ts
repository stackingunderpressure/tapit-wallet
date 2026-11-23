// Stand-in for supabase.ts in the sovereign build (vite.config.ts alias). The
// sovereign build has no hosted database or sign-in, and the Supabase SDK is
// not in its bundle (scripts/check-no-supabase.mjs). Any code path that still
// reaches for the cloud fails loudly here instead of silently talking to a
// server.
export function supabase(): never {
  throw new Error('This wallet runs without a cloud service; nothing was sent anywhere.');
}
