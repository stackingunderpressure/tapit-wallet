import { describe, it, expect } from 'vitest';
import { summarizePublish } from './publishStatus.ts';
import type { PublishResult } from './transport.ts';

// summarizePublish is load-bearing for the chat-send error surface
// (see WalletProvider's sendChatMessage — the fix that stops the
// operator from silently believing their message went out when
// every relay rejected it) AND for the existing cosign /
// membership / handshake modals that render the same status text
// inline. A regression here re-opens the silent-publish-failure
// bug shape, so the helper deserves its own test surface.

function makeResult(over: Partial<PublishResult> = {}): PublishResult {
  return {
    eventId: 'a'.repeat(64),
    dispatched: 0,
    accepted: [],
    rejected: [],
    pending: [],
    ...over,
  };
}

describe('summarizePublish', () => {
  it('returns fail tone with "Not sent" when no relays were configured', () => {
    const s = summarizePublish(makeResult({ dispatched: 0 }));
    expect(s.tone).toBe('fail');
    expect(s.label).toBe('Not sent');
    expect(s.detail).toMatch(/no relays/i);
  });

  it('returns ok tone with a count when every relay accepted', () => {
    const s = summarizePublish(makeResult({
      dispatched: 3,
      accepted: ['wss://a', 'wss://b', 'wss://c'],
    }));
    expect(s.tone).toBe('ok');
    expect(s.label).toMatch(/3 of 3/);
    expect(s.detail).toMatch(/every relay/i);
  });

  it('returns ok tone with a partial count when some accepted, others pending', () => {
    const s = summarizePublish(makeResult({
      dispatched: 3,
      accepted: ['wss://a'],
      pending: ['wss://b', 'wss://c'],
    }));
    expect(s.tone).toBe('ok');
    expect(s.label).toMatch(/1 of 3/);
    expect(s.detail).toMatch(/pending|did not accept/i);
  });

  it('returns ok tone when at least one accepted alongside rejections', () => {
    const s = summarizePublish(makeResult({
      dispatched: 2,
      accepted: ['wss://a'],
      rejected: [{ url: 'wss://b', reason: 'rate-limited' }],
    }));
    expect(s.tone).toBe('ok');
    expect(s.label).toMatch(/1 of 2/);
  });

  it('returns fail tone with the first rejection reason when every relay rejected', () => {
    const s = summarizePublish(makeResult({
      dispatched: 2,
      rejected: [
        { url: 'wss://a', reason: 'rate-limited' },
        { url: 'wss://b', reason: 'auth required' },
      ],
    }));
    expect(s.tone).toBe('fail');
    expect(s.label).toMatch(/rejected by every relay/i);
    expect(s.detail).toMatch(/rate-limited/);
  });

  it('returns fail tone with a generic message when rejections have no reason text', () => {
    const s = summarizePublish(makeResult({
      dispatched: 1,
      rejected: [{ url: 'wss://a', reason: '' }],
    }));
    expect(s.tone).toBe('fail');
    expect(s.label).toMatch(/rejected by every relay/i);
    // No "First reason:" suffix when the reason string is empty.
    expect(s.detail).not.toMatch(/first reason/i);
  });

  it('returns pending tone when no acks arrived but at least one relay never responded', () => {
    const s = summarizePublish(makeResult({
      dispatched: 2,
      pending: ['wss://a', 'wss://b'],
    }));
    expect(s.tone).toBe('pending');
    expect(s.label).toMatch(/no acks yet/i);
    expect(s.detail).toMatch(/may still land/i);
  });

  it('returns pending tone when one relay rejected but another never responded', () => {
    const s = summarizePublish(makeResult({
      dispatched: 2,
      rejected: [{ url: 'wss://a', reason: 'bad sig' }],
      pending: ['wss://b'],
    }));
    expect(s.tone).toBe('pending');
  });

  it('regression — chat-send relay-failure surface depends on fail-tone trigger', () => {
    // The chat-send fix in WalletProvider.sendChatMessage rips the
    // optimistic record out of the thread and throws ONLY when
    // tone is 'fail'. If a future refactor changed every-relay-
    // rejected to return any other tone, the silent-publish bug
    // returns. Lock the contract: rejected-by-every-relay → fail.
    const s = summarizePublish(makeResult({
      dispatched: 3,
      rejected: [
        { url: 'wss://a', reason: 'a' },
        { url: 'wss://b', reason: 'b' },
        { url: 'wss://c', reason: 'c' },
      ],
    }));
    expect(s.tone).toBe('fail');
  });
});
