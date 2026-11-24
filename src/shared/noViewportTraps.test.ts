import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// No pop-up window may hide its own buttons below the phone's browser bars.
// Operator, 2026-11-24 (DynastyTrust's recovery-phrase window, same pattern
// here): "it gets stuck down there you can't find the button to keep going.
// Need to rethink that bug and anything similar anywhere else." Panels were
// capped at max-h-[90vh]; on a phone vh is measured with the bars hidden, so
// the bottom of the panel sat under them. dvh follows the bars. Several
// dialogs had no cap at all.

const root = join(__dirname, '..');
function files(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f) ? [p] : [];
  });
}

describe('no viewport traps', () => {
  const all = files(root);

  it('no height or max-height in vh (use dvh)', () => {
    const bad = all.flatMap((f) =>
      readFileSync(f, 'utf8').split('\n').flatMap((l, i) =>
        /\b(max-)?h-\[\d+(\.\d+)?vh\]/.test(l) || /\b(max)?[hH]eight:\s*['"`]\d+(\.\d+)?vh/.test(l) ? [`${f.slice(root.length)}:${i + 1}`] : [],
      ),
    );
    expect(bad).toEqual([]);
  });

  it('every full-screen overlay scrolls itself or holds a panel capped in dvh that scrolls', () => {
    const bad: string[] = [];
    for (const f of all) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (!/fixed inset-0/.test(l) || /^\s*(\/\/|\*)/.test(l)) return; // not comments
        if (/overflow-y-auto/.test(l)) return; // a full page that scrolls
        const after = lines.slice(i, i + 25).join('\n');
        if (/max-h-\[\d+dvh\][^"`]*overflow-y-auto|overflow-y-auto[^"`]*max-h-\[\d+dvh\]/.test(after)) return;
        if (/absolute inset-0/.test(lines.slice(i, i + 6).join('\n')) && /max-h-\[\d+dvh\]/.test(after)) return;
        bad.push(`${f.slice(root.length)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
