import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { EnvelopePreview } from './EnvelopePreview.tsx';
import { readSelfMembership } from '../connections/createMembership.ts';
import {
  peerNamesByPubkey,
  displayNameOf,
} from '../connections/createHandshake.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { canShare, shareText } from '../../shared/lib/share.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

interface Props {
  /** The joiner's 1-signature self-membership envelope. The peer's
   *  signature attaches as a vouch (an attestation of personal trust)
   *  alongside the joiner's own signature; the cosigned envelope rides
   *  back to the joiner who absorbs it via AbsorbCosignModal and then
   *  forwards the vouched bundle to the org for the join-policy gate. */
  incoming: Attestation;
  /** Pubkey of the wallet that pushed this envelope into the inbox.
   *  Recorded for parity with CosignAsWitnessModal but the send-back
   *  destination is the joiner (envelope subject), not whoever
   *  forwarded the envelope on the way to this peer. The joiner is
   *  the one who needs to absorb the cosignature. */
  incomingSender?: string;
  /** Fires once the send-back-via-Mycelium step completes so the
   *  routing host can dismiss the matching inbox row. */
  onSuccess?: () => void;
  onClose: () => void;
}

type Step =
  | { kind: 'review' }
  | { kind: 'signed'; signed: Attestation };

// A vouching peer received the joiner's 1-signature self-membership
// envelope through the Mycelium transport (or via QR). The envelope
// asks the peer to attest personal trust by attaching their signature,
// which the org's requires_vouch join-policy will count at the org-
// receive gate. This surface is the peer-facing other half of the
// vouch loop the joiner-side CosignRequestModal (org_vouch variant)
// fans out — the joiner asks N peers to vouch; this modal is what
// each of those N peers sees when the request lands.
//
// The framing is deliberately about personal trust rather than co-
// authorship. A handshake co-sign means "we agree on this fact about
// our relationship together"; a vouch means "I personally know this
// person and warrant their joining this organization." The two signing
// mechanics are identical at the cryptography layer (wallet.sign on an
// existing envelope, append a signature) but the operator-facing
// question is different — so this modal lives separate from
// CosignAsWitnessModal even though the substrate is shared.
//
// The signed envelope sends back via the same encryptedInbox transport
// the joiner uses for everything else. Destination is the joiner's
// pubkey (the envelope subject), not necessarily incomingSender — a
// hypothetical relay-peer who forwarded the envelope is not the
// absorb-target. The joiner's AbsorbCosignModal then merges the
// vouch into their held copy and the joiner-side progress chip ticks
// up by one.
export function VouchWitnessModal({
  incoming,
  incomingSender: _incomingSender,
  onSuccess,
  onClose,
}: Props) {
  const { wallet, holdings, identity, sendEnvelope } = useWallet();
  const view = readSelfMembership(incoming);
  const joinerNames = peerNamesByPubkey(
    holdings,
    wallet.identity,
    identity ? displayNameOf(identity) : undefined,
  );
  const joinerKey = view.joinerId.trim().toLowerCase();
  const hasJoinerRelationship = joinerNames.has(joinerKey);
  const joinerLabel = joinerNames.get(joinerKey) ?? shortKey(view.joinerId);

  const [step, setStep] = useState<Step>({ kind: 'review' });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);

  function vouch() {
    setError(null);
    try {
      const signed = wallet.sign(incoming);
      setStep({ kind: 'signed', signed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
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
      title: 'Tapit Wallet — vouch signature',
      text: canonicalEnvelope(step.signed),
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function sendBack() {
    if (step.kind !== 'signed') return;
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const result = await sendEnvelope(view.joinerId, step.signed);
      const status = summarizePublish(result);
      setSendStatus(status);
      if (status.tone !== 'fail') {
        setSent(true);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto">
      <div className="w-full max-w-md mx-auto p-5">
        <div className="flex items-center justify-between mb-3 -mx-5 px-5 py-2 sticky top-0 bg-paper/95 backdrop-blur z-10">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
            aria-label="Back"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold">Vouch for a friend</h2>
          <div className="w-12" aria-hidden />
        </div>

        {step.kind === 'review' && (
          <>
            <div className="mt-2 rounded-2xl border border-accent/40 bg-accent/5 p-4">
              <div className="text-xs uppercase tracking-wide text-accent">
                Vouch request
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{joinerLabel}</span> is asking
                you to vouch for them joining{' '}
                <span className="font-semibold">
                  {view.orgName || 'an organization'}
                </span>
                .
              </p>
              <p className="mt-2 text-xs text-muted">
                Vouching means putting your name behind them — you know
                this person and you stand by their joining. The group counts
                your vouch toward what it needs to let them in. Only do this
                if you genuinely know and trust them; it's a public statement
                that you vouch for them.
              </p>
            </div>
            {!hasJoinerRelationship && (
              <div
                className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                role="alert"
              >
                <span className="font-semibold">
                  You're not connected with this person yet.
                </span>{' '}
                Vouching means putting your name behind who they are, so
                make sure you really know them before you do.
              </div>
            )}
            <div className="mt-3">
              <EnvelopePreview attestation={incoming} />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={vouch}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
              >
                Vouch for them
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Not now
              </button>
            </div>
          </>
        )}

        {step.kind === 'signed' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Signed. Send your vouch back to {joinerLabel} so they can
              add it to their join request. The wallet sends through
              the same encrypted transport that brought the request to
              you.
            </p>
            <button
              type="button"
              onClick={sendBack}
              disabled={sending || sent}
              className="mt-3 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
            >
              {sent
                ? sendStatus?.label ?? 'Vouch sent'
                : sending
                  ? 'Sending…'
                  : 'Send vouch back'}
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
            <div className="mt-3 flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="text-accent hover:underline"
              >
                {showQr ? 'Hide QR' : 'Show as QR code'}
              </button>
              <button
                type="button"
                onClick={() => setShowEnvelope((v) => !v)}
                className="text-accent hover:underline"
              >
                {showEnvelope ? 'Hide envelope code' : 'Show envelope code'}
              </button>
            </div>
            {showQr && (
              <QrShow text={canonicalEnvelope(step.signed)} label="Signed vouch" />
            )}
            {showEnvelope && (
              <textarea
                readOnly
                value={canonicalEnvelope(step.signed)}
                rows={6}
                className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
              />
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              {canShare() && (
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
                >
                  Share signed vouch
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

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}
