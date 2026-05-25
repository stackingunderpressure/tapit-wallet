import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { readHandshake } from '../connections/createHandshake.ts';
import { MessageBubble } from './MessageBubble.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { PromoteMenu } from './PromoteMenu.tsx';
import { formatBubbleHeader } from './bubbleFormat.ts';
import type { ThreadMessage } from './threadMessage.ts';
import type { PromotePayload, PromoteTarget } from './promoteTarget.ts';

interface Props {
  /** Most recent handshake between the operator and this peer. */
  handshake: Attestation;
  /** Resolved peer pubkey — derived once at the caller for stability. */
  peerPubkey: string;
  /** Peer's display name derived from the handshake. */
  peerName: string;
  onBack: () => void;
  /**
   * Sub-cut 2c — fires when the operator picks a promote target
   * from the menu. PeopleTabBody threads this up to HomeScreen
   * which routes to the matching modal (e.g. JournalComposer with
   * the moment pre-filled).
   */
  onPromote?: (payload: PromotePayload) => void;
}

// iMessage-shaped per-peer thread surface. Renders chat history
// from WalletContext.chatThreadsByPeer for the named peer, with
// the composer pinned at the bottom and a back-button header
// pinned at the top (no-dead-ends doctrine — every screen has a
// way home). Same-day messages collapse under a single
// time-of-day divider; older messages get a date divider.
//
// Sub-cut 2b ships text-only Tier 1 messaging. Sub-cut 2c will
// add the plus-menu and long-press promote-to-envelope; Cut 4
// will refactor the in-memory state to IDB-paged persistence.
export function PeerThread({ handshake, peerPubkey, peerName, onBack, onPromote }: Props) {
  const { resolvedTheme, chatThreadsByPeer, sendChatMessage } = useWallet();
  const isFresh = resolvedTheme === 'fresh';
  const messages = useMemo(
    () => chatThreadsByPeer.get(peerPubkey) ?? [],
    [chatThreadsByPeer, peerPubkey],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [promoteSource, setPromoteSource] = useState<string | null>(null);

  // Auto-scroll to bottom on new message arrival. The smooth
  // behaviour is intentional — the operator should see the new
  // message arrive, not just blink into existence.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const view = readHandshake(handshake);
  const relationship = view.relationship;
  const relationshipLabel = relationship
    ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
    : null;
  const isRemote = view.verification === 'remote';
  const tierLabel = isRemote ? 'Remote' : 'In person';

  const containerClass = isFresh
    ? 'bg-fresh-surface-base text-fresh-text-primary'
    : 'bg-paper text-ink';
  const headerClass = isFresh
    ? 'bg-fresh-surface-raised border-fresh-surface-edge'
    : 'bg-white border-ink/10';
  const backBtnClass = isFresh
    ? 'text-fresh-text-tertiary hover:text-fresh-text-primary'
    : 'text-muted hover:text-ink';
  const tierBadgeClass = isFresh
    ? isRemote
      ? 'bg-fresh-surface-glass text-fresh-text-tertiary border border-fresh-surface-edge'
      : 'bg-fresh-accent-secondary/15 text-fresh-accent-secondary border border-fresh-accent-secondary/30'
    : isRemote
      ? 'bg-ink/5 text-muted'
      : 'bg-accent/10 text-accent';
  const relationshipBadgeClass = isFresh
    ? 'bg-fresh-accent-primary/15 text-fresh-accent-primary border border-fresh-accent-primary/30'
    : 'bg-ink/[0.06] text-ink border border-ink/15';
  const dividerClass = isFresh ? 'text-fresh-text-tertiary' : 'text-muted';

  // Group messages by their "header label" (time-of-day for today,
  // date otherwise). Two consecutive messages under the same label
  // share one divider; a label change inserts a new divider.
  const now = Math.floor(Date.now() / 1000);
  const groups: { label: string; items: ThreadMessage[] }[] = [];
  for (const msg of messages) {
    const label = formatBubbleHeader(msg.ts, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(msg);
    } else {
      groups.push({ label, items: [msg] });
    }
  }

  async function handleSend(text: string) {
    await sendChatMessage(peerPubkey, text);
  }

  function openPromote(sourceText: string) {
    if (!onPromote) return;
    setPromoteSource(sourceText);
  }

  function handlePromoteSelect(target: PromoteTarget) {
    const sourceText = promoteSource ?? '';
    setPromoteSource(null);
    if (!onPromote) return;
    onPromote({
      target,
      sourceText,
      peerPubkey,
      peerName,
      relationship,
    });
  }

  return (
    <section className={`mt-5 flex flex-col rounded-2xl border overflow-hidden ${containerClass}`} style={{ minHeight: '70vh' }}>
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${headerClass}`}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to People"
          className={`text-sm ${backBtnClass}`}
        >
          ← People
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{peerName || 'Unknown'}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {relationshipLabel && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${relationshipBadgeClass}`}>
                {relationshipLabel}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tierBadgeClass}`}>
              {tierLabel}
            </span>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3" style={{ maxHeight: '60vh' }}>
        {messages.length === 0 ? (
          <div className={`text-center text-xs ${dividerClass}`}>
            No messages yet. Say hello — your message is end-to-end encrypted to {peerName || 'them'}.
          </div>
        ) : (
          groups.map((g, gi) => (
            <div key={gi} className="space-y-2">
              <div className={`text-center text-[11px] ${dividerClass}`}>{g.label}</div>
              {g.items.map((m, mi) => (
                <MessageBubble
                  key={`${gi}-${mi}-${m.eventId ?? m.ts}`}
                  message={m}
                  isFresh={isFresh}
                  onLongPress={onPromote ? (msg) => openPromote(msg.text) : undefined}
                />
              ))}
            </div>
          ))
        )}
      </div>
      <MessageComposer
        onSend={handleSend}
        isFresh={isFresh}
        placeholder={`Message ${peerName || ''}…`.trim()}
        onOpenPromote={onPromote ? openPromote : undefined}
      />
      <PromoteMenu
        sourceText={promoteSource}
        isFresh={isFresh}
        onSelect={handlePromoteSelect}
        onClose={() => setPromoteSource(null)}
      />
    </section>
  );
}
