import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';

import {
  sendVaultSignResponse,
  subscribeVaultSignRequests,
  TAPIT_VAULT_SIGN_KIND,
  type IncomingVaultSignRequest,
  type VaultSignRequestPayload,
  type VaultSignResponsePayload,
} from './vaultSignChannel.ts';
import { TAPIT_ENVELOPE_KIND, buildEvent, type TransportEvent, type TransportFilter } from './nostrEvent.ts';
import { TAPIT_LIVENESS_KIND } from './livenessChannel.ts';
import type {
  PublishResult,
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// Same in-memory FakeTransport shape used by livenessChannel.test.ts /
// transport.test.ts, kept in test scope.
class FakeTransport implements Transport {
  private readonly subs = new Set<{
    filter: TransportFilter;
    onEvent: TransportEventHandler;
  }>();

  deliver(event: TransportEvent): void {
    for (const sub of this.subs) {
      if (matches(sub.filter, event)) sub.onEvent(event);
    }
  }

  async publish(event: TransportEvent): Promise<PublishResult> {
    this.deliver(event);
    return {
      eventId: event.id,
      dispatched: 1,
      accepted: ['fake://local'],
      rejected: [],
      pending: [],
    };
  }

  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription {
    const rec = { filter, onEvent };
    this.subs.add(rec);
    return {
      close: () => {
        this.subs.delete(rec);
      },
    };
  }

  close(): void {
    this.subs.clear();
  }

  relayStatus() {
    return [{ url: 'fake://local', open: true }];
  }

  subscribeStatus(handler: (s: readonly { url: string; open: boolean }[]) => void): () => void {
    handler(this.relayStatus());
    return () => {};
  }
}

function matches(filter: TransportFilter, event: TransportEvent): boolean {
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  const ptag = filter['#p'];
  if (ptag) {
    const ps = event.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
    if (!ptag.some((v: string) => ps.includes(v))) return false;
  }
  return true;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const SAMPLE_PSBT_HEX =
  '70736274ff0100550200000001aad73931018bd25f84ae400b68848be09db706eac2ac18298babee71ab656f8b0000000000ffffffff0100f2052a010000001976a914000000000000000000000000000000000000000088ac000000000000';

function requestPayload(overrides: Partial<VaultSignRequestPayload> = {}): VaultSignRequestPayload {
  return {
    v: 1,
    origin: 'DynastyTrust',
    psbt_hex: SAMPLE_PSBT_HEX,
    vault_descriptor: 'tr(...)',
    nonce: 'abc123',
    ...overrides,
  };
}

// Simulates DynastyTrust's ephemeral-sender side: raw buildEvent + a Wallet
// standing in for "encrypt with an ephemeral keypair" (the real requester
// side has no Wallet object — it uses tapit-attest's free nip44 functions
// directly — but for exercising the RECEIVE half in this repo, a Wallet
// makes an equally valid sender since nip44EncryptTo/signDigest are the
// same primitives underneath).
function makeSender(): Wallet {
  return Wallet.generate();
}

async function publishRequest(
  transport: Transport,
  sender: Wallet,
  recipientPubkey: string,
  payload: VaultSignRequestPayload,
): Promise<TransportEvent> {
  const ciphertext = sender.nip44EncryptTo(JSON.stringify(payload), recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: TAPIT_VAULT_SIGN_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
  });
  await transport.publish(event);
  return event;
}

describe('vault-sign channel — kind', () => {
  it('uses its own dedicated kind, distinct from envelope and liveness kinds', () => {
    expect(TAPIT_VAULT_SIGN_KIND).not.toBe(TAPIT_ENVELOPE_KIND);
    expect(TAPIT_VAULT_SIGN_KIND).not.toBe(TAPIT_LIVENESS_KIND);
    expect(TAPIT_VAULT_SIGN_KIND).toBe(9576);
  });
});

describe('vault-sign channel — request round-trip', () => {
  it('a request published by the requester is received, decrypted, and structurally validated by the wallet', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const payload = requestPayload();
    const event = await publishRequest(transport, requester, wallet.publicKey, payload);

    // Relay sees ciphertext only.
    expect(event.content).not.toContain('psbt_hex');
    expect(event.content).not.toContain(SAMPLE_PSBT_HEX);
    expect(event.kind).toBe(TAPIT_VAULT_SIGN_KIND);

    await waitUntil(() => received.length === 1);
    const got = received[0]!;
    expect(got.payload).toEqual(payload);
    expect(got.requesterPubkey).toBe(requester.publicKey);
  });

  it('vault_name and nonce are optional and round-trip when present', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const payload = requestPayload({ vault_name: 'Family Trust' });
    await publishRequest(transport, requester, wallet.publicKey, payload);

    await waitUntil(() => received.length === 1);
    expect(received[0]!.payload.vault_name).toBe('Family Trust');
  });
});

