import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { disclosureProof } from 'tapit-attest';
import { leafIndex } from './leafIndex.ts';

interface Props {
  attestation: Attestation;
  onClose: () => void;
}

type Step =
  | { kind: 'pick' }
  | { kind: 'generated'; path: string; json: string };

// "Share a proof" flow. The operator picks one leaf out of the
// attestation's claim tree and the wallet calls disclosureProof to
// produce a bundle they can hand to any verifier — text, AirDrop,
// posted on a website, scanned via QR (later polish). The bundle
// is plain JSON. The verifier pastes it into /verify on their copy
// of the wallet PWA and the math checks itself.

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

export function ShareProofModal({ attestation, onClose }: Props) {
  const leaves = useMemo(() => leafIndex(attestation.claim), [attestation]);
  const [path, setPath] = useState<string>(leaves[0]?.path ?? '');
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    if (!path) {
      setError('pick a field to disclose');
      return;
    }
    setError(null);
    try {
      const bundle = disclosureProof(attestation, path);
      const json = JSON.stringify(bundle, null, 2);
      setStep({ kind: 'generated', path, json });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not generate proof');
    }
  }

  async function copy() {
    if (step.kind !== 'generated') return;
    await navigator.clipboard.writeText(step.json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Share a proof</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step.kind === 'pick' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Pick one field to reveal. The verifier gets a proof that this
              field belongs to this signed entry, without seeing any other
              field on the entry.
            </p>
            {leaves.length === 0 ? (
              <p className="mt-3 text-sm">This entry has no disclosable fields.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {leaves.map((l) => (
                  <label
                    key={l.path}
                    className="flex items-start gap-3 rounded-md border border-ink/15 bg-white px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="leaf"
                      checked={path === l.path}
                      onChange={() => setPath(l.path)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-muted break-words">
                        {asString(l.value)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={generate}
              disabled={!path}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              Generate proof
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        {step.kind === 'generated' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Copy this proof and send it to whoever needs to verify the field{' '}
              <span className="font-medium">{step.path}</span>. They paste it
              into <span className="font-mono">/verify</span> on this same
              wallet site to check it.
            </p>
            <textarea
              readOnly
              value={step.json}
              rows={8}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
              >
                {copied ? 'Copied' : 'Copy proof'}
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: 'pick' })}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
