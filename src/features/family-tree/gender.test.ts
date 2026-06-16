import { describe, it, expect } from 'vitest';
import { genderKinLabel } from './gender.ts';

describe('genderKinLabel', () => {
  it('genders the direct line', () => {
    expect(genderKinLabel('parent', 'female')).toBe('mother');
    expect(genderKinLabel('parent', 'male')).toBe('father');
    expect(genderKinLabel('child', 'female')).toBe('daughter');
    expect(genderKinLabel('child', 'male')).toBe('son');
    expect(genderKinLabel('sibling', 'female')).toBe('sister');
    expect(genderKinLabel('sibling', 'male')).toBe('brother');
    expect(genderKinLabel('spouse', 'female')).toBe('wife');
    expect(genderKinLabel('spouse', 'male')).toBe('husband');
  });

  it('genders grandparents and grandchildren with great- prefixes', () => {
    expect(genderKinLabel('grandparent', 'female')).toBe('grandmother');
    expect(genderKinLabel('grandparent', 'male')).toBe('grandfather');
    expect(genderKinLabel('great-grandparent', 'male')).toBe('great-grandfather');
    expect(genderKinLabel('great-great-grandparent', 'female')).toBe(
      'great-great-grandmother',
    );
    expect(genderKinLabel('grandchild', 'female')).toBe('granddaughter');
    expect(genderKinLabel('great-grandchild', 'male')).toBe('great-grandson');
  });

  it('genders aunt/uncle and niece/nephew, keeping grand-/great- prefixes', () => {
    expect(genderKinLabel('aunt/uncle', 'female')).toBe('aunt');
    expect(genderKinLabel('aunt/uncle', 'male')).toBe('uncle');
    expect(genderKinLabel('grand-aunt/uncle', 'female')).toBe('grand-aunt');
    expect(genderKinLabel('great-grand-aunt/uncle', 'male')).toBe(
      'great-grand-uncle',
    );
    expect(genderKinLabel('niece/nephew', 'male')).toBe('nephew');
    expect(genderKinLabel('grand-niece/nephew', 'female')).toBe('grand-niece');
  });

  it('genders the -in-law forms', () => {
    expect(genderKinLabel('sibling-in-law', 'female')).toBe('sister-in-law');
    expect(genderKinLabel('parent-in-law', 'male')).toBe('father-in-law');
    expect(genderKinLabel('child-in-law', 'female')).toBe('daughter-in-law');
    expect(genderKinLabel('aunt/uncle by marriage', 'male')).toBe(
      'uncle by marriage',
    );
  });

  it('leaves cousins and unknown labels unchanged', () => {
    expect(genderKinLabel('1st cousin', 'female')).toBe('1st cousin');
    expect(genderKinLabel('2nd cousin 1x removed', 'male')).toBe(
      '2nd cousin 1x removed',
    );
    expect(genderKinLabel('you', 'female')).toBe('you');
    expect(genderKinLabel('relative', 'male')).toBe('relative');
  });

  it('returns the neutral label when sex is unset', () => {
    expect(genderKinLabel('parent')).toBe('parent');
    expect(genderKinLabel('grandparent', undefined)).toBe('grandparent');
    expect(genderKinLabel('aunt/uncle')).toBe('aunt/uncle');
  });
});
