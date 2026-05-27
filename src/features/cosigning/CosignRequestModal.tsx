import { useEffect, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { canShare, shareText } from '../../shared/lib/share.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { useWallet } from '../wallet-core/useWallet.ts';
import { PeerPicker } from '../connections/PeerPicker.tsx';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';
import { IdentityChip } from '../connections/IdentityChip.tsx';
import { findAuthRule, isOrgActionRule } from '../governance/authRule.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

interface Props {
  attestation: Attestation;
  onClose: () => void;
  /**
   * Sub-cut 2c witness-an-entry promote target — when present,
   * the recipient pubkey is pre-filled so the operator lands on
   * the send-via-Mycelium step with their target peer already
   * selected. Optional for back-compat with the existing tap-from-
   * detail-page flow that has no peer context.
   */
  prefillRecipient?: string;
  /**
   * Org-context mode — discriminated union over two distinct
   * collection shapes.
   *
   * `org_action` (Phase 8 Phase C cut 3): signer-side org-action
   * authorization. The modal looks up the named action via
   * findAuthRule on the supplied self-declaration, shows a banner
   * naming the action and threshold, and replaces the general
   * PeerPicker with a constrained picker scoped to the rule's
   * eligible set (with handshake-derived names where the operator's
   * roster carries them). Use for org-issued credentials that need
   * threshold > 1 cosignatures.
   *
   * `org_vouch` (Phase 8 Phase E4 cut 4): joiner-side vouch
   * collection. When a `requires_vouch` org's join policy needs N
   * cosignatures from existing members, the joiner uses this mode
   * to fan their signed self-membership envelope out to their own
   * peers. The picker shape differs from org_action because the
   * joiner does not know which of their peers are members of the
   * target org — the eligible set is open-ended, so we render the
   * general PeerPicker over the joiner's full handshake roster and
   * let the org's receive-side gate confirm vouch eligibility. The
   * banner names the org and the threshold; `orgName` is passed by
   * the caller rather than re-derived inside the modal to keep the
   * dependency graph narrow.
   */
  orgContext?:
    | { kind: 'org_action'; orgSelfDecl: Attestation; action: string }
    | { kind: 'org_vouch'; orgName: string; threshold: number };
}

const HEX_64 = /^[0-9a-f]{64}$/i;

// Step 1 of the co-sign flow. Originator taps "Request a co-sign"
// on an entry; this modal renders the entry's canonical envelope
// JSON in a copyable textarea. The originator copies, sends to the
// witness via whatever channel they like (text, AirDrop, Signal,
// email), and the witness pastes into their wallet's "Sign someone
// else's entry" flow.
//
// Uses canonicalEnvelope from tapit-attest for stable, deterministic
// JSON serialization (envelopeId is over the same canonical bytes
// the signer signs, so matching downstream is reliable).
export function CosignRequestModal({
  attestation,
  onClose,
  prefillRecipient,
  orgContext,
}: Props) {
  const { wallet, holdings, prefs, sendEnvelope } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [recipient, setRecipient] = useState(prefillRecipient ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendStatus, setSendStatus] = useState<PublishStatusSummary | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const json = canonicalEnvelope(attestation);
  const recipientTrim = recipient.trim().toLowerCase();
  const recipientValid = HEX_64.test(recipientTrim);

  // Phase 8 Phase C cut 3 — derive the org-action rule + a per-eligible
  // display name from the operator's handshake roster. Returns null when
  // org-context is absent, is not the org_action kind, OR the named
  // action is not declared in the org's auth tree (the latter would be
  // a caller bug; the modal degrades by falling back to the general
  // PeerPicker rather than disabling sending entirely).
  const orgRule = useMemo(() => {
    if (!orgContext || orgContext.kind !== 'org_action') return null;
    const found = findAuthRule(orgContext.orgSelfDecl, orgContext.action);
    // CosignRequestModal's org_action mode is the signer-side co-sign UI;
    // join rules (joiner-side) flow through the org_vouch kind instead.
    // Narrow to AuthRuleForOrgAction and fall back to the general
    // PeerPicker if a caller ever hands us a join-action context by
    // mistake.
    if (!found || !isOrgActionRule(found.rule)) return null;
    const rule = found.rule;
    const nameByKey = new Map<string, string>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      if (v.initiatorId && v.initiatorName) {
        nameByKey.set(v.initiatorId.toLowerCase(), v.initiatorName);
      }
      if (v.responderId && v.responderName) {
        nameByKey.set(v.responderId.toLowerCase(), v.responderName);
      }
    }
    const eligibleDisplay = rule.eligible.map((pubkey) => {
      const lower = pubkey.toLowerCase();
      const name =
        lower === wallet.identity.toLowerCase()
          ? 'You (founder)'
          : (nameByKey.get(lower) ?? null);
      return { pubkey: lower, name };
    });
    return { rule, eligibleDisplay };
  }, [orgContext, holdings, wallet.identity]);

  // Vouch collection requires fanning out to multiple peers in one
  // modal lifecycle — the joiner does not know which peer is the
  // member, so they send to several. Reset the sent-state whenever
  // the recipient changes so the send button re-enables on a new
  // target and the prior peer's status banner clears. This also
  // benefits the org_action path: a misclick on the constrained
  // eligible list is now self-correcting.
  useEffect(() => {
    setSent(false);
    setSendStatus(null);
    setSendError(null);
  }, [recipientTrim]);

  async function copy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const outcome = await shareText({
      title: 'Tapit Wallet — co-sign request',
      text: json,
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function sendViaNostr() {
    if (!recipientValid) return;
    setSendError(null);
    setSendStatus(null);
    setSending(true);
    try {
      const result = await sendEnvelope(recipientTrim, attestation);
      const status = summarizePublish(result);
      setSendStatus(status);
      // 'pending' (no acks yet) still counts as "sent" for the
      // disabled-state — operator can re-send if needed but the
      // dispatch happened.
      if (status.tone !== 'fail') setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Request a co-sign</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        {orgRule && orgContext?.kind === 'org_action' && (
          <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3 text-xs">
            <div className="font-medium text-accent">
              Org action: {orgContext.action}
            </div>
            <p className="mt-1 text-muted">
              This envelope is being issued under the{' '}
              <span className="font-medium">{orgContext.action}</span> rule.
              Needs <span className="font-medium">{orgRule.rule.threshold}</span> of{' '}
              <span className="font-medium">{orgRule.rule.eligible.length}</span>{' '}
              signatures from the eligible set below.
            </p>
          </div>
        )}
        {orgContext?.kind === 'org_vouch' && (
          <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3 text-xs">
            <div className="font-medium text-accent">
              Vouch needed: joining {orgContext.orgName}
            </div>
            <p className="mt-1 text-muted">
              This org requires{' '}
              <span className="font-medium">{orgContext.threshold}</span>{' '}
              cosignature{orgContext.threshold === 1 ? '' : 's'} from existing
              members. Send your signed join envelope to peers you think might
              be members — the org will count their signatures when it
              receives the cosigned envelope. You can send to multiple peers
              in turn; the recipient field clears between sends.
            </p>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          Copy this entry and send it to the person you want to co-sign. They
          paste it into <span className="font-medium">Sign someone else's entry</span> on
          their wallet, confirm, and send the signed version back to you.
        </p>
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
        {showQr && <QrShow text={json} label="Co-sign request" />}
        {showEnvelope && (
          <textarea
            readOnly
            value={json}
            rows={8}
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
          />
        )}

        {prefs.nostrTransportEnabled && (
          <div className="mt-4 rounded-md bg-accent/5 border border-accent/30 p-3">
            <div className="text-xs font-medium text-accent">Send via Mycelium</div>
            <p className="mt-1 text-xs text-muted">
              Pick a connection or paste a public key. Encrypted to
              them and delivered through your shared Nostr relays.
            </p>
            <div className="mt-2">
              {orgRule ? (
                <ul className="space-y-1">
                  {orgRule.eligibleDisplay.map((e) => {
                    const selected = e.pubkey === recipientTrim;
                    return (
                      <li key={e.pubkey}>
                        <button
                          type="button"
                          onClick={() => setRecipient(e.pubkey)}
                          aria-pressed={selected}
                          className={`w-full text-left rounded-md px-3 py-2 border ${
                            selected
                              ? 'bg-accent/10 border-accent text-ink'
                              : 'bg-white border-ink/15 hover:bg-ink/5'
                          }`}
                        >
                          <IdentityChip
                            pubkey={e.pubkey}
                            name={e.name ?? undefined}
                            size="md"
                            className="min-w-0"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <PeerPicker
                  holdings={holdings}
                  myIdentity={wallet.identity}
                  value={recipient}
                  onChange={setRecipient}
                />
              )}
            </div>
            <button
              type="button"
              onClick={sendViaNostr}
              disabled={!recipientValid || sending || sent}
              className="mt-2 w-full rounded-md bg-accent py-2 text-paper text-sm font-medium disabled:opacity-60"
            >
              {sent
                ? sendStatus?.label ?? 'Sent via Nostr'
                : sending
                  ? 'Sending…'
                  : 'Send via Nostr'}
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
            {sendError && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {sendError}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2 flex-wrap">
          {canShare() && (
            <button
              type="button"
              onClick={share}
              className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Share via AirDrop / Messages / …
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
      </div>
    </div>
  );
}
