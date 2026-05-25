import { describe, it, expect } from 'vitest';
import { promoteToPresencePrefill } from './promoteToPresencePrefill.ts';
import type { PromotePayload } from './promoteTarget.ts';

function makePayload(over: Partial<PromotePayload> = {}): PromotePayload {
  return {
    target: 'presence',
    sourceText: 'we should mark this',
    peerPubkey: 'a'.repeat(64),
    peerName: 'Bree',
    relationship: '',
    ...over,
  };
}

describe('promoteToPresencePrefill (mark-presence promote target)', () => {
  it('passes the peer pubkey through verbatim', () => {
    const out = promoteToPresencePrefill(
      makePayload({ peerPubkey: 'd'.repeat(64) }),
    );
    expect(out.peerPubkey).toBe('d'.repeat(64));
  });

  it('passes the peer name through verbatim', () => {
    const out = promoteToPresencePrefill(makePayload({ peerName: 'Alice' }));
    expect(out.peerName).toBe('Alice');
  });

  it('deliberately drops sourceText — presence is structural, chat text is ephemera', () => {
    const out = promoteToPresencePrefill(
      makePayload({ sourceText: 'a long chat snippet' }),
    );
    expect(out).not.toHaveProperty('sourceText');
    expect(out).not.toHaveProperty('text');
  });

  it('deliberately drops relationship — presence carries with_peer_id/name, not the social label', () => {
    const out = promoteToPresencePrefill(
      makePayload({ relationship: 'spouse' }),
    );
    expect(out).not.toHaveProperty('relationship');
  });

  it('shape is exactly {peerPubkey, peerName} — no extra fields', () => {
    const out = promoteToPresencePrefill(makePayload());
    expect(Object.keys(out).sort()).toEqual(['peerName', 'peerPubkey']);
  });
});
