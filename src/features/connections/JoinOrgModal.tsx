import { Suspense, lazy, useMemo, useState } from 'react';
import type {
  Attestation,
  DisclosureProofBundle,
} from 'tapit-attest';
import { canonicalEnvelope, disclosureProof } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import { isHandshake, leafValue } from './createHandshake.ts';

// Lazy-load the cosign request modal — same chunk-sharing pattern
// MembershipModal and PromoteRouter use so the cosign UI body does
// not weigh down the JoinOrgModal entry chunk. Only the requires_vouch
// branch of the send step opens it.
const CosignRequestModal = lazy(() =>
  import('../cosigning/CosignRequestModal.tsx').then((m) => ({
    default: m.CosignRequestModal,
  })),
);
import {
  buildSelfMembershipDraft,
  type SelfMembershipProofs,
} from './createMembership.ts';
import {
  isOrganizationSelfDeclaration,
  readOrganizationName,
} from './createOrganization.ts';
import {
  findAuthRule,
  isJoinRule,
  type AuthRuleForJoin,
  type JoinPolicy,
} from '../governance/authRule.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

// Phase 8 Phase E4 cut 3 — the any-wallet "Join an org" modal. The
// novel UI piece of the cut: a joiner-side flow that takes an org's
// self-declaration as input, reads the declared join-policy via
// findAuthRule + isJoinRule, renders the policy in plain language,
// (when proof-required) walks the joiner through picking a
// proof-eligible attestation from their holdings and packaging it
// as a tapit-attest disclosureProof bundle, then signs a
// self-membership envelope via buildSelfMembershipDraft + wallet.sign
// and offers QR + Mycelium delivery so the org-side acceptor
// (HomeScreen.acceptSelfMembership) can ingest it through the
// existing routing.
//
// The on-wire envelope shape was locked at Phase E4 cut 2:
// handshake_proof and credential_proof ride as top-level claim-tree
// leaves carrying canonical JSON of a DisclosureProofBundle; vouch
// cosignatures ride envelope.signatures[]. The joiner's own signature
// covers the proof leaf so it cannot be detached and swapped, same
// Tapscript-style discipline the Phase A/B authorized_by leaf
// pattern established.
//
// Step flow: 'find' → 'review' → 'proof' (only when proof required)
// → 'send' → 'done'. The review step renders the policy in plain
// language so the joiner sees what they need to provide before they
// commit to the flow.

interface Props {
  onClose: () => void;
}

type Step = 'find' | 'review' | 'proof' | 'send' | 'done';

const eyebrow = 'text-xs uppercase tracking-wide text-accent';
const primaryBtn =
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40';
const ACCENT_BLOCK =
  'mt-4 rounded-md bg-accent/5 border border-accent/30 p-3';

// Plain-language rendering of a JoinPolicy. Speech-friendly per the
// chat-reply doctrine the wallet inherits from CLAUDE.md — full
// sentences, no inline jargon dumps.
function describePolicy(policy: JoinPolicy): string {
  switch (policy.kind) {
    case 'open':
      return 'This org accepts any wallet that asks. You sign one envelope claiming membership; the org holds it on receive.';
    case 'allow_list':
      return `This org only accepts wallets on its allow list (${policy.pubkeys.length} pubkey${policy.pubkeys.length === 1 ? '' : 's'}). You must be on that list for the join to succeed.`;
    case 'deny_list':
      return `This org accepts any wallet except those on its deny list (${policy.pubkeys.length} pubkey${policy.pubkeys.length === 1 ? '' : 's'}). As long as you are not on the list, your join succeeds.`;
    case 'requires_handshake':
      return `This org requires you to already hold a co-signed handshake with at least one of ${policy.with_any_of.length} anchor pubkey${policy.with_any_of.length === 1 ? '' : 's'}. You will pick a qualifying handshake and disclose proof of it in your join envelope.`;
    case 'requires_credential':
      return `This org requires you to hold a credential of type "${policy.credential_type}"${policy.issuer ? ` issued by a specific pubkey` : ''}. You will pick a qualifying credential and disclose proof of it in your join envelope.`;
    case 'requires_vouch':
      return `This org requires cosignatures from ${policy.from_any_member_count} existing member${policy.from_any_member_count === 1 ? '' : 's'}. You sign the join envelope and then collect the required cosignatures before submitting to the org.`;
  }
}

function isCredentialAttestation(att: Attestation): boolean {
  return att.kind === 'credential';
}

function isRelationshipAttestation(att: Attestation): boolean {
  return att.kind === 'relationship';
}

