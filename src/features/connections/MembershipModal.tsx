import { lazy, Suspense, useMemo, useState } from 'react';
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
import { findOwnOrgDeclaration } from './createOrganization.ts';
import {
  buildAuthorizedByPayload,
  findAuthRule,
  isOrgActionRule,
  type AuthRuleForOrgAction,
} from '../governance/authRule.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

// Phase 8 Phase C cut 3 caller-wiring: the co-sign request modal is
// only needed when the operator's org has a multi-eligible
// routine_issuance rule. Lazy-loaded so its surface (and the QR
// helpers it pulls in) stays out of MembershipModal's static chunk;
// the same lazy chunk JournalDetail + PromoteRouter already share.
const CosignRequestModal = lazy(() =>
  import('../cosigning/CosignRequestModal.tsx').then((m) => ({
    default: m.CosignRequestModal,
  })),
);

// The single action the operator's org issues memberships under today.
// Phase D will surface a chip-form action picker when an org has more
// than one issuance-capable rule; until then routine_issuance is the
// only rule the org-side membership flow can author against.
const ROUTINE_ISSUANCE = 'routine_issuance';

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
  const { wallet, ownerId, identity, anchorWorker, prefs, sendEnvelope, save, holdings } =
    useWallet();
  const [step, setStep] = useState<Step>('role');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<Attestation | null>(null);
  const [peerName, setPeerName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);
  const [cosignOpen, setCosignOpen] = useState(false);

  // Phase 8 Phase C cut 3 caller-wiring. When the operator's wallet has
  // self-declared as an org, look up the routine_issuance rule on the
  // declaration. If present and well-formed we bake the disclosure
  // proof of that rule into the membership envelope as an
  // authorized_by leaf at draft time (so the org's signature covers
  // it). If the rule's threshold > 1 we surface a "Request co-signs"
  // button on the issue-show step that opens CosignRequestModal in
  // orgContext mode to gather the remaining signatures from the
  // rule's eligible set. Operators whose wallet has not self-declared
  // as an org, or whose declaration predates Phase A and has no auth
  // tree, fall back to the pre-Phase-8 single-sig membership shape
  // (no authorized_by leaf, no cosign-request button) — same flow as
  // before this cut.
  const ownOrg = useMemo(
    () => findOwnOrgDeclaration(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const issuanceRule: AuthRuleForOrgAction | null = useMemo(() => {
    if (!ownOrg) return null;
    const found = findAuthRule(ownOrg, ROUTINE_ISSUANCE)?.rule ?? null;
    if (!found || !isOrgActionRule(found)) return null;
    return found;
  }, [ownOrg]);

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
      const authorizedBy = ownOrg
        ? (buildAuthorizedByPayload(ownOrg, ROUTINE_ISSUANCE) ?? undefined)
        : undefined;
      const draft = buildMembershipDraft(identity, att, authorizedBy);
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
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
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
            {ownOrg && issuanceRule && issuanceRule.threshold > 1 && membership && (
              <div className={`${ACCENT_BLOCK} border-amber-400/40 bg-amber-50`}>
                <div className="text-xs font-medium text-amber-900">
                  Needs co-signs to satisfy {ROUTINE_ISSUANCE}
                </div>
                <p className="mt-1 text-xs text-amber-900/80">
                  Your signature alone is one of{' '}
                  <span className="font-medium">{issuanceRule.threshold}</span>{' '}
                  required from{' '}
                  <span className="font-medium">{issuanceRule.eligible.length}</span>{' '}
                  eligible signers. Send this draft to the rest of the
                  eligible set; the membership becomes verifiable once the
                  threshold is met.
                </p>
                <button
                  type="button"
                  onClick={() => setCosignOpen(true)}
                  className="mt-2 w-full rounded-md border border-amber-500/60 bg-white py-2 text-xs font-medium text-amber-900"
                >
                  Request co-signs from eligible signers
                </button>
              </div>
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
      {cosignOpen && membership && ownOrg && (
        <Suspense fallback={null}>
          <CosignRequestModal
            attestation={membership}
            orgContext={{ kind: 'org_action', orgSelfDecl: ownOrg, action: ROUTINE_ISSUANCE }}
            onClose={() => setCosignOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
