import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { subscribeChatMessages, subscribeInbox } from './encryptedInbox.ts';
import { buildGiftWrap, unwrapGiftWrap, NIP17_CHAT_RUMOR_KIND } from './nip17.ts';
import type { Transport } from './transport.ts';

// Regression for the operator's 2026-05-31 bug: after rotating to a new
// signing key, chat went silent. The cause was the subscription filter
// listening only on the wallet's ACTIVE key (recipient.publicKey). A
// peer who connected before the rotation still addresses gift-wraps to
// the wallet's pre-rotation key in the #p tag, so those messages never
// matched the filter and never reached the wallet — even though the
// library's nip44DecryptFromAnyKey could have opened them. The fix
// subscribes on recipient.keyHistory (genesis + every rotated key).
//
// These tests use a structural transport mock cast through `unknown` so
// they exercise the real filter construction without depending on the
// concrete Transport implementation.

function captureFilter(): {
  transport: Transport;
  filter: () => Record<string, unknown> | null;
} {
  let captured: Record<string, unknown> | null = null;
  const transport = {
    subscribe: (f: Record<string, unknown>) => {
      captured = f;
      return { close() {} };
    },
  } as unknown as Transport;
  return { transport, filter: () => captured };
}

describe('subscribeChatMessages key-rotation regression', () => {
  it('subscribes on every key in keyHistory, not just the active key', () => {
    const wallet = Wallet.generate();
    const genesis = wallet.publicKey;
    wallet.rotate();
    const active = wallet.publicKey;
    expect(active).not.toBe(genesis);

    const { transport, filter } = captureFilter();
    subscribeChatMessages(transport, wallet, () => {});

    const p = filter()?.['#p'] as string[];
    expect(p).toContain(genesis); // pre-rotation peers address this
    expect(p).toContain(active); // post-rotation peers address this
    expect(p).toEqual(wallet.keyHistory);
  });

  it('a never-rotated wallet still subscribes on its single key', () => {
    const wallet = Wallet.generate();
    const { transport, filter } = captureFilter();
    subscribeChatMessages(transport, wallet, () => {});
    const p = filter()?.['#p'] as string[];
    expect(p).toEqual([wallet.publicKey]);
  });
});

describe('subscribeInbox key-rotation regression', () => {
  it('envelope delivery also covers every historical key', () => {
    const wallet = Wallet.generate();
    const genesis = wallet.publicKey;
    wallet.rotate();
    const active = wallet.publicKey;

    const { transport, filter } = captureFilter();
    subscribeInbox(transport, wallet, () => {});

    const p = filter()?.['#p'] as string[];
    expect(p).toContain(genesis);
    expect(p).toContain(active);
  });
});

// The decrypt half of the rotation fix: delivery (filter) is necessary
// but not sufficient — once an old-key gift-wrap arrives, the wallet
// must still be able to OPEN it. Before the keypair-retention change,
// rotate() discarded the old private key and these decryptions threw.
describe('gift-wrap decrypt across rotation', () => {
  it('a recipient who rotated AFTER a peer addressed them still reads the message', async () => {
    const recipient = Wallet.generate();
    const oldKey = recipient.publicKey;
    const peer = Wallet.generate();

    // Peer builds a gift-wrap to the recipient's CURRENT (soon-to-be-old) key.
    const rumor = {
      pubkey: peer.publicKey,
      created_at: 1_700_000_000,
      kind: NIP17_CHAT_RUMOR_KIND as typeof NIP17_CHAT_RUMOR_KIND,
      tags: [['p', oldKey]] as ReadonlyArray<readonly string[]>,
      content: 'sent before you rotated',
    };
    const giftWrap = await buildGiftWrap(rumor, oldKey, peer);

    // Recipient rotates, THEN the message arrives.
    recipient.rotate();
    expect(recipient.publicKey).not.toBe(oldKey);

    const unwrapped = await unwrapGiftWrap(giftWrap, recipient);
    expect(unwrapped).not.toBeNull();
    expect(unwrapped?.text).toBe('sent before you rotated');
    expect(unwrapped?.senderPubkey).toBe(peer.publicKey);
  });

  it('messages to the current key still unwrap (common path unaffected)', async () => {
    const recipient = Wallet.generate();
    const peer = Wallet.generate();
    const rumor = {
      pubkey: peer.publicKey,
      created_at: 1_700_000_000,
      kind: NIP17_CHAT_RUMOR_KIND as typeof NIP17_CHAT_RUMOR_KIND,
      tags: [['p', recipient.publicKey]] as ReadonlyArray<readonly string[]>,
      content: 'current key',
    };
    const giftWrap = await buildGiftWrap(rumor, recipient.publicKey, peer);
    const unwrapped = await unwrapGiftWrap(giftWrap, recipient);
    expect(unwrapped?.text).toBe('current key');
  });

  it('retired keypairs survive a snapshot round-trip so the fix persists across reload', async () => {
    const recipient = Wallet.generate();
    const oldKey = recipient.publicKey;
    const peer = Wallet.generate();
    const rumor = {
      pubkey: peer.publicKey,
      created_at: 1_700_000_000,
      kind: NIP17_CHAT_RUMOR_KIND as typeof NIP17_CHAT_RUMOR_KIND,
      tags: [['p', oldKey]] as ReadonlyArray<readonly string[]>,
      content: 'survives reload',
    };
    const giftWrap = await buildGiftWrap(rumor, oldKey, peer);
    recipient.rotate();

    // Simulate save + reload: snapshot → JSON → fromSnapshot.
    const snap = JSON.parse(JSON.stringify(await recipient.snapshot()));
    const reloaded = await Wallet.fromSnapshot(snap);

    const unwrapped = await unwrapGiftWrap(giftWrap, reloaded);
    expect(unwrapped?.text).toBe('survives reload');
  });
});
