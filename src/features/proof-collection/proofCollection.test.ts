import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { lettersInWallet } from './letters.ts';
import { buildCollection, checkCollection, parseCollection } from './proofBundle.ts';

const tom = Wallet.generate();
const jim = Wallet.generate();
const pat = Wallet.generate();

function letterFrom(signer: Wallet, about: Wallet, text: string) {
  return signer.attest({ kind: 'credential', tier: 'routine', subject: about.identity, fields: { statement: text, known_since: '2016' } });
}

describe('letters you carry', () => {
  it('counts only records someone else signed', () => {
    const mineOnly = tom.attest({ kind: 'journal', tier: 'routine', subject: tom.identity, fields: { text: 'my day' } });
    const fromJim = letterFrom(jim, tom, 'He worked for me three years. Honest man.');
    const confirmed = jim.sign(mineOnly);
    const letters = lettersInWallet([mineOnly, fromJim, confirmed], tom.keyHistory);
    expect(letters).toHaveLength(2);
    expect(letters.every((l) => l.others.includes(jim.publicKey.toLowerCase()))).toBe(true);
    expect(letters.find((l) => l.attestation === fromJim)?.fields).toEqual(
      expect.arrayContaining([
        { name: 'statement', value: 'He worked for me three years. Honest man.' },
        { name: 'known since', value: '2016' },
      ]),
    );
  });

  it('round-trips a shared bundle and checks each letter on the reader’s device', () => {
    const fromJim = letterFrom(jim, tom, 'Honest man.');
    const c = buildCollection({ holder: tom.identity, holderKeys: tom.keyHistory, holderName: 'Tom', letters: [fromJim], namesByPubkey: new Map([[jim.publicKey.toLowerCase(), 'Jim Doe']]) });
    const back = parseCollection(JSON.stringify(c))!;
    const [l] = checkCollection(back);
    expect(l!.genuine).toBe(true);
    expect(l!.aboutHolder).toBe(true);
    expect(l!.signers).toEqual([{ key: jim.publicKey.toLowerCase(), holderSays: 'Jim Doe' }]);
  });

  it('catches a letter changed after signing, and one about somebody else', () => {
    const fromJim = letterFrom(jim, tom, 'Honest man.');
    const edited = JSON.parse(JSON.stringify(fromJim));
    edited.claim.children[0].value = 'Saint.';
    const aboutPat = letterFrom(jim, pat, 'Pat is great.');
    const [a, b] = checkCollection(buildCollection({ holder: tom.identity, holderKeys: tom.keyHistory, letters: [edited, aboutPat] }));
    expect(a!.genuine).toBe(false);
    expect(a!.fields).toEqual([]);
    expect(b!.genuine).toBe(true);
    expect(b!.aboutHolder).toBe(false);
  });

  it('ignores anything that is not a bundle', () => {
    expect(parseCollection('hello')).toBeNull();
    expect(parseCollection(JSON.stringify({ type: 'other' }))).toBeNull();
  });
});
