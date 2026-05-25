import type { ThreadMessage } from './threadMessage.ts';
import { useLongPress } from './useLongPress.ts';

interface Props {
  message: ThreadMessage;
  isFresh: boolean;
  /** Fires after a tap-and-hold gesture for sub-cut 2c promote-to-envelope. */
  onLongPress?: (message: ThreadMessage) => void;
}

// One chat-thread bubble. Right-aligned with accent fill for
// outbound, left-aligned with surface fill for inbound. Long-press
// (sub-cut 2c) surfaces the promote-to-envelope menu so the
// operator can turn this message into a journal entry or other
// signed envelope.
export function MessageBubble({ message, isFresh, onLongPress }: Props) {
  const mine = message.direction === 'out';
  const align = mine ? 'justify-end' : 'justify-start';
  const bubble = mine
    ? isFresh
      ? 'bg-fresh-accent-primary text-fresh-text-inverse'
      : 'bg-ink text-paper'
    : isFresh
      ? 'bg-fresh-surface-raised text-fresh-text-primary border border-fresh-surface-edge'
      : 'bg-white text-ink border border-ink/10';

  const longPressHandlers = useLongPress(() => onLongPress?.(message));

  return (
    <div className={`flex ${align}`}>
      <div
        {...(onLongPress ? longPressHandlers : {})}
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words select-none ${bubble}`}
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        {message.text}
      </div>
    </div>
  );
}
