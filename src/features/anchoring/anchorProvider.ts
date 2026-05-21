import { OpenTimestampsProvider, type OtsProvider } from 'tapit-attest';

// Singleton provider for the whole app. tapit-attest's
// OpenTimestampsProvider already uses fetch and the real
// `a.pool.opentimestamps.org` calendar by default; we don't need
// to construct it with custom transport in production.
let cached: OtsProvider | null = null;

export function anchorProvider(): OtsProvider {
  if (!cached) cached = new OpenTimestampsProvider();
  return cached;
}
