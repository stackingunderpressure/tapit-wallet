import { useEffect, useState } from 'react';
import { transportActivity, type TransportActivityEntry } from '../transport/transportActivity.ts';

// Plain-English label for the kind numbers an operator will actually see
// here -- the raw integer means nothing to a non-technical reader trying
// to answer "did anything ever arrive."
const KIND_LABELS: Record<number, string> = {
  13: 'chat (seal)',
  1059: 'chat message',
  9573: 'attestation',
  9575: 'liveness check',
  9576: 'spend request',
  9577: 'safety phrase',
  9578: 'vault invite',
  9579: 'spend request reply',
};

function kindLabel(kind: number): string {
  return KIND_LABELS[kind] ?? `kind ${kind}`;
}

// Operator, 2026-08-08: "I've never been able to receive a message...
// nothing is coming through." This surfaces transportActivity.ts's wire-
// level counter -- every event that actually reached a live subscription,
// BEFORE any app-level decrypt is attempted -- so "nothing ever arrives"
// and "something arrives but a specific channel drops it" are two
// distinguishable, checkable facts instead of one indistinguishable
// symptom. Zero here means the problem is upstream (relay delivery,
// reachability); nonzero-but-nothing-shows-up-elsewhere means the problem
// is downstream, in one specific channel's decrypt/parse/routing.
export function NostrActivitySection() {
  const [total, setTotal] = useState<number | null>(null);
  const [recent, setRecent] = useState<TransportActivityEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void transportActivity.summary().then((s) => {
        if (cancelled) return;
        setTotal(s.totalReceived);
        setRecent(s.recent);
      });
    load();
    // Live-ish without a real subscription: cheap poll while this
    // section is mounted, so watching this screen right after tapping
    // "Notify via Nostr" on the other side actually shows the counter
    // move without a manual refresh.
    const iv = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, []);

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Nostr activity</div>
      <p className="mt-1 text-sm text-muted">
        Every message that has actually reached this wallet over the network, at the wire
        level -- before any decryption is attempted. If this stays at 0 after someone sends
        you something, the message never reached this device at all.
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{total ?? '...'}</span>
        <span className="text-sm text-muted">
          {total === 1 ? 'message ever received' : 'messages ever received'}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Most recent
          </div>
          {recent.slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-muted">
              <span>{kindLabel(e.kind)}</span>
              <span>{new Date(e.receivedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {total === 0 && (
        <p className="mt-4 text-xs text-muted">
          Nothing has ever arrived on this device. If someone just sent you a message and
          this is still 0 after a few seconds, the issue is before this wallet ever sees
          it -- check "Stay reachable" above is on, and confirm the sender's message
          actually reached at least one relay on their end.
        </p>
      )}
    </section>
  );
}
