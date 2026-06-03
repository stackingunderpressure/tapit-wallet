import { useMemo, useState } from 'react';
import { envelopeId } from 'tapit-attest';
import { useWallet } from './useWallet.ts';
import { displayNameOf } from '../connections/createHandshake.ts';
import { findVouchingCircleCandidates } from '../connections/findVouchingCircleCandidates.ts';
import {
  readReleaseGatePolicyLeaf,
  type ReleaseGatePolicyView,
} from '../identity-gate/identityLeafCredential.ts';
import { buildReleaseAuthorityRequestDraft } from '../identity-gate/releaseAuthorityEnvelopes.ts';
import { summarizePublish, type PublishStatusSummary } from '../transport/publishStatus.ts';
import type { Attestation } from 'tapit-attest';

// Item 11 sub-cut D1 — request vouches for a designated gate. The
// operator opens this from a gate they've designated (D0) and fires a
// release-authority-request envelope to each eligible peer over the
// Mycelium inbox. Each peer will later (D2) see a one-tap "please attest"
// prompt and sign an attest-release-authority back. This cut is the
// REQUEST half only — no collection yet (that's D3).
//
// Honest-scope / additive-proof (operator doctrine 2026-06-03): the
// operator OFFERS this proof path; peers choose whether to attest, and a
// verifier weighs the result with their own judgment. Copy says so.
//
// Binds each request to the gate-policy leaf's envelopeId so the peer's
// eventual attestation commits to the same leaf — a later policy edit
// (new envelopeId) means stale attestations stop authorizing it.

interface Props {
  /** The designated gate-policy leaf to request vouches for. */
  policy: Attestation;
  onClose: () => void;
}

type RowState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; summary: PublishStatusSummary };

const DEFAULT_HORIZON_DAYS = 90;

export function RequestVouchesModal({ policy, onClose }: Props) {
  const { wallet, identity, holdings, sendEnvelope } = useWallet();
  const view: ReleaseGatePolicyView = useMemo(
    () => readReleaseGatePolicyLeaf(policy),
    [policy],
  );
  const requesterName = identity ? displayNameOf(identity) : 'Someone';
  const policyEnvelopeId = useMemo(() => envelopeId(policy), [policy]);

  const nameByPubkey = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of findVouchingCircleCandidates(holdings, wallet.identity)) {
      m.set(c.pubkey.toLowerCase(), c.name);
    }
    return m;
  }, [holdings, wallet.identity]);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendAll() {
    setBusy(true);
    setError(null);
    const horizon = new Date(
      Date.now() + DEFAULT_HORIZON_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      for (const peer of view.eligiblePubkeys) {
        setRows((r) => ({ ...r, [peer]: { kind: 'sending' } }));
        try {
          const draft = buildReleaseAuthorityRequestDraft({
            identityPubkey: wallet.identity,
            identityLeaf: view.forLeaf,
            identityLeafEnvelopeId: policyEnvelopeId,
            proposedHorizonUntil: horizon,
            requesterName,
          });
          const signed = wallet.sign(draft);
          const result = await sendEnvelope(peer, signed);
          setRows((r) => ({
            ...r,
            [peer]: { kind: 'done', summary: summarizePublish(result) },
          }));
        } catch (err) {
          setRows((r) => ({
            ...r,
            [peer]: {
              kind: 'done',
              summary: {
                label: 'Not sent',
                detail:
                  err instanceof Error ? err.message : 'Could not send the request.',
                tone: 'fail',
              },
            },
          }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ask your peers to vouch</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          You're asking the people you designated to vouch that you control{' '}
          <span className="font-mono">{view.forLeaf}</span>. Each of them gets a
          one-tap request. When {view.threshold} of {view.eligiblePubkeys.length}{' '}
          have vouched, you can offer that as extra proof — it doesn't replace
          how someone already decides to trust you, it gives them one more
          thing they can check for themselves.
        </p>

        <ul className="mt-4 space-y-2">
          {view.eligiblePubkeys.map((peer) => {
            const st = rows[peer] ?? { kind: 'idle' as const };
            return (
              <li
                key={peer}
                className="flex items-center justify-between gap-3 rounded-md bg-white/60 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {nameByPubkey.get(peer.toLowerCase()) || '(unnamed peer)'}
                </span>
                <span
                  className={`text-xs ${
                    st.kind === 'done'
                      ? st.summary.tone === 'ok'
                        ? 'text-emerald-700'
                        : st.summary.tone === 'fail'
                          ? 'text-red-600'
                          : 'text-amber-700'
                      : 'text-muted'
                  }`}
                >
                  {st.kind === 'idle'
                    ? 'Ready'
                    : st.kind === 'sending'
                      ? 'Sending…'
                      : st.summary.label}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => void sendAll()}
          disabled={busy}
          className="mt-5 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Sending requests…' : 'Send the requests'}
        </button>
        <p className="mt-2 text-xs text-muted">
          They need to be reachable on the network to receive this. Nothing is
          published publicly — each request goes encrypted to that one peer.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
