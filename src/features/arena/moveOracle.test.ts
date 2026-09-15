import { describe, it, expect } from 'vitest';
import { Wallet, generateKeypair, type Attestation } from 'tapit-attest';
import { buildGenesisDraft, buildSwitchDraft, nextSeq, headLink } from './arenaChain.ts';
import { signPriceRound } from './priceRound.ts';
import {
  readMovePriceAttestation,
  readChainPriceAttestations,
  chainPricesFullyAttested,
} from './moveOracle.ts';

const ORACLE = generateKeypair();

function mintOracleMove(
  w: Wallet,
  chain: Attestation[],
  side: 'sell' | 'buy',
  price: number,
  privateKey: string = ORACLE.privateKey,
): Attestation {
  const round = signPriceRound(
    { price, time: 1_756_900_000, source: 'coinbase+kraken', round: 1_756_900_000 },
    privateKey,
  );
  return w.attest(
    buildSwitchDraft(w.identity, {
      side,
      price,
      seq: nextSeq(chain),
      prevHash: headLink(chain),
      round,
    }),
  );
}

function mintManualMove(w: Wallet, chain: Attestation[], side: 'sell' | 'buy', price: number) {
  return w.attest(
    buildSwitchDraft(w.identity, {
      side,
      price,
      seq: nextSeq(chain),
      prevHash: headLink(chain),
      priceSource: 'market',
    }),
  );
}

describe('moveOracle — reading a move price attestation back out', () => {
  it('verifies a genuine oracle round against the expected oracle key', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintOracleMove(w, chain, 'sell', 79675));

    const a = readMovePriceAttestation(chain[1]!, ORACLE.publicKey);
    expect(a.state).toBe('attested');
    expect(a.oraclePubkey).toBe(ORACLE.publicKey);
    expect(a.source).toBe('coinbase+kraken');
    expect(a.roundTime).toBe(1_756_900_000);
  });

  it('reports attested_unpinned when the verifier has no configured oracle key', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintOracleMove(w, chain, 'sell', 79675));

    // Signature is genuine, but with nothing to pin it to, provenance is
    // unproven — anyone can mint a key and sign any price.
    expect(readMovePriceAttestation(chain[1]!).state).toBe('attested_unpinned');
  });

  it('flags a round signed by some other key as foreign, not as attested', () => {
    const w = Wallet.generate();
    const impostor = generateKeypair();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintOracleMove(w, chain, 'sell', 79675, impostor.privateKey));

    const a = readMovePriceAttestation(chain[1]!, ORACLE.publicKey);
    expect(a.state).toBe('foreign_oracle');
    expect(a.oraclePubkey).toBe(impostor.publicKey);
  });

  it('a move with no oracle fields reads as unattested, never as a pass', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintManualMove(w, chain, 'sell', 79675));

    expect(readMovePriceAttestation(chain[1]!, ORACLE.publicKey).state).toBe('unattested');
  });

  it('the genesis start move, which states no price, reads as unattested', () => {
    const w = Wallet.generate();
    const genesis = w.attest(buildGenesisDraft(w.identity));
    expect(readMovePriceAttestation(genesis, ORACLE.publicKey).state).toBe('unattested');
  });

  // The load-bearing one: the oracle signs over the round's price and the
  // builder writes that same price into the move, so editing the price the
  // move claims must break the signature. Without this the whole feature is
  // decoration.
  it('rejects a move whose price was edited after the oracle signed it', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    const move = mintOracleMove(w, chain, 'sell', 79675);

    const tampered = JSON.parse(JSON.stringify(move)) as Attestation;
    const moveBranch = tampered.claim.children.find(
      (c) => c.node === 'branch' && c.name === 'move',
    );
    if (!moveBranch || moveBranch.node !== 'branch') throw new Error('no move branch');
    const priceLeaf = moveBranch.children.find((c) => c.node === 'leaf' && c.name === 'price');
    if (!priceLeaf || priceLeaf.node !== 'leaf') throw new Error('no price leaf');
    priceLeaf.value = 99999;

    expect(readMovePriceAttestation(tampered, ORACLE.publicKey).state).toBe('bad_signature');
  });

  it('rejects a move whose oracle signature was swapped for another round', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    const move = mintOracleMove(w, chain, 'sell', 79675);
    const otherRound = signPriceRound(
      { price: 50000, time: 1_756_900_000, source: 'coinbase+kraken', round: 1_756_900_000 },
      ORACLE.privateKey,
    );

    const tampered = JSON.parse(JSON.stringify(move)) as Attestation;
    const moveBranch = tampered.claim.children.find(
      (c) => c.node === 'branch' && c.name === 'move',
    );
    if (!moveBranch || moveBranch.node !== 'branch') throw new Error('no move branch');
    const sigLeaf = moveBranch.children.find((c) => c.node === 'leaf' && c.name === 'oracle_sig');
    if (!sigLeaf || sigLeaf.node !== 'leaf') throw new Error('no oracle_sig leaf');
    sigLeaf.value = otherRound.sig;

    expect(readMovePriceAttestation(tampered, ORACLE.publicKey).state).toBe('bad_signature');
  });

  it('treats a partial set of oracle fields as incomplete, not as attested', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    const move = mintOracleMove(w, chain, 'sell', 79675);

    const stripped = JSON.parse(JSON.stringify(move)) as Attestation;
    const moveBranch = stripped.claim.children.find(
      (c) => c.node === 'branch' && c.name === 'move',
    );
    if (!moveBranch || moveBranch.node !== 'branch') throw new Error('no move branch');
    moveBranch.children = moveBranch.children.filter(
      (c) => !(c.node === 'leaf' && c.name === 'oracle_time'),
    );

    expect(readMovePriceAttestation(stripped, ORACLE.publicKey).state).toBe('incomplete');
  });

  it('matches the oracle key case-insensitively', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintOracleMove(w, chain, 'sell', 79675));

    expect(readMovePriceAttestation(chain[1]!, ORACLE.publicKey.toUpperCase()).state).toBe(
      'attested',
    );
  });

  it('does not call an old but genuine round stale', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    const ancient = signPriceRound(
      { price: 30000, time: 1_300_000_000, source: 'coinbase', round: 1_300_000_000 },
      ORACLE.privateKey,
    );
    chain.push(
      w.attest(
        buildSwitchDraft(w.identity, {
          side: 'sell',
          price: 30000,
          seq: nextSeq(chain),
          prevHash: headLink(chain),
          round: ancient,
        }),
      ),
    );

    expect(readMovePriceAttestation(chain[1]!, ORACLE.publicKey).state).toBe('attested');
  });
});

