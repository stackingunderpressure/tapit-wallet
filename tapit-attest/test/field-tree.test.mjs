import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leaf,
  branch,
  treeFromObject,
  fieldTreeRoot,
  findLeafValue,
  disclosureProof,
} from '../dist/index.js';

test('leaf and branch build the expected node shapes', () => {
  assert.deepEqual(leaf('label', 'Ada'), { node: 'leaf', name: 'label', value: 'Ada' });
  const b = branch('root', [leaf('a', 1)]);
  assert.equal(b.node, 'branch');
  assert.equal(b.children.length, 1);
});

test('treeFromObject is deterministic regardless of key insertion order', () => {
  const a = treeFromObject('claim', { name: 'Ada', role: 'pioneer' });
  const b = treeFromObject('claim', { role: 'pioneer', name: 'Ada' });
  assert.deepEqual(Buffer.from(fieldTreeRoot(a)), Buffer.from(fieldTreeRoot(b)));
});

test('changing any field changes the Merkle root', () => {
  const base = treeFromObject('claim', { name: 'Ada' });
  const edited = treeFromObject('claim', { name: 'Grace' });
  assert.notDeepEqual(Buffer.from(fieldTreeRoot(base)), Buffer.from(fieldTreeRoot(edited)));
});

test('nested objects become branches and resolve by path', () => {
  const tree = treeFromObject('claim', { fields: { label: 'Ada', tier: 3 } });
  assert.equal(findLeafValue(tree, 'fields/label'), 'Ada');
  assert.equal(findLeafValue(tree, ['fields', 'tier']), 3);
  assert.equal(findLeafValue(tree, 'fields/missing'), undefined);
  assert.equal(findLeafValue(tree, 'fields'), undefined);
});

test('disclosureProof is a v1.1 slot and throws', () => {
  assert.throws(() => disclosureProof(), /v1\.1 slot/);
});
