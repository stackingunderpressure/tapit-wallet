import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { buildSecretPieceEnvelope } from './secretPiece.ts';
import { duePieces, HEARTBEAT_INTERVAL_MS } from './secretPieceHeartbeat.ts';

function heldPiece(owner: Wallet, holder: Wallet, index: number) {
  return buildSecretPieceEnvelope(owner, {
    secretId: 'sec-1',
    secretName: 'n',
    pieceIndex: index,
    total: 3,
    threshold: 2,
    token: `tok-${index}`,
    holderPubkey: holder.identity,
    hashHex: 'h',
  });
}

describe('duePieces (heartbeat selector)', () => {
  it('flags a never-confirmed held piece as due', () => {
    const owner = Wallet.generate();
    const holder = Wallet.generate();
    const due = duePieces([heldPiece(owner, holder, 1)], holder.identity, {});
    expect(due.map((d) => d.key)).toEqual(['sec-1:1']);
  });

  it('skips a piece confirmed within the interval', () => {
    const owner = Wallet.generate();
    const holder = Wallet.generate();
    const now = Date.now();
    const due = duePieces(
      [heldPiece(owner, holder, 1)],
      holder.identity,
      { 'sec-1:1': new Date(now - 1000).toISOString() },
      now,
    );
    expect(due).toHaveLength(0);
  });

  it('flags a piece whose last confirm is older than the interval', () => {
    const owner = Wallet.generate();
    const holder = Wallet.generate();
    const now = Date.now();
    const due = duePieces(
      [heldPiece(owner, holder, 1)],
      holder.identity,
      { 'sec-1:1': new Date(now - HEARTBEAT_INTERVAL_MS - 1000).toISOString() },
      now,
    );
    expect(due).toHaveLength(1);
  });

  it('ignores pieces addressed to someone else', () => {
    const owner = Wallet.generate();
    const holderA = Wallet.generate();
    const holderB = Wallet.generate();
    const due = duePieces([heldPiece(owner, holderA, 1)], holderB.identity, {});
    expect(due).toHaveLength(0);
  });
});
