import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { subscribeChatMessages, subscribeInbox } from './encryptedInbox.ts';
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
