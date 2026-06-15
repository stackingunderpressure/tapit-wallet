import { describe, it, expect } from 'vitest';
import { explainRelationship } from './kinEducation.ts';

describe('explainRelationship', () => {
  it('covers the everyday labels', () => {
    expect(explainRelationship('you')).toContain('you');
    expect(explainRelationship('parent')).toContain('mother or father');
    expect(explainRelationship('child')).toContain('son or daughter');
    expect(explainRelationship('sibling')).toContain('share a parent');
    expect(explainRelationship('spouse')).toContain('partner');
  });

  it('explains the direct line with generation counts', () => {
    expect(explainRelationship('grandparent')).toContain('2 generations up');
    expect(explainRelationship('great-grandparent')).toContain(
      '3 generations up',
    );
    expect(explainRelationship('great-great-grandparent')).toContain(
      '4 generations up',
    );
    expect(explainRelationship('grandchild')).toContain('2 generations down');
  });

  it('explains aunt/uncle and niece/nephew lines', () => {
    expect(explainRelationship('aunt/uncle')).toContain('sibling of your parent');
    expect(explainRelationship('grand-aunt/uncle')).toContain(
      'sibling of your grandparent',
    );
    expect(explainRelationship('niece/nephew')).toContain(
      "sibling's child",
    );
  });

  it('teaches the cousin math', () => {
    expect(explainRelationship('1st cousin')).toContain('a grandparent');
    expect(explainRelationship('2nd cousin')).toContain('a great-grandparent');
    const removed = explainRelationship('1st cousin 1x removed');
    expect(removed).toContain('a grandparent');
    expect(removed).toContain('1 generation apart');
  });

  it('explains in-laws and marriage ties', () => {
    expect(explainRelationship('sibling-in-law')).toContain('spouse');
    expect(explainRelationship('parent-in-law')).toContain('parent of your spouse');
    expect(explainRelationship('1st cousin by marriage')).toContain('marriage');
  });

  it('falls back gracefully for anything unrecognized', () => {
    expect(explainRelationship('something weird')).toBe('A relative of yours.');
  });
});
