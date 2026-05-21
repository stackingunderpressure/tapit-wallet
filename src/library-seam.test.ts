import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tapitAttest from 'tapit-attest';

// Library-seam audit — converts the verbal pre-push pattern that
// caught the entry-digest bug and the anchor-attachment bug into a
// mechanical check, per CLAUDE_ROOT.md non-negotiable #5
// ("Mechanism over prose. When a rule keeps getting missed, the fix
// is a check that fails — not another paragraph in this file") and
// the gate fence's "tapit-attest integrity: no re-implementation"
// rule.
//
// The check walks src/features and fails if any wallet function or
// exported const declaration uses a name that overlaps tapit-attest's
// runtime exports. Catches the class of bug where a Carpenter
// accidentally defines a function whose name collides with a library
// primitive — usually because they were re-implementing it from
// memory instead of importing the library version.
//
// What it does NOT catch: semantic collisions where the wallet
// re-implements a library primitive under a different name. Those
// still need eyes on the diff. But the name-collision subset is the
// dominant failure mode and this catches it without operator-attention
// cost.
//
// Allowlist exists for true unrelated-name-coincidence cases. Add a
// row + a note explaining why; do NOT silently expand it.

const here = dirname(fileURLToPath(import.meta.url));
const featuresDir = join(here, 'features');

// Runtime exports of tapit-attest. Object.keys gives only value
// exports (functions, classes, consts); type-only exports are erased
// and would not collide at the call-site that matters.
const LIBRARY_EXPORTS = new Set(Object.keys(tapitAttest));

// Names that are intentionally allowed to collide. Justify each in
// the inline comment.
const ALLOWLIST = new Set<string>([
  // (none yet — every existing wallet name is distinct from the
  // library surface, which is the property this test exists to
  // preserve)
]);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) yield* walkFiles(full);
    else if (
      (full.endsWith('.ts') || full.endsWith('.tsx')) &&
      !full.endsWith('.test.ts') &&
      !full.endsWith('.test.tsx')
    ) {
      yield full;
    }
  }
}

function findDefinitions(content: string): string[] {
  const names: string[] = [];
  // function foo(  /  async function foo(  /  export function foo(  /  export async function foo(
  const fnRe =
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  // const foo = (  /  const foo = function(  /  const foo = async  /  export const foo = (
  // (matches arrow-function and function-expression assignments; skips
  //  plain values like `const X = 5` because they aren't re-implementable
  //  surface)
  const constRe =
    /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?(?:\(|function\b)/g;
  // class Foo  /  export class Foo
  const classRe = /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  for (const re of [fnRe, constRe, classRe]) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (name) names.push(name);
    }
  }
  return names;
}

describe('library-seam audit (tapit-attest integrity)', () => {
  it('no wallet function/class definition overlaps a tapit-attest export', () => {
    const overlaps: { file: string; name: string }[] = [];
    for (const file of walkFiles(featuresDir)) {
      const content = readFileSync(file, 'utf-8');
      const localNames = findDefinitions(content);
      for (const name of localNames) {
        if (LIBRARY_EXPORTS.has(name) && !ALLOWLIST.has(name)) {
          overlaps.push({ file: relative(here, file), name });
        }
      }
    }
    expect(
      overlaps,
      [
        'Wallet code defines functions or classes whose names overlap tapit-attest exports.',
        'This usually means a library primitive is being re-implemented from memory.',
        'Either import the library function or, if the collision is intentional,',
        'add the name to ALLOWLIST in this file with a justifying comment.',
        '',
        ...overlaps.map((o) => `  - ${o.file}: ${o.name}`),
      ].join('\n'),
    ).toEqual([]);
  });
});