// Find every credential in holdings whose credential_type leaf matches
// the policy's required type. Subject must equal the joiner (otherwise
// the proof discloses a credential issued to someone else). When the
// policy names an issuer, require at least one signature from that
// pubkey on the credential.
function findCredentialProofCandidates(
  policy: Extract<JoinPolicy, { kind: 'requires_credential' }>,
  holdings: readonly Attestation[],
  joinerId: string,
): Attestation[] {
  const issuerLower = policy.issuer?.trim().toLowerCase();
  return holdings.filter((a) => {
    if (!isCredentialAttestation(a)) return false;
    if (a.subject !== joinerId) return false;
    if (leafValue(a, 'credential_type') !== policy.credential_type) return false;
    if (issuerLower) {
      const hasIssuer = a.signatures.some(
        (s) => s.signer.trim().toLowerCase() === issuerLower,
      );
      if (!hasIssuer) return false;
    }
    return true;
  });
}

// Find every handshake (relationship-kind with a verification leaf)
// that carries the joiner's own signature AND a signature from at
// least one pubkey in policy.with_any_of. The disclosure proof will
// be over the verification leaf; the evaluator confirms meta.kind
// equals relationship, the leaf is non-empty, and the signatures
// include both the joiner and an anchor.
function findHandshakeProofCandidates(
  policy: Extract<JoinPolicy, { kind: 'requires_handshake' }>,
  holdings: readonly Attestation[],
  joinerId: string,
): Attestation[] {
  const anchors = new Set(policy.with_any_of.map((p) => p.trim().toLowerCase()));
  const joinerLower = joinerId.trim().toLowerCase();
  return holdings.filter((a) => {
    if (!isRelationshipAttestation(a)) return false;
    if (!isHandshake(a)) return false;
    const signers = a.signatures.map((s) => s.signer.trim().toLowerCase());
    if (!signers.includes(joinerLower)) return false;
    return signers.some((s) => s !== joinerLower && anchors.has(s));
  });
}

// Compact pubkey/name renderer used for proof-candidate buttons. Uses
// peer name when an identity attestation in holdings names the pubkey;
// falls back to truncated hex otherwise.
function describeHandshakePeer(handshake: Attestation, joinerId: string): string {
  const initiator = leafValue(handshake, 'initiator_id');
  const initiatorName = leafValue(handshake, 'initiator_name');
  const responder = leafValue(handshake, 'responder_id');
  const responderName = leafValue(handshake, 'responder_name');
  const joinerLower = joinerId.trim().toLowerCase();
  if (initiator.trim().toLowerCase() === joinerLower) {
    return responderName || `${responder.slice(0, 8)}…${responder.slice(-4)}`;
  }
  return initiatorName || `${initiator.slice(0, 8)}…${initiator.slice(-4)}`;
}

