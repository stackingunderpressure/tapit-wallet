import { confirmFaceId } from '../face-unlock/confirm.ts';
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
import { familyFanOutTargets } from './familyFanOut.ts';
import { amendmentProgress, familyVersionInfo } from './familyAmendment.ts';
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

// One tap (2026-11-27): confirming signs, holds, anchors AND sends to
// the founder and every named member. 'held' is only reached when the
// local hold worked but no send got through, so the member is never
// left "ratified only on this phone" without being told.
type Step =
  | { kind: 'review' }
  | { kind: 'held'; signed: Attestation }
  | { kind: 'done' };

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
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);

  async function confirm() {
    setError(null);
    setSending(true);
    let signed: Attestation;
    try {
      await confirmFaceId(ownerId); // Face ID before every signature, when it is on
      // wallet.sign dedupes by signer, so ratifying twice is harmless.
      // Holding the signed copy gives this wallet the family record and
      // lets it absorb later cosignatures from other members.
      signed = wallet.sign(incoming);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      await refresh();
    } catch (err) {
      setSending(false);
      setError(err instanceof Error ? err.message : 'sign failed');
      return;
    }
    await sendOut(signed);
  }

  async function sendOut(signed: Attestation) {
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const targets = familyFanOutTargets(signed, wallet.keyHistory);
      if (targets.length === 0) {
        throw new Error('no valid recipient for the signed family unit');
      }
      let best: PublishStatusSummary | null = null;
      let anyOk = false;
      for (const t of targets) {
        let status: PublishStatusSummary;
        try {
          status = summarizePublish(await sendEnvelope(t, signed));
        } catch (err) {
          status = {
            tone: 'fail',
            label: 'Not sent',
            detail: err instanceof Error ? err.message : 'send failed',
          };
        }
        if (status.tone !== 'fail') anyOk = true;
        // Prefer 'ok' over 'pending' over 'fail' for the displayed
        // status so the most informative summary survives.
        if (
          !best ||
          (status.tone === 'ok' && best.tone !== 'ok') ||
          (status.tone === 'pending' && best.tone === 'fail')
        ) {
          best = status;
        }
      }
      setSendStatus(best);
      if (anyOk) {
        setStep({ kind: 'done' });
        if (onSuccess) onSuccess();
      } else {
        setStep({ kind: 'held', signed });
        setError(
          'Your signature is saved on this phone, but it did not reach anyone in the family yet. Check your connection and tap Retry send.',
        );
      }
    } catch (err) {
      setStep({ kind: 'held', signed });
      setError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  const version = familyVersionInfo(incoming);
  const amendment = version.version > 1 ? amendmentProgress(incoming) : null;
  const admittedNames = view.members
    .filter((m) => version.admits.includes(m.pubkey.toLowerCase()))
    .map((m) => `${m.name || shortKey(m.pubkey)} (${m.role})`);
  const iAmAdmitted = version.admits.includes(myIdentity);

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
              {amendment && (
                <p className="mt-2 rounded-md bg-white/70 px-3 py-2 text-sm">
                  {iAmAdmitted ? (
                    <>
                      This new version of the family adds{' '}
                      <span className="font-semibold">you</span>. Signing is
                      you agreeing to join. It takes effect once more than half
                      of the family ({amendment.priorNeeded} of{' '}
                      {amendment.priorTotal}) have signed too —{' '}
                      {amendment.priorSigned} so far.
                    </>
                  ) : (
                    <>
                      This new version of the family adds{' '}
                      <span className="font-semibold">{admittedNames.join(', ')}</span>.
                      It takes effect once {amendment.priorNeeded} of the{' '}
                      {amendment.priorTotal} current members have signed (
                      {amendment.priorSigned} so far) and the people being added
                      have signed. Until then the family stays as it is.
                    </>
                  )}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                One tap signs, keeps a copy in your wallet, and sends your
                signature to the founder and everyone else named, so every
                family card shows you as ratified. Only sign if you accept
                being named — this is a public statement.
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
                onClick={() => void confirm()}
                disabled={!myMember || sending}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                {sending ? 'Signing and sending…' : 'I confirm — sign and ratify'}
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

        {step.kind === 'held' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Ratified and held in your wallet, but not delivered yet. The
              family still sees you as waiting until it gets through.
            </p>
            <button
              type="button"
              onClick={() => void sendOut(step.signed)}
              disabled={sending}
              className="mt-3 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Retry send'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Close — I'll retry from my inbox
            </button>
          </>
        )}

        {step.kind === 'done' && (
          <>
            <p className="mt-2 text-sm">
              Ratified and sent to the family.{' '}
              <span className="font-medium">{founderLabel}</span> and the others
              will see you as ratified when their phones pick it up.
            </p>
            {sendStatus && sendStatus.tone !== 'ok' && (
              <p className="mt-2 text-xs text-muted" role="status">
                {sendStatus.detail}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Done
            </button>
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
