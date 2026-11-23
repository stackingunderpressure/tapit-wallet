import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrangerMessages } from './InboxScreen.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rows = [
  { peerPubkey: 'b1c7d279aa', name: 'b1c7d279…ba20', lastText: 'I saw your profile. Catch me here: https://scam.example', lastTs: Date.now(), count: 1 },
  { peerPubkey: 'f5399d6caa', name: 'f5399d6c…2fa1', lastText: "I'm online right now", lastTs: Date.now(), count: 2 },
];

function mount(onDelete = vi.fn()) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<StrangerMessages rows={rows} onDelete={onDelete} />));
  return { el, onDelete };
}

describe('Inbox messages from strangers', () => {
  it('labels them as unknown senders and warns they are usually spam', () => {
    const { el } = mount();
    expect(el.textContent).toContain("From people you haven't connected with (2)");
    expect(el.textContent).toContain('could be a scammer');
    expect(el.textContent).toContain('Not a contact');
    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(el.textContent).toContain('Unknown sender b1c7d279…ba20');
  });

  it('opens a message on tap as plain text with no clickable link', () => {
    const { el } = mount();
    const row = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('b1c7d279'))!;
    act(() => row.click());
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('https://scam.example');
    expect(el.querySelector('a')).toBeNull();
  });

  it('delete blocks that one sender; delete all blocks every one', () => {
    const { el, onDelete } = mount();
    const row = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('f5399d6c'))!;
    act(() => row.click());
    act(() => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Delete and block')!.click());
    expect(onDelete).toHaveBeenCalledWith('f5399d6caa');
    act(() => [...el.querySelectorAll('button')].find((b) => b.textContent === 'Delete and block all')!.click());
    expect(onDelete).toHaveBeenCalledWith('b1c7d279aa');
  });
});
