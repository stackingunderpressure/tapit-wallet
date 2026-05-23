import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import { displayNameOf, holdAndAnchor } from './createHandshake.ts';
import {
  buildMembershipDraft,
  isMembership,
  readMembership,
} from './createMembership.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

const ACCENT_BLOCK =
  'mt-4 rounded-md bg-accent/5 border border-accent/30 p-3';

interface Props {
  onClose: () => void;
}

// Phase 5b — issuing and receiving a membership. A membership is a
// credential the organization's wallet signs about a person. The
// flow is one-directional, two QR transmissions:
//   1. the recipient shows their identity — the organization scans it
//   2. the organization signs the membership and shows it — the
//      recipient scans it and holds it
// Only the organization signs, because only the organization is
// vouching. An organization is itself a wallet, so it joins a larger
// organization the same way — memberships nest for free.

type Step = 'role' | 'issue-scan' | 'issue-show' | 'receive-show' | 'done';

const eyebrow = 'text-xs uppercase tracking-wide text-accent';
const primaryBtn =
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40';

export function MembershipModal({ onClose }: Props) {
  const { wallet, ownerId, identity, anchorWorker, prefs, sendEnvelope, save } = useWallet();
  const [step, setStep] = useState<Step>('role');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<Attestation | null>(null);
  const [peerName, setPeerName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);

  async function sendMembershipViaNostr() {
    if (!membership) return;
    const view = readMembership(membership);
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const result = await sendEnvelope(view.memberId, membership);
      const status = summarizePublish(result);
      setSendStatus(status);
      if (status.tone !== 'fail') setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
    setBusy(false);
  }

  // Organization scanned the recipient's identity QR.
  function onScanIdentity(raw: string) {
    setScanning(false);
    setError(null);
    if (!identity) {
      setError('Your identity is not ready yet.');
      return;
    }
    try {
      const att = parseEnvelope(raw);
      if (att.kind !== 'identity') {
        throw new Error(
          'That code is not an identity — ask them to show their identity code.',
        );
      }
      const draft = buildMembershipDraft(identity, att);
      const signed = wallet.sign(draft);
      setMembership(signed);
      setPeerName(displayNameOf(att));
      setStep('issue-show');
    } catch (err) {
      fail(err, 'Could not read that code.');
    }
  }

  // Recipient scanned the membership credential coming back.
  async function onScanMembership(raw: string) {
    setScanning(false);
    setBusy(true);
    setError(null);
    try {
      const att = parseEnvelope(raw);
      if (!isMembership(att)) {
        throw new Error(
          'That code is not a membership — ask them to show the membership code.',
        );
      }
      const view = readMembership(att);
      if (identity && view.memberId !== identity.subject) {
        throw new Error('This membership is addressed to someone else.');
      }
      await holdAndAnchor(wallet, ownerId, anchorWorker, att);
      await save();
      setPeerName(view.orgName);
      setBusy(false);
      setStep('done');
    } catch (err) {
      fail(err, 'Could not read the membership code.');
    }
  }

  function handleScan(raw: string) {
    if (step === 'issue-scan') onScanIdentity(raw);
    else if (step === 'receive-show') onScanMembership(raw);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Membership</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step === 'role' && (
          <>
            <p className="mt-2 text-sm text-muted">
              A membership is an organization declaring that a person
              belongs to it. Are you the organization issuing one, or
              the person receiving one?
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setStep('issue-scan')}
                className={primaryBtn}
              >
                Issue a membership
              </button>
              <button
                type="button"
                onClick={() => setStep('receive-show')}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                Receive a membership
              </button>
            </div>
          </>
        )}

        {step === 'issue-scan' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Issuing — step 1 of 2</div>
            <p className="mt-1 text-sm text-muted">
              Scan the identity code of the person you are declaring a
              member of{' '}
              {identity ? displayNameOf(identity) : 'your organization'}.
            </p>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className={`mt-4 ${primaryBtn}`}
            >
              Scan their identity code
            </button>
          </>
        )}

        {step === 'issue-show' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Issuing — step 2 of 2</div>
            <p className="mt-1 text-sm text-muted">
              Show this to {peerName || 'them'}. They scan it and the
              membership lands in their wallet. Then you're done.
            </p>
            {membership && (
              <QrShow
                text={canonicalEnvelope(membership)}
                label="Membership"
              />
            )}
            {prefs.nostrTransportEnabled && membership && (
              <div className={ACCENT_BLOCK}>
                <div className="text-xs font-medium text-accent">
                  Or send via Mycelium
                </div>
                <p className="mt-1 text-xs text-muted">
                  Encrypted to {peerName || 'them'} and delivered through
                  your shared Nostr relays. They will see Accept in their
                  inbox; no scan required.
                </p>
                <button
                  type="button"
                  onClick={sendMembershipViaNostr}
                  disabled={sending || sent}
                  className="mt-2 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
                >
                  {sent
                    ? sendStatus?.label ?? 'Sent via Nostr'
                    : sending
                      ? 'Sending…'
                      : `Send to ${peerName || 'them'} via Nostr`}
                </button>
                {sendStatus && (
                  <p
                    className={`mt-2 text-xs ${
                      sendStatus.tone === 'ok'
                        ? 'text-emerald-800'
                        : sendStatus.tone === 'fail'
                          ? 'text-red-700'
                          : 'text-muted'
                    }`}
                    role="status"
                  >
                    {sendStatus.detail}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`mt-4 ${primaryBtn}`}
            >
              Done
            </button>
          </>
        )}

        {step === 'receive-show' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Receiving — step 1 of 2</div>
            <p className="mt-1 text-sm text-muted">
              Show this to the organization so they can address the
              membership to you, then scan the membership code they
              show back.
            </p>
            {identity ? (
              <QrShow
                text={canonicalEnvelope(identity)}
                label="Your identity"
              />
            ) : (
              <p className="mt-3 text-sm text-red-600">
                Your identity isn't ready yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Saving…' : 'Next: scan the membership code'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="mt-3 text-center">
            <div className={eyebrow}>Member</div>
            <h3 className="mt-1 text-lg font-semibold">
              You're a member of {peerName || 'the organization'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              The membership is signed by the organization, anchored,
              and listed under your Identity.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`mt-4 ${primaryBtn}`}
            >
              Done
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
      {scanning && (
        <QrScanModal onScanned={handleScan} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
