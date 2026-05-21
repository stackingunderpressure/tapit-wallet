import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { createCustodyHandoff } from './createCustodyHandoff.ts';
import { canShare, shareText } from '../../shared/lib/share.ts';

interface Props {
  /** Pre-filled from the entry the operator was viewing. */
  subject: string;
  onClose: () => void;
}

type Step =
  | { kind: 'compose' }
  | { kind: 'signed'; signed: Attestation };

// Custody-handoff modal. The current custodian fills in the new
// custodian's pubkey and an optional note, the wallet builds a
// meta-kind attestation (action='custody_handoff', from=ownKey,
// to=newKey, transferred_at=now), signs it, holds it, queues it
// for anchoring, and renders the canonical envelope JSON for the
// operator to send to the new custodian.
//
// The new custodian co-signs via CosignAsWitnessModal — the exact
// same paste-→preview-→sign flow used for any witness signature.
// The originator absorbs the return via AbsorbCosignModal. Once
// both signatures are present, the chain "X was custodied by A
// from time T1; from time T2, X is custodied by B" is multi-
// signed and OTS-anchored.
export function CustodyHandoffModal({ subject, onClose }: Props) {
  const { wallet, ownerId, passphrase } = useWallet();
  const worker = useAnchorWorker();
  const [toKey, setToKey] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'compose' });
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = toKey.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      setError("New custodian pubkey must be 64 hex characters (32 bytes).");
      return;
    }
    if (trimmed === wallet.publicKey) {
      setError("You cannot hand off to yourself.");
      return;
    }
    setBusy(true);
    try {
      const result = await createCustodyHandoff(
        wallet,
        ownerId,
        passphrase,
        worker,
        { subject, toKey: trimmed, note },
      );
      setStep({ kind: 'signed', signed: result.attestation });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign the handoff.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (step.kind !== 'signed') return;
    await navigator.clipboard.writeText(canonicalEnvelope(step.signed));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (step.kind !== 'signed') return;
    const outcome = await shareText({
      title: 'Tapit Wallet — custody handoff',
      text: canonicalEnvelope(step.signed),
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Hand off custody</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step.kind === 'compose' ? (
          <form onSubmit={submit}>
            <p className="mt-2 text-sm text-muted">
              Declare that <span className="font-medium">{subject}</span> is
              now custodied by another wallet. You sign it; they sign it back
              via <span className="font-medium">Sign someone else's entry</span>;
              the chain shows both of you as custodians at the moment of
              handoff.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">New custodian's pubkey</span>
              <input
                type="text"
                required
                value={toKey}
                onChange={(e) => setToKey(e.target.value)}
                placeholder="64-character hex (x-only secp256k1)"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Note (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Anything you want recorded with this handoff."
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Signing handoff…' : 'Sign handoff'}
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Signed. Send this to the new custodian; they paste it into{' '}
              <span className="font-medium">Sign someone else's entry</span> on
              their wallet, then send back the signed version for you to
              absorb via <span className="font-medium">Add a co-signer's
              signature</span>.
            </p>
            <textarea
              readOnly
              value={canonicalEnvelope(step.signed)}
              rows={8}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <div className="mt-3 flex gap-2 flex-wrap">
              {canShare() && (
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
                >
                  Share handoff envelope
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className={`${canShare() ? '' : 'flex-1'} rounded-md ${
                  canShare() ? 'border border-ink/15' : 'bg-ink text-paper'
                } px-4 py-2 text-sm font-medium`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
