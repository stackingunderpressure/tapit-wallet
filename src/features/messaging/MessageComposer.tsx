import { useState } from 'react';

interface Props {
  /** Sends the text and resolves on publish settlement. Throws on failure. */
  onSend: (text: string) => Promise<void>;
  isFresh: boolean;
  placeholder?: string;
}

// Bottom-of-thread composer. Text input + Send button. Disables
// Send while a publish is in-flight so the operator cannot fire two
// of the same message accidentally. Empty / whitespace-only sends
// are blocked at the button level. Future cuts add the plus-button
// for promote-to-envelope (sub-cut 2c) and attachment chips (Cut 4
// surface).
export function MessageComposer({ onSend, isFresh, placeholder }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const wrapperClass = isFresh
    ? 'bg-fresh-surface-raised border-fresh-surface-edge'
    : 'bg-white border-ink/10';
  const inputClass = isFresh
    ? 'bg-fresh-surface-base text-fresh-text-primary placeholder:text-fresh-text-tertiary border-fresh-surface-edge'
    : 'bg-paper text-ink placeholder:text-muted border-ink/15';
  const buttonClass = isFresh
    ? 'bg-fresh-accent-primary text-fresh-text-inverse disabled:opacity-40'
    : 'bg-ink text-paper disabled:opacity-40';

  return (
    <div className={`border-t ${wrapperClass}`}>
      {error && (
        <p className="px-4 pt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={placeholder ?? 'Message…'}
          className={`flex-1 resize-none rounded-2xl border px-3 py-2 text-sm focus:outline-none ${inputClass}`}
          style={{ maxHeight: '8rem' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || text.trim().length === 0}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${buttonClass}`}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
