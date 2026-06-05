import { describe, it, expect } from 'vitest';
import { SECRET_TEMPLATES, templateById } from './secretTemplates.ts';

describe('secret templates', () => {
  it('every template is a valid co-access preset', () => {
    for (const t of SECRET_TEMPLATES) {
      // threshold >= 2 is the Shamir floor the chassis enforces.
      expect(t.threshold).toBeGreaterThanOrEqual(2);
      // total must be at least the threshold and within the picker range (2..7).
      expect(t.total).toBeGreaterThanOrEqual(t.threshold);
      expect(t.total).toBeLessThanOrEqual(7);
      // human-facing strings are present (no empty cards).
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
      expect(t.secretLabel.length).toBeGreaterThan(0);
    }
  });

  it('ids are unique and lookup works', () => {
    const ids = SECRET_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(templateById('safe-word')?.label).toBe('A family safe word');
    expect(templateById('nope')).toBeUndefined();
  });

  it('keeps crypto jargon off the user-facing strings', () => {
    const jargon = /shamir|threshold|descriptor|cryptograph/i;
    for (const t of SECRET_TEMPLATES) {
      expect(`${t.label} ${t.blurb} ${t.secretLabel}`).not.toMatch(jargon);
    }
  });
});