describe('vault-sign channel — response round-trip', () => {
  it('an approve response is received and decrypted by the original requester', async () => {
    const requester = Wallet.generate();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    // The requester side has no equivalent of subscribeVaultSignRequests
    // (that helper is wallet-side only, decrypting with a Wallet object) —
    // DynastyTrust's real subscribe-for-response uses tapit-attest's free
    // nip44 functions directly. Exercised here with a raw transport.subscribe
    // + the requester Wallet's own decrypt, which is the same underlying
    // primitive.
    const received: VaultSignResponsePayload[] = [];
    transport.subscribe(
      { kinds: [TAPIT_VAULT_SIGN_KIND], '#p': [requester.publicKey] },
      (event) => {
        void (async () => {
          const plaintext = requester.nip44DecryptFromAnyKey(event.content, event.pubkey);
          received.push(JSON.parse(plaintext) as VaultSignResponsePayload);
        })();
      },
    );

    const response: VaultSignResponsePayload = { v: 1, ok: true, nonce: 'abc123', psbt_hex: SAMPLE_PSBT_HEX };
    const { event } = await sendVaultSignResponse(transport, response, requester.publicKey, wallet);

    expect(event.content).not.toContain(SAMPLE_PSBT_HEX);
    await waitUntil(() => received.length === 1);
    expect(received[0]).toEqual(response);
  });

  it('a decline response round-trips with its reason', async () => {
    const requester = Wallet.generate();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: VaultSignResponsePayload[] = [];
    transport.subscribe(
      { kinds: [TAPIT_VAULT_SIGN_KIND], '#p': [requester.publicKey] },
      (event) => {
        void (async () => {
          const plaintext = requester.nip44DecryptFromAnyKey(event.content, event.pubkey);
          received.push(JSON.parse(plaintext) as VaultSignResponsePayload);
        })();
      },
    );

    const response: VaultSignResponsePayload = {
      v: 1,
      ok: false,
      nonce: 'abc123',
      reason: 'user_declined',
    };
    await sendVaultSignResponse(transport, response, requester.publicKey, wallet);

    await waitUntil(() => received.length === 1);
    expect(received[0]).toEqual(response);
  });
});

describe('vault-sign channel — hostile inputs are dropped silently', () => {
  it('an event with a bad OUTER signature is dropped', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const payload = requestPayload();
    const ciphertext = requester.nip44EncryptTo(JSON.stringify(payload), wallet.publicKey);
    const event = await buildEvent({
      pubkey: requester.publicKey,
      sign: (digest) => requester.signDigest(digest),
      kind: TAPIT_VAULT_SIGN_KIND,
      content: ciphertext,
      tags: [['p', wallet.publicKey]],
    });
    const broken: TransportEvent = {
      ...event,
      sig: (event.sig[0] === '0' ? '1' : '0') + event.sig.slice(1),
    };
    transport.deliver(broken);
    await flush();

    expect(received).toHaveLength(0);
  });

  it('garbage ciphertext (undecryptable) is dropped', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const event = await buildEvent({
      pubkey: requester.publicKey,
      sign: (digest) => requester.signDigest(digest),
      kind: TAPIT_VAULT_SIGN_KIND,
      content: 'not-valid-nip44-ciphertext',
      tags: [['p', wallet.publicKey]],
    });
    transport.deliver(event);

    expect(received).toHaveLength(0);
  });

  it('a well-formed but incomplete payload (missing vault_descriptor) is dropped', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const malformed = { v: 1, origin: 'DynastyTrust', psbt_hex: SAMPLE_PSBT_HEX };
    const ciphertext = requester.nip44EncryptTo(JSON.stringify(malformed), wallet.publicKey);
    const event = await buildEvent({
      pubkey: requester.publicKey,
      sign: (digest) => requester.signDigest(digest),
      kind: TAPIT_VAULT_SIGN_KIND,
      content: ciphertext,
      tags: [['p', wallet.publicKey]],
    });
    transport.deliver(event);
    await flush();

    expect(received).toHaveLength(0);
  });
});

describe('vault-sign channel — dedup', () => {
  it('a repeated request event id is delivered to the handler only once', async () => {
    const requester = makeSender();
    const wallet = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingVaultSignRequest[] = [];
    subscribeVaultSignRequests(transport, wallet, (item) => received.push(item));

    const event = await publishRequest(transport, requester, wallet.publicKey, requestPayload());
    await waitUntil(() => received.length === 1);

    transport.deliver(event);
    await flush();
    expect(received).toHaveLength(1);
  });
});