describe('moveOracle — whole-chain views', () => {
  it('reads one attestation per move, in chain order', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    chain.push(mintOracleMove(w, chain, 'sell', 79675));
    chain.push(mintManualMove(w, chain, 'buy', 76299.8));

    const states = readChainPriceAttestations(chain, ORACLE.publicKey).map((a) => a.state);
    expect(states).toEqual(['unattested', 'attested', 'unattested']);
  });

  it('chainPricesFullyAttested passes only when every priced move is attested', () => {
    const w = Wallet.generate();
    const good = [w.attest(buildGenesisDraft(w.identity))];
    good.push(mintOracleMove(w, good, 'sell', 79675));
    good.push(mintOracleMove(w, good, 'buy', 76299.8));
    expect(chainPricesFullyAttested(good, ORACLE.publicKey)).toBe(true);

    const mixed = [w.attest(buildGenesisDraft(w.identity))];
    mixed.push(mintOracleMove(w, mixed, 'sell', 79675));
    mixed.push(mintManualMove(w, mixed, 'buy', 76299.8));
    expect(chainPricesFullyAttested(mixed, ORACLE.publicKey)).toBe(false);
  });

  it('a chain with no priced moves at all is not "fully attested"', () => {
    const w = Wallet.generate();
    const chain = [w.attest(buildGenesisDraft(w.identity))];
    expect(chainPricesFullyAttested(chain, ORACLE.publicKey)).toBe(false);
  });
});
