import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import {
  familySignatureProgress,
  memberHasSigned,
  readFamilyUnit,
} from './familyUnit.ts';
import {
  displayNameOf,
  holdAndAnchor,
  peerNamesByPubkey,
} from './createHandshake.ts';
import { IdentityChip } from './IdentityChip.tsx';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

// Member-side family-unit ratification surface (operator authorization
// 2026-05-27, fourth cut on the family-mode arc). The founder signs
// and ships a family-unit envelope to each named member via Mycelium;
// envelopeRoute.ts routes the arrival on a member's wallet to this
// modal. The member reviews the family graph, confirms they accept the
// named role, and signs. The signed envelope is held locally (so the
// member's wallet has the family record too — PeopleTree v2 can branch
// the family node from any member's angle) and sent back to the
// founder. The founder's wallet absorbs the cosignature via the
// existing absorb-cosign route, which works on family-unit envelopes
// out of the box because AbsorbCosignModal is envelope-kind-agnostic.
//
// Pattern follows VouchWitnessModal almost exactly — the cryptography
// is identical (wallet.sign appending a signature to an envelope) and
// the send-back is the same encryptedInbox transport. The framing
// differs: a vouch is a personal warrant, a family ratification is an
// acknowledgement of being named in a family unit. The operator-
// facing question is "do you accept being named [your role] in
// [family name]?", so the modal foregrounds the role + family name +
// who else is in it before the sign action.

interface Props {
  /** The founder-signed (or partly-cosigned) family-unit envelope.
   *  The receiver is named in members[] and has not yet signed. */
  incoming: Attestation;
  /** Pubkey of the wallet that pushed this envelope into the inbox.
   *  Kept for parity with the other inbox-routed modals but unused for
   *  the send-back destination — that's the envelope subject (the
   *  founder), not whoever forwarded the envelope. */
  incomingSender?: string;
  /** Fires once the send-back-via-Mycelium step completes so the
   *  routing host can dismiss the matching inbox row. */
  onSuccess?: () => void;
  onClose: () => void;
}

