import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// File-size guardrail — converts the CLAUDE_ROOT.md rule "Files over
// 400 lines warn, over 800 error" (lines 83-84, the Architecture
// section) into a mechanical check per non-negotiable #5
// ("Mechanism over prose. When a rule keeps getting missed, the fix
// is a check that fails — not another paragraph in this file.").
//
// The doctrine has two tiers and so does this check:
//   - over WARN_LINES (400): console.warn, test still passes — a
//     file this size is a smell, not a failure. The warning is
//     visible in `npm test` output so it does not get silently
//     ignored.
//   - over ERROR_LINES (800): the test fails. A file this large is
//     a feature that needs splitting; the doctrine says so.
//
// Total lines counted (blank + comment + code). The doctrine names
// a line count, not a statement count, so this matches it literally.
//
// Scope: the wallet's own src/ tree. The tapit-attest library has
// its own gates and is not the wallet Carpenter's review surface.
// Test files and ambient .d.ts files are excluded — they are not
// "feature modules" the doctrine's split-the-feature guidance
// applies to.

const here = dirname(fileURLToPath(import.meta.url));

const WARN_LINES = 400;
const ERROR_LINES = 800;

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

describe('file-size doctrine (CLAUDE_ROOT.md: 400 warn / 800 error)', () => {
  it('no wallet source file exceeds the 800-line hard limit', () => {
    const offenders: { file: string; lines: number }[] = [];
    const warnings: { file: string; lines: number }[] = [];

    for (const file of walkSource(here)) {
      const lines = readFileSync(file, 'utf-8').split('\n').length;
      const rel = relative(here, file);
      if (lines > ERROR_LINES) {
        offenders.push({ file: rel, lines });
      } else if (lines > WARN_LINES) {
        warnings.push({ file: rel, lines });
      }
    }

    for (const w of warnings) {
      console.warn(
        `file-size WARN: ${w.file} is ${w.lines} lines (over ${WARN_LINES}). ` +
          `Consider splitting before it reaches the ${ERROR_LINES}-line hard limit.`,
      );
    }

    expect(
      offenders,
      [
        `Source files exceed the ${ERROR_LINES}-line hard limit (CLAUDE_ROOT.md).`,
        'A file this large is a feature that needs splitting — extract',
        'components, hooks, or service modules into their own files.',
        '',
        ...offenders.map((o) => `  - ${o.file}: ${o.lines} lines`),
      ].join('\n'),
    ).toEqual([]);
  });
});
