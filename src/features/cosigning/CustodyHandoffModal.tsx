import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { createCustodyHandoff } from './createCustodyHandoff.ts';
import { canShare, shareText } from '../../shared/lib/share.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { IdentityChip } from '../connections/IdentityChip.tsx';
import {
  displayNameOf,
  isHandshake,
  peerNamesByPubkey,
  readHandshake,
} from '../connections/createHandshake.ts';

interface Props {
  /** Pre-filled from the entry the operator was viewing. */
  subject: string;
  onClose: () => void;
}

type Step =
  | { kind: 'compose' }
  | { kind: 'signed'; signed: Attestation };

interface ContactOption {
  pubkey: string;
  name: string;
}

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
  const { wallet, ownerId, passphrase, holdings, identity } = useWallet();
  const worker = useAnchorWorker();
  const [toKey, setToKey] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'compose' });
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Build the pubkey → display-name lookup so the subject-of-the-handoff
  // chip and the contact-picker rows can resolve any pubkey the operator
  // has met to a friendly name + identicon. The subject is whatever
  // attestation is being handed off (often a journal entry's subject —
  // either the operator themselves or another wallet they recorded
  // about). The contacts are the operator's handshake-known peers,
  // surfaced as one-tap rows above the paste input so the operator
  // never has to copy-paste a 64-char hex string for a person they
  // already know — same pattern OfficialsEditorModal uses.
  const namesByPubkey = useMemo(
    () =>
      peerNamesByPubkey(
        holdings,
        wallet.identity,
        identity ? displayNameOf(identity) : undefined,
      ),
    [holdings, wallet.identity, identity],
  );

  const contacts = useMemo<ContactOption[]>(() => {
    const found: ContactOption[] = [];
    const seen = new Set<string>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      const candidates: ContactOption[] = [];
      if (v.initiatorId && v.initiatorId !== wallet.identity) {
        candidates.push({ pubkey: v.initiatorId, name: v.initiatorName || '' });
      }
      if (v.responderId && v.responderId !== wallet.identity) {
        candidates.push({ pubkey: v.responderId, name: v.responderName || '' });
      }
      for (const c of candidates) {
        const k = c.pubkey.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        found.push({ pubkey: k, name: c.name });
      }
    }
    return found;
  }, [holdings, wallet.identity]);

  function pickContact(contact: ContactOption) {
    setToKey(contact.pubkey);
  }

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
              Declare that the entry below is now custodied by another wallet.
              You sign it; they sign it back via{' '}
              <span className="font-medium">Sign someone else's entry</span>;
              the chain shows both of you as custodians at the moment of
              handoff.
            </p>
            <div className="mt-3 rounded-md border border-ink/10 bg-ink/5 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted">
                Entry subject
              </div>
              <div className="mt-1.5">
                <IdentityChip
                  pubkey={subject}
                  namesByPubkey={namesByPubkey}
                  size="md"
                />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm font-medium">New custodian</span>
              {contacts.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    From your connections
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {contacts.map((c) => {
                      const selected = c.pubkey === toKey.trim().toLowerCase();
                      return (
                        <li key={c.pubkey}>
                          <button
                            type="button"
                            onClick={() => pickContact(c)}
                            aria-pressed={selected}
                            className={`w-full text-left rounded-md border px-3 py-2 transition ${
                              selected
                                ? 'border-accent bg-accent/10'
                                : 'border-ink/15 bg-white hover:bg-ink/5'
                            }`}
                          >
                            <IdentityChip
                              pubkey={c.pubkey}
                              name={c.name}
                              size="md"
                              className="min-w-0"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 text-[10px] uppercase tracking-wide text-muted">
                    Or paste a public key
                  </div>
                </div>
              )}
              <input
                type="text"
                required
                value={toKey}
                onChange={(e) => setToKey(e.target.value)}
                placeholder="64-character hex"
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
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
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="mt-2 text-xs text-accent hover:underline"
            >
              {showQr ? 'Hide QR' : 'Show as QR code'}
            </button>
            {showQr && (
              <QrShow text={canonicalEnvelope(step.signed)} label="Custody handoff" />
            )}
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
