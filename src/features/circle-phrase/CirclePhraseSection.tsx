import { useEffect, useState } from 'react';
import { listCirclePhrasePairs, type CirclePhraseStatus } from './circlePhrase.ts';

function shortDescriptor(d: string): string {
  if (d.length <= 24) return d;
  return `${d.slice(0, 12)}…${d.slice(-8)}`;
}

// Durable status view -- unlike CirclePhraseReceiver's transient
// just-arrived toast, this reads what's actually stored, any time the
// operator opens Settings. Never shows a phrase or a hash; only which
// vaults have a pair, when it arrived, and whether a wrong-guess lockout
// is currently active.
export function CirclePhraseSection() {
  const [pairs, setPairs] = useState<CirclePhraseStatus[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listCirclePhrasePairs().then((p) => {
      if (!cancelled) setPairs(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pairs === null || pairs.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Circle safety phrases</div>
      <p className="mt-1 text-sm text-muted">
        A vault owner can send this wallet a normal phrase and a duress phrase, used to verify
        a live phone call before you approve a spend. Both are stored only as a locked hash on
        this device -- never as plain text, and never sent anywhere.
      </p>
      <ul className="mt-3 space-y-2">
        {pairs.map((p) => (
          <li
            key={p.vaultDescriptor}
            className="rounded-lg border border-ink/10 bg-paper px-3 py-2 text-sm"
          >
            <div className="font-medium">{p.vaultName || shortDescriptor(p.vaultDescriptor)}</div>
            <div className="mt-0.5 text-xs text-muted">
              Received {new Date(p.receivedAt).toLocaleDateString()}
              {p.locked ? ' — locked after too many wrong guesses, try again shortly' : ''}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
