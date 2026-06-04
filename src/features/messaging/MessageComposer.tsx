import { useState } from 'react';

interface Props {
  /**
   * Sends the text and resolves on publish settlement. Returns
   * `{}` on full success, `{ warning }` when no relay acknowledged
   * before the publish timeout (message may still land via slow
   * relays — soft amber inline note), and THROWS when every relay
   * rejected outright (hard red error). The two surfaces are
   * deliberately distinct so the operator can tell "in-flight"
   * from "outright failed."
   */
  onSend: (text: string) => Promise<{ warning?: string }>;
  isFresh: boolean;
  placeholder?: string;
  /**
   * Sub-cut 2c — opens the promote-to-envelope menu seeded with
   * whatever is currently in the composer (empty string is fine;
   * the menu still surfaces). Optional for back-compat.
   */
  onOpenPromote?: (currentText: string) => void;
}

// Bottom-of-thread composer. Text input + Send button. Disables
// Send while a publish is in-flight so the operator cannot fire two
// of the same message accidentally. Empty / whitespace-only sends
// are blocked at the button level. Future cuts add the plus-button
// for promote-to-envelope (sub-cut 2c) and attachment chips (Cut 4
// surface).
export function MessageComposer({ onSend, isFresh, placeholder, onOpenPromote }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setWarning(null);
    try {
      const result = await onSend(trimmed);
      setText('');
      if (result?.warning) setWarning(result.warning);
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
  const plusBtnClass = isFresh
    ? 'border-fresh-surface-edge text-fresh-text-tertiary hover:text-fresh-text-primary'
    : 'border-ink/15 text-muted hover:text-ink';

  return (
    <div className={`border-t ${wrapperClass}`}>
      {error && (
        <p className="px-4 pt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && warning && (
        <p className="px-4 pt-2 text-xs text-amber-600" role="status">
          {warning}
        </p>
      )}
      <div className="flex items-end gap-2 p-3">
        {onOpenPromote && (
          <button
            type="button"
            onClick={() => onOpenPromote(text)}
            aria-label="Save this message as an entry"
            className={`shrink-0 h-11 w-11 rounded-full border text-lg leading-none flex items-center justify-center transition ${plusBtnClass}`}
          >
            +
          </button>
        )}
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
