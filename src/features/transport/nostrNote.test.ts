import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import {
  buildNoteEvent,
  noteTextFromEntry,
  NOSTR_NOTE_KIND,
} from './nostrNote.ts';
import { verifyEvent } from './nostrEvent.ts';

describe('noteTextFromEntry', () => {
  it('joins title and body with a blank line', () => {
    expect(noteTextFromEntry({ title: 'Hello', text: 'world' })).toBe(
      'Hello\n\nworld',
    );
  });

  it('uses body alone when there is no title', () => {
    expect(noteTextFromEntry({ text: 'just a body' })).toBe('just a body');
  });

  it('uses title alone when there is no body', () => {
    expect(noteTextFromEntry({ title: 'just a title' })).toBe('just a title');
  });

  it('trims surrounding whitespace', () => {
    expect(noteTextFromEntry({ title: '  Hi  ', text: '  there  ' })).toBe(
      'Hi\n\nthere',
    );
  });

  it('returns null when there is nothing to publish', () => {
    expect(noteTextFromEntry({})).toBeNull();
    expect(noteTextFromEntry({ title: '   ', text: '  ' })).toBeNull();
  });
});

describe('buildNoteEvent', () => {
  it('produces a verifiable kind-1 note signed by the wallet', async () => {
    const wallet = Wallet.generate();
    const event = await buildNoteEvent(wallet, 'gm nostr', {
      created_at: 1_700_000_000,
    });
    expect(event.kind).toBe(NOSTR_NOTE_KIND);
    expect(event.pubkey).toBe(wallet.publicKey);
    expect(event.content).toBe('gm nostr');
    expect(await verifyEvent(event)).toBe(true);
  });

  it('publishes content verbatim, including newlines', async () => {
    const wallet = Wallet.generate();
    const event = await buildNoteEvent(wallet, 'line 1\n\nline 2');
    expect(event.content).toBe('line 1\n\nline 2');
  });
});