type Step =
  | { kind: 'review' }
  | { kind: 'signed'; signed: Attestation };

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function FamilyRatifyModal({
  incoming,
  incomingSender: _incomingSender,
  onSuccess,
  onClose,
}: Props) {
  const { wallet, ownerId, holdings, identity, save, refresh, sendEnvelope } =
    useWallet();
  const anchorWorker = useAnchorWorker();
  const view = readFamilyUnit(incoming);
  const myIdentity = wallet.identity.toLowerCase();
  const myMember = view.members.find(
    (m) => m.pubkey.toLowerCase() === myIdentity,
  );
  const namesByPubkey = useMemo(
    () =>
      peerNamesByPubkey(
        holdings,
        wallet.identity,
        identity ? displayNameOf(identity) : undefined,
      ),
    [holdings, wallet.identity, identity],
  );
  // Bridge the operator's rotated keys to their genesis pubkey so the
  // per-member signed/unsigned display stays honest on the founder's
  // identity (which is in members[]) even when the operator has rotated.
  // FamilyIdentitySections does the same thing on the founder side.
  const keyAliases = useMemo<ReadonlyMap<string, readonly string[]>>(() => {
    const m = new Map<string, readonly string[]>();
    m.set(myIdentity, wallet.keyHistory.map((k) => k.toLowerCase()));
    return m;
  }, [myIdentity, wallet.keyHistory]);
  const progress = familySignatureProgress(incoming, keyAliases);
  const signers = useMemo(
    () => new Set(incoming.signatures.map((s) => s.signer.toLowerCase())),
    [incoming.signatures],
  );

  const [step, setStep] = useState<Step>({ kind: 'review' });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);

  async function sign() {
    setError(null);
    try {
      // wallet.sign wraps tapit-attest's signEnvelope using the active
      // key. Signatures are deduped by signer pubkey so this is
      // idempotent if the operator ratifies twice for any reason. Hold
      // and anchor the signed copy locally so the member's wallet has
      // the family record persisted — PeopleTree v2 can branch a
      // family node from any member's angle once that lands, and the
      // member's wallet can absorb later cosignatures from other
      // members via the existing AbsorbCosignModal pathway.
      const signed = wallet.sign(incoming);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      await refresh();
      setStep({ kind: 'signed', signed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
    }
  }

  async function sendBack() {
    if (step.kind !== 'signed') return;
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      // Send-back destination is the envelope subject — the founder.
      // The relay-peer who forwarded the envelope is irrelevant; the
      // founder is the one who needs the cosignature so the founder-
      // side progress chip ticks up.
      const result = await sendEnvelope(view.founderId, step.signed);
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

  const founderKey = view.founderId.trim().toLowerCase();
  const founderLabel =
    namesByPubkey.get(founderKey) ?? view.founderName ?? shortKey(view.founderId);
  const familyName = view.familyName || 'an unnamed family';

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
          <h2 className="text-base font-semibold">Ratify family</h2>
          <div className="w-12" aria-hidden />
        </div>

        {step.kind === 'review' && (
          <>
            <div className="mt-2 rounded-2xl border border-accent/40 bg-accent/5 p-4">
              <div className="text-xs uppercase tracking-wide text-accent">
                Family ratification
              </div>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{founderLabel}</span> named you
                in their family{' '}
                <span className="font-semibold">{familyName}</span>
                {myMember ? (
                  <>
                    {' '}as{' '}
                    <span className="font-semibold">{myMember.role}</span>
                    {myMember.as_of ? (
                      <span className="text-muted"> · since {myMember.as_of}</span>
                    ) : null}
                  </>
                ) : null}
                .
              </p>
              <p className="mt-2 text-xs text-muted">
                Ratifying attaches your signature to the family-unit
                envelope. Your wallet holds a copy too, and the founder
                receives your signature back so the family card shows
                you as ratified. Only sign if you accept being named —
                this is a public statement.
              </p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-muted">
                  Members ({view.members.length})
                </h3>
                <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {progress.signed} of {progress.total} signed
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {view.members.map((m) => {
                  const signed = memberHasSigned(m.pubkey, signers, keyAliases);
                  const isMe = m.pubkey.toLowerCase() === myIdentity;
                  return (
                    <li
                      key={m.pubkey}
                      className={`rounded-md border px-3 py-2 ${
                        isMe
                          ? 'border-accent/40 bg-accent/5'
                          : 'border-ink/15 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <IdentityChip
                          pubkey={m.pubkey}
                          name={m.name}
                          namesByPubkey={namesByPubkey}
                          size="sm"
                          hideShortKey
                        />
                        {isMe && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-accent">
                            You
                          </span>
                        )}
                      </div>
                      <div className="ml-10 -mt-1 text-[10px] uppercase tracking-wide text-muted">
                        {m.role}
                        {m.as_of ? ` · since ${m.as_of}` : ''}
                        {signed ? (
                          <span className="text-emerald-700"> · signed</span>
                        ) : (
                          <span className="text-amber-700"> · awaiting signature</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={sign}
                disabled={!myMember}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                I confirm — sign and ratify
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Not now
              </button>
            </div>
            {!myMember && (
              <p className="mt-2 text-xs text-amber-700" role="alert">
                You are not named in this family unit — there is nothing for
                you to ratify.
              </p>
            )}
          </>
        )}

        {step.kind === 'signed' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Ratified and held in your wallet. Send your signature back to{' '}
              <span className="font-medium">{founderLabel}</span> so their copy
              shows you as ratified.
            </p>
            <button
              type="button"
              onClick={sendBack}
              disabled={sending || sent}
              className="mt-3 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
            >
              {sent
                ? sendStatus?.label ?? 'Sent'
                : sending
                  ? 'Sending…'
                  : 'Send ratification back'}
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
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm"
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
