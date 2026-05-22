import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keys-never-leave guardrail — a mechanical check for the wallet's
// #1 non-negotiable (CLAUDE_ROOT.md: "The user's keys never leave
// the wallet unencrypted ... This rule outranks every other rule").
// The gate fence names a "keys-never-leave audit" as a rule that
// matters enough to enforce; per non-negotiable #5 ("Mechanism over
// prose ... the fix is a check that fails") this converts the
// verbal audit into a check.
//
// What it catches — the dominant developer-mistake class:
//   1. A console.* call that passes a secret-named identifier
//      (privateKey / passphrase / seed / mnemonic / secretKey).
//      This is the "I added a debug log" leak.
//   2. localStorage / sessionStorage .setItem with a secret
//      identifier. This is the "I stashed the passphrase to make
//      something convenient" leak — web storage is plaintext and
//      survives the session.
//
// What it does NOT catch — documented gaps, not silent ones:
//   - "Transmits": a fetch / Supabase call that puts a raw secret
//     on the wire. This is hard to mechanize without heavy false
//     positives. It is instead structurally prevented by the
//     storage-layer design — every byte that reaches the network
//     goes through tapit-attest's encrypt() first, and the
//     EncryptedBlob is the only shape walletStore / remoteStore /
//     remoteMediaStore ever send. Any new network code that
//     bypasses that pattern is load-bearing review surface per
//     the gate fence.
//   - Indirect leaks: console.log(wallet) where the Wallet object
//     transitively holds the keypair. The secret-name regex won't
//     see "wallet". This check covers the by-name case; the
//     by-object case still needs eyes on the diff.
//
// The check is a heuristic, deliberately tuned for low false
// positives — it matches console/storage calls that literally
// pass a secret-named token, not every line that mentions one.

const here = dirname(fileURLToPath(import.meta.url));

// Identifiers that name secret material the wallet must never log
// or persist to plaintext web storage.
const SECRET_NAMES = ['privateKey', 'passphrase', 'seed', 'mnemonic', 'secretKey'];
const SECRET_GROUP = `(?:${SECRET_NAMES.join('|')})`;

// console.<method>( ... <secret> ... ) — bounded by `;` so the
// match cannot span statements.
const CONSOLE_LEAK = new RegExp(
  String.raw`console\s*\.\s*(?:log|warn|error|info|debug|trace)\s*\([^;]*?\b${SECRET_GROUP}\b`,
);

// (local|session)Storage.setItem( ... <secret> ... )
const WEB_STORAGE_LEAK = new RegExp(
  String.raw`(?:local|session)Storage\s*\.\s*setItem\s*\([^;]*?\b${SECRET_GROUP}\b`,
);

function* walkSource(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      yield* walkSource(full);
      continue;
    }
    const isSource = full.endsWith('.ts') || full.endsWith('.tsx');
    const isTest = full.endsWith('.test.ts') || full.endsWith('.test.tsx');
    const isAmbient = full.endsWith('.d.ts');
    if (isSource && !isTest && !isAmbient) {
      yield full;
    }
  }
}

interface Finding {
  file: string;
  line: number;
  kind: 'console' | 'web-storage';
  text: string;
}

function scan(content: string, rel: string): Finding[] {
  const out: Finding[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (CONSOLE_LEAK.test(line)) {
      out.push({ file: rel, line: i + 1, kind: 'console', text: line.trim() });
    }
    if (WEB_STORAGE_LEAK.test(line)) {
      out.push({ file: rel, line: i + 1, kind: 'web-storage', text: line.trim() });
    }
  }
  return out;
}

describe('keys-never-leave guardrail (CLAUDE_ROOT.md non-negotiable #1)', () => {
  it('no source file logs or web-stores a secret-named value', () => {
    const findings: Finding[] = [];
    for (const file of walkSource(here)) {
      const content = readFileSync(file, 'utf-8');
      findings.push(...scan(content, relative(here, file)));
    }
    expect(
      findings,
      [
        'Keys-never-leave violation — non-negotiable #1, the rule that',
        'outranks every other rule in CLAUDE_ROOT.md.',
        '',
        'A secret-named value (privateKey / passphrase / seed / mnemonic /',
        'secretKey) is being logged to the console or written to plaintext',
        'web storage. The wallet never logs, never persists unencrypted.',
        'Remove the log, or if a value MUST be stored, encrypt it client-',
        'side via tapit-attest first.',
        '',
        ...findings.map(
          (f) => `  - ${f.file}:${f.line} (${f.kind}): ${f.text}`,
        ),
      ].join('\n'),
    ).toEqual([]);
  });
});
