// Sovereign-build check (SOVEREIGN_SYNC_PLAN.md section 8): the bundle must
// contain no Supabase client. Run after `vite build --mode sovereign`; fails
// the build if any marker of the SDK is found in an emitted file. Checked by
// a script, not by eye.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
// Strings the Supabase SDK always carries (auth, database and storage clients).
const MARKERS = ['GoTrueClient', 'PostgrestClient', 'StorageFileApi', 'supabase-js', 'sb-access-token', '.supabase.co'];

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const hits = [];
for (const f of files(DIST)) {
  if (!/\.(js|html|json|webmanifest)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of MARKERS) if (text.includes(m)) hits.push(`${f}: ${m}`);
}
if (hits.length) {
  console.error('Sovereign build still contains Supabase code:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log('Sovereign build: no Supabase code in the bundle.');
