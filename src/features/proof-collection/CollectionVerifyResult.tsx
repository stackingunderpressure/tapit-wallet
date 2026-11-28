import { useEffect, useMemo, useState } from 'react';
import { envelopeId } from 'tapit-attest';
import { readBundleAnchor, verifyProofAnchor, type AnchorCheck } from '../disclosure/verifyProofAnchor.ts';
import { shortKey } from '../connections/identityChipHelpers.ts';
import { checkCollection, type ProofCollection } from './proofBundle.ts';

/**
 * What the other person sees: each letter checked on THEIR device -- who
 * signed (the shower's label is shown as the shower's word), whether every
 * signature is genuine, and when it was dated in Bitcoin. No summary, no
 * score. "Maybe you show me proof I see it and decide."
 */
export function CollectionVerifyResult({ collection }: { collection: ProofCollection }) {
  const letters = useMemo(() => checkCollection(collection), [collection]);
  const [anchors, setAnchors] = useState<Record<number, AnchorCheck>>({});

  useEffect(() => {
    let live = true;
    letters.forEach((l, i) => {
      const a = readBundleAnchor(l.envelope.anchor);
      if (!l.genuine || !a) return;
      setAnchors((m) => ({ ...m, [i]: { state: 'checking' } }));
      void verifyProofAnchor(envelopeId(l.envelope), a).then((c) => live && setAnchors((m) => ({ ...m, [i]: c })));
    });
    return () => {
      live = false;
    };
  }, [letters]);

  const who = collection.holderName ?? 'Someone';
  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <h2 className="text-base font-semibold">
          {who} showed you {letters.length} {letters.length === 1 ? 'letter' : 'letters'}
        </h2>
        <p className="mt-1 text-sm text-muted">Each one is checked on this device. Whether it is enough is up to you.</p>
      </div>
      {letters.map((l, i) => {
        const anchor = anchors[i];
        return (
          <article key={i} className={`rounded-2xl bg-white border p-4 shadow-sm ${l.genuine ? 'border-ink/10' : 'border-red-300'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted">{l.kindLabel}</span>
              <span className="text-xs text-muted">{l.issuedAt ? new Date(l.issuedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : ''}</span>
            </div>
            {!l.genuine ? (
              <p className="mt-2 text-sm font-medium text-red-700">This letter was changed after it was signed, or its signature is not real. Do not rely on it.</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {l.fields.map((f) => (
                    <li key={f.name} className="text-sm">
                      <span className="text-muted">{f.name}:</span> {f.value}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  Signed by{' '}
                  {l.signers.map((s, n) => (
                    <span key={s.key}>
                      {n > 0 ? ', ' : ''}
                      {s.holderSays ? (
                        <>
                          <b>{s.holderSays}</b> <span className="text-muted">({who}'s name for them, key {shortKey(s.key)})</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs">{shortKey(s.key)}</span>
                      )}
                    </span>
                  ))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full bg-accent/10 text-accent px-2.5 py-1">✓ Really signed by them</span>
                  <AnchorChip check={anchor} />
                  {!l.aboutHolder && <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">Not about {who}</span>}
                </div>
              </>
            )}
          </article>
        );
      })}
      <p className="px-1 text-xs text-muted leading-relaxed">
        A letter proves who signed it and when. It does not prove it is true. If you do not know a signer, it is only a name to you.
      </p>
    </section>
  );
}

function AnchorChip({ check }: { check: AnchorCheck | undefined }) {
  if (!check || check.state === 'none') {
    return <span className="rounded-full bg-ink/5 text-muted px-2.5 py-1">No Bitcoin date: the date is the signer's word</span>;
  }
  if (check.state === 'checking') return <span className="rounded-full bg-ink/5 text-muted px-2.5 py-1">Checking the Bitcoin date…</span>;
  if (check.state === 'pending') return <span className="rounded-full bg-ink/5 text-muted px-2.5 py-1">Bitcoin date still confirming</span>;
  if (check.state === 'confirmed') {
    return <span className="rounded-full bg-accent/10 text-accent px-2.5 py-1">✓ Dated in Bitcoin, block {check.btcHeight.toLocaleString()}</span>;
  }
  return <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1">Bitcoin date does not match: {check.reason}</span>;
}
