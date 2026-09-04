/**
 * Sovereign build flavor — one repo, two builds.
 *
 * The hosted build (default) is what ships at tapit-wallet.netlify.app. The
 * sovereign build is the stripped package a person runs entirely in their own
 * environment (the north-star: no Supabase, your key is your identity, nothing
 * leaves except encrypted Nostr messages — see AppCommander's tapit-wallet
 * CONSOLIDATED_MEMORY.md). Both come from THIS repo; only two thin edges (auth
 * + sync) differ, gated on this flag so the shared core never forks.
 *
 * `npm run build:sovereign` runs Vite with `--mode sovereign`, which loads
 * `.env.sovereign` (VITE_SOVEREIGN=1) on top of the base env. Vite inlines
 * `import.meta.env.VITE_SOVEREIGN` at build time, so `isSovereign()` folds to a
 * compile-time constant the tree-shaker can use to drop whole branches from the
 * bundle. In the hosted build the flag is unset, so it is simply `false`.
 */

/** Pure parse of the raw flag value — kept separate so it's trivially tested. */
export function parseSovereignFlag(v: unknown): boolean {
  return v === '1' || v === 'true' || v === true;
}

/** True only in the sovereign build. Compile-time constant after Vite inlines. */
export function isSovereign(): boolean {
  return parseSovereignFlag(import.meta.env.VITE_SOVEREIGN);
}
