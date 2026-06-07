import { describe, it, expect } from 'vitest';
import { explainThreshold, LEAK_VS_LOSS } from './secretLiteracy.ts';

describe('secret literacy', () => {
  it('explains the choice in the live numbers, plainly', () => {
    expect(explainThreshold(3, 2)).toContain('2 of 3');
    expect(explainThreshold(3, 2)).toContain('1 of them is unreachable');
    expect(explainThreshold(5, 3)).toContain('2 of them are unreachable');
    // threshold == total: no slack, you need everyone
    expect(explainThreshold(2, 2)).toContain('every one of them');
  });

  it('keeps crypto jargon off every surface string', () => {
    const jargon = /shamir|threshold|descriptor|cryptograph/i;
    expect(explainThreshold(4, 2)).not.toMatch(jargon);
    expect(explainThreshold(7, 4)).not.toMatch(jargon);
    expect(LEAK_VS_LOSS).not.toMatch(jargon);
  });
});
