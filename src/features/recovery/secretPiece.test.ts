import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import {
  buildSecretPieceEnvelope,
  isSecretPiece,
  readSecretPiece,
  decryptHeldPiece,
  buildSecretPieceReceipt,
  isSecretPieceReceipt,
  readSecretPieceReceipt,
} from './secretPiece.ts';

describe('secret-piece envelope (owner -> holder)', () => {
  function ownerAndHolder() {
    return { owner: Wallet.generate(), holder: Wallet.generate() };
  }

  it('round-trips fields and only the holder can decrypt the token', () => {
    const { owner, holder } = ownerAndHolder();
    const token = 'tapit-secret.v1.abc123';
    const env = buildSecretPieceEnvelope(owner, {
      secretId: 'sec-1',
      secretName: 'House Wi-Fi',
      pieceIndex: 2,
      total: 3,
      threshold: 2,
      token,
      holderPubkey: holder.identity,
      hashHex: 'deadbeef',
      ownerName: 'Tom',
    });

    expect(isSecretPiece(env)).toBe(true);
    const view = readSecretPiece(env);
    expect(view.ownerId).toBe(owner.identity);
    expect(view.ownerName).toBe('Tom');
    expect(view.secretId).toBe('sec-1');
    expect(view.secretName).toBe('House Wi-Fi');
    expect(view.pieceIndex).toBe(2);
    expect(view.threshold).toBe(2);
    expect(view.total).toBe(3);
    expect(view.pieceFor).toBe(holder.identity);
    expect(view.hash).toBe('deadbeef');

    // The holder decrypts back to the exact token.
    expect(decryptHeldPiece(holder, env)).toBe(token);
    // A different wallet cannot.
    expect(() => decryptHeldPiece(Wallet.generate(), env)).toThrow();
  });

  it('rejects a non-hex holder pubkey', () => {
    const owner = Wallet.generate();
    expect(() =>
      buildSecretPieceEnvelope(owner, {
        secretId: 's',
        secretName: 'n',
        pieceIndex: 1,
        total: 2,
        threshold: 2,
        token: 't',
        holderPubkey: 'not-hex',
        hashHex: 'h',
      }),
    ).toThrow();
  });
});

describe('secret-piece-receipt (holder -> owner)', () => {
  it('round-trips a held receipt', () => {
    const owner = Wallet.generate();
    const holder = Wallet.generate();
    const r = buildSecretPieceReceipt(holder, {
      secretId: 'sec-1',
      pieceIndex: 2,
      ownerPubkey: owner.identity,
      status: 'held',
    });
    expect(isSecretPieceReceipt(r)).toBe(true);
    const view = readSecretPieceReceipt(r);
    expect(view.holderId).toBe(holder.identity);
    expect(view.secretId).toBe('sec-1');
    expect(view.pieceIndex).toBe(2);
    expect(view.status).toBe('held');
    expect(view.receiptFor).toBe(owner.identity);
    expect(view.confirmedAt.length).toBeGreaterThan(0);
  });

  it('round-trips a declined receipt', () => {
    const owner = Wallet.generate();
    const holder = Wallet.generate();
    const r = buildSecretPieceReceipt(holder, {
      secretId: 'sec-1',
      pieceIndex: 1,
      ownerPubkey: owner.identity,
      status: 'declined',
    });
    expect(readSecretPieceReceipt(r).status).toBe('declined');
  });
});
