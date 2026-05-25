import type { ThreadMessage } from './threadMessage.ts';

interface Props {
  message: ThreadMessage;
  isFresh: boolean;
}

// One chat-thread bubble. Right-aligned with accent fill for
// outbound, left-aligned with surface fill for inbound. The wallet's
// design language reuses for both themes — Classic ink/paper, Fresh
// accent/glass.
export function MessageBubble({ message, isFresh }: Props) {
  const mine = message.direction === 'out';
  const align = mine ? 'justify-end' : 'justify-start';
  const bubble = mine
    ? isFresh
      ? 'bg-fresh-accent-primary text-fresh-text-inverse'
      : 'bg-ink text-paper'
    : isFresh
      ? 'bg-fresh-surface-raised text-fresh-text-primary border border-fresh-surface-edge'
      : 'bg-white text-ink border border-ink/10';
  return (
    <div className={`flex ${align}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${bubble}`}
      >
        {message.text}
      </div>
    </div>
  );
}