export function JoinOrgModal({ onClose }: Props) {
  const { wallet, identity, holdings, prefs, sendEnvelope } = useWallet();
  const [step, setStep] = useState<Step>('find');
  const [scanning, setScanning] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [orgDecl, setOrgDecl] = useState<Attestation | null>(null);
  const [selfMembership, setSelfMembership] = useState<Attestation | null>(null);
  const [selectedProof, setSelectedProof] = useState<Attestation | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);
  const [cosignOpen, setCosignOpen] = useState(false);

  // Derived: the join rule on the chosen org-self-declaration, or null
  // when the declaration carries no join rule (in which case open-join
  // is structurally not supported — we surface a refusal in the review
  // step rather than letting the joiner sign something the org will
  // throw out at receive time).
  const joinRule: AuthRuleForJoin | null = useMemo(() => {
    if (!orgDecl) return null;
    const found = findAuthRule(orgDecl, 'join');
    if (!found || !isJoinRule(found.rule)) return null;
    return found.rule;
  }, [orgDecl]);

  const policyNeedsProof = useMemo(() => {
    if (!joinRule) return false;
    return (
      joinRule.policy.kind === 'requires_handshake' ||
      joinRule.policy.kind === 'requires_credential'
    );
  }, [joinRule]);

  // Filter holdings down to proof-eligible attestations whenever the
  // policy is a proof-required kind. For requires_credential we also
  // exclude memberships (kind=credential, credential_type=membership)
  // because they cannot satisfy a requires_credential policy looking
  // for some other credential_type — the type leaf comparison would
  // catch it anyway, but it keeps the proof-picker list clean.
  const proofCandidates = useMemo<Attestation[]>(() => {
    if (!joinRule || !identity) return [];
    const joinerId = identity.subject;
    if (joinRule.policy.kind === 'requires_handshake') {
      return findHandshakeProofCandidates(joinRule.policy, holdings, joinerId);
    }
    if (joinRule.policy.kind === 'requires_credential') {
      return findCredentialProofCandidates(joinRule.policy, holdings, joinerId);
    }
    return [];
  }, [joinRule, holdings, identity]);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  function ingestOrgDecl(raw: string) {
    setError(null);
    try {
      const att = parseEnvelope(raw);
      if (!isOrganizationSelfDeclaration(att)) {
        throw new Error(
          'That envelope is not an organization self-declaration. Ask the org for its declaration code.',
        );
      }
      if (att.signatures.length === 0) {
        throw new Error('Org declaration carries no signatures — refusing to read.');
      }
      setOrgDecl(att);
      setStep('review');
    } catch (err) {
      fail(err, 'Could not read that envelope.');
    }
  }

  function onPasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    ingestOrgDecl(pasteText);
  }

  function onScanResult(text: string) {
    setScanning(false);
    ingestOrgDecl(text);
  }

  // Construct the self-membership envelope (with proof leaves if the
  // policy requires them) and sign with the joiner's wallet. Pure
  // local — no network and no IndexedDB touch yet; the operator
  // shares the signed envelope via QR or Mycelium from the send step.
  function signAndProceed() {
    setError(null);
    if (!identity || !orgDecl || !joinRule) {
      setError('Missing identity or org declaration.');
      return;
    }
    try {
      const orgId = orgDecl.subject;
      const orgName = readOrganizationName(orgDecl) || 'Unnamed organization';
      let proofs: SelfMembershipProofs | undefined;
      if (joinRule.policy.kind === 'requires_handshake') {
        if (!selectedProof) {
          setError('Pick a handshake to disclose as proof.');
          return;
        }
        const bundle: DisclosureProofBundle = disclosureProof(
          selectedProof,
          'verification',
        );
        proofs = { handshake_proof: bundle };
      } else if (joinRule.policy.kind === 'requires_credential') {
        if (!selectedProof) {
          setError('Pick a credential to disclose as proof.');
          return;
        }
        const bundle: DisclosureProofBundle = disclosureProof(
          selectedProof,
          'credential_type',
        );
        proofs = { credential_proof: bundle };
      }
      const draft = buildSelfMembershipDraft(identity, orgId, orgName, proofs);
      const signed = wallet.sign(draft);
      setSelfMembership(signed);
      setStep('send');
    } catch (err) {
      fail(err, 'Could not build the join envelope.');
    }
  }

  async function sendViaMycelium() {
    if (!selfMembership || !orgDecl) return;
    setError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const result = await sendEnvelope(orgDecl.subject, selfMembership);
      const status = summarizePublish(result);
      setSendStatus(status);
      if (status.tone !== 'fail') {
        setSent(true);
        setStep('done');
      }
    } catch (err) {
      fail(err, 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Join an organization</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step === 'find' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 1 of {policyNeedsProof ? 4 : 3}</div>
            <p className="mt-1 text-sm text-muted">
              An organization's self-declaration carries the join policy
              you must satisfy. Paste the declaration's JSON or scan its
              QR code to see what the org requires.
            </p>
            <form onSubmit={onPasteSubmit} className="mt-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                placeholder="Paste organization self-declaration JSON"
                className="w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={pasteText.trim().length === 0}
                  className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
                >
                  Read declaration
                </button>
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium"
                >
                  Scan QR
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'review' && orgDecl && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 2 of {policyNeedsProof ? 4 : 3}</div>
            <h3 className="mt-1 text-lg font-semibold">
              {readOrganizationName(orgDecl) || 'Unnamed organization'}
            </h3>
            <p className="mt-1 text-xs text-muted font-mono">
              {orgDecl.subject.slice(0, 8)}…{orgDecl.subject.slice(-4)}
            </p>
            {!joinRule ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This org has not declared a join policy. It does not
                accept open joins — only memberships the org itself
                issues. Ask the org to issue you a membership directly.
              </div>
            ) : (
              <>
                <div className={ACCENT_BLOCK}>
                  <div className="text-xs font-medium text-accent">
                    {joinRule.policy.kind.replace(/_/g, ' ')}
                  </div>
                  <p className="mt-1 text-sm">{describePolicy(joinRule.policy)}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (policyNeedsProof) setStep('proof');
                      else if (joinRule.policy.kind === 'requires_vouch') signAndProceed();
                      else signAndProceed();
                    }}
                    className={primaryBtn}
                  >
                    {policyNeedsProof ? 'Next: pick proof' : 'Sign join envelope'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === 'proof' && joinRule && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 3 of 4</div>
            <p className="mt-1 text-sm text-muted">
              Pick a {joinRule.policy.kind === 'requires_handshake' ? 'handshake' : 'credential'}{' '}
              to disclose. Your signature on the join envelope will cover
              the disclosed proof so it cannot be detached and swapped.
            </p>
            {proofCandidates.length === 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                You hold no {joinRule.policy.kind === 'requires_handshake' ? 'handshake' : 'credential'}{' '}
                that satisfies this policy. Acquire one (in person or via
                an issuer) and come back to finish the join.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {proofCandidates.map((a, i) => {
                  const selected = selectedProof === a;
                  let label = '';
                  let when = '';
                  if (joinRule.policy.kind === 'requires_handshake' && identity) {
                    label = `Handshake with ${describeHandshakePeer(a, identity.subject)}`;
                    when = leafValue(a, 'handshake_at') || a.issuedAt;
                  } else {
                    const credType = leafValue(a, 'credential_type');
                    const orgName = leafValue(a, 'org_name');
                    label = orgName
                      ? `${credType} — ${orgName}`
                      : credType || 'Credential';
                    when = leafValue(a, 'issued_at') || a.issuedAt;
                  }
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setSelectedProof(a)}
                        className={`w-full text-left rounded-md border px-3 py-2 ${
                          selected
                            ? 'border-accent bg-accent/10'
                            : 'border-ink/15 bg-white hover:bg-ink/5'
                        }`}
                      >
                        <div className="text-sm font-medium">{label}</div>
                        <div className="mt-1 text-xs text-muted">{when}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={signAndProceed}
                disabled={!selectedProof}
                className={primaryBtn}
              >
                Sign join envelope
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </>
        )}

        {step === 'send' && selfMembership && orgDecl && joinRule && (
          <>
            <div className={`mt-2 ${eyebrow}`}>
              Step {policyNeedsProof ? 4 : 3} of {policyNeedsProof ? 4 : 3}
            </div>
            <p className="mt-1 text-sm text-muted">
              Your join envelope is signed. Send it to the org so it
              can accept you into its roster. Show the QR if the org is
              in the room, or send via Mycelium if you have it on.
            </p>
            <QrShow text={canonicalEnvelope(selfMembership)} label="Join envelope" />
            {joinRule.policy.kind === 'requires_vouch' && (
              <div className={`${ACCENT_BLOCK} border-amber-400/40 bg-amber-50`}>
                <div className="text-xs font-medium text-amber-900">
                  Cosignatures still needed
                </div>
                <p className="mt-1 text-xs text-amber-900/80">
                  This policy requires {joinRule.policy.from_any_member_count}{' '}
                  cosignature{joinRule.policy.from_any_member_count === 1 ? '' : 's'}{' '}
                  from existing members. The org will reject this envelope
                  until you collect enough vouches. Use the button below to
                  fan the signed envelope out to peers you think might be
                  members; absorb each returned cosigned envelope back into
                  your holdings, then send the fully cosigned version to
                  the org.
                </p>
                <button
                  type="button"
                  onClick={() => setCosignOpen(true)}
                  className="mt-2 w-full rounded-md bg-amber-900 py-2 text-paper text-sm font-medium"
                >
                  Collect vouch cosignatures
                </button>
              </div>
            )}
            {prefs.nostrTransportEnabled && (
              <div className={ACCENT_BLOCK}>
                <div className="text-xs font-medium text-accent">
                  Or send via Mycelium
                </div>
                <p className="mt-1 text-xs text-muted">
                  Encrypted to the org and delivered through your shared
                  Nostr relays. The org will see Accept join request in
                  their inbox; no scan required.
                </p>
                <button
                  type="button"
                  onClick={() => void sendViaMycelium()}
                  disabled={sending || sent}
                  className="mt-2 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
                >
                  {sent
                    ? sendStatus?.label ?? 'Sent via Nostr'
                    : sending
                      ? 'Sending…'
                      : `Send to ${readOrganizationName(orgDecl) || 'the org'} via Nostr`}
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

        {step === 'done' && orgDecl && (
          <div className="mt-3 text-center">
            <div className={eyebrow}>Join sent</div>
            <h3 className="mt-1 text-lg font-semibold">
              Your join request reached {readOrganizationName(orgDecl) || 'the org'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              The org will run its join policy against your envelope. If
              it accepts, you will appear on the org's open-member
              roster when the org next publishes one.
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
        <QrScanModal
          onScanned={onScanResult}
          onClose={() => setScanning(false)}
        />
      )}
      {cosignOpen &&
        selfMembership &&
        orgDecl &&
        joinRule?.policy.kind === 'requires_vouch' && (
          <Suspense fallback={null}>
            <CosignRequestModal
              attestation={selfMembership}
              orgContext={{
                kind: 'org_vouch',
                orgName:
                  readOrganizationName(orgDecl) || 'this organization',
                threshold: joinRule.policy.from_any_member_count,
              }}
              onClose={() => setCosignOpen(false)}
            />
          </Suspense>
        )}
    </div>
  );
}
