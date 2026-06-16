import { useMemo, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  findVouchingCircleCandidates,
  type VouchingCandidate,
} from '../connections/findVouchingCircleCandidates.ts';
import { peerNamesByPubkey } from '../connections/createHandshake.ts';
import { summarizePublish } from '../transport/publishStatus.ts';
import {
  buildFamilyTreeBundleDraft,
  collectMyTreeAttestations,
  findMyRootNodeId,
} from './familyTreeBundle.ts';

// Friends' trees — the CONSENTED SHARE surface (slice 1).
//
// PRIVACY RAIL #1: a tree leaves the wallet ONLY on an explicit, per-person
// human confirm tap ("Share my family tree with {name}"). There is no
// auto-share and no background send — the operator picks one person from their
// trusted circle, sees a confirm step naming exactly who and what, and only
// then is the bundle built, signed, and sent. PRIVACY RAIL #3: the bundle
// carries ONLY family-tree attestations (collectMyTreeAttestations filters by
// the three tree predicates) — never secrets, journal entries, or keys.
//
// Share is only offered when Mycelium is live (relayStatus non-null); with the
// network off there is no transport to carry the bundle, so the modal shows a
// gentle "connect Mycelium first" notice instead of a dead send button.
//
// Send status is surfaced inline (summarizePublish), the same honest
// per-recipient pattern RecoveryInitiatorModal / StartFamilyModal use: "Sent"
// means a relay accepted, not that the friend has read it.

interface Props {
  onClose: () => void;
}

type SendState =
  | { kind: 'idle' }
  | { kind: 'confirming'; peer: VouchingCandidate }
  | { kind: 'sending'; peer: VouchingCandidate }
  | { kind: 'sent'; peer: VouchingCandidate; detail: string }
  | { kind: 'pending'; peer: VouchingCandidate; detail: string }
  | { kind: 'failed'; peer: VouchingCandidate; detail: string };

export function ShareTreeModal({ onClose }: Props) {
  const { wallet, holdings, relayStatus, sendEnvelope, identity } = useWallet();
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  const myName = useMemo(() => {
    const names = peerNamesByPubkey(holdings, wallet.identity);
    return names.get(wallet.identity.toLowerCase()) || 'A friend';
  }, [holdings, wallet.identity]);

  const candidates = useMemo(
    () => findVouchingCircleCandidates(holdings, wallet.publicKey),
    [holdings, wallet.publicKey],
  );

  // The tree we WOULD share — computed once for the count shown to the
  // operator so they see exactly how much is leaving the wallet.
  const myTree = useMemo(
    () => collectMyTreeAttestations(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const myRootId = useMemo(
    () => findMyRootNodeId(holdings, wallet.identity),
    [holdings, wallet.identity],
  );

  const networkLive = relayStatus !== null;
  const peopleCount = useMemo(() => {
    // Approximate person count for the confirm copy: person-nodes only.
    return myTree.filter((a) => a.kind === 'credential').length;
  }, [myTree]);

  async function confirmShare(peer: VouchingCandidate) {
    setState({ kind: 'sending', peer });
    try {
      const draft = buildFamilyTreeBundleDraft(wallet.identity, {
        trees: myTree,
        rootNodeId: myRootId,
        sharerName: myName,
      });
      const signed = wallet.sign(draft);
      const publish = await sendEnvelope(peer.pubkey, signed);
      const summary = summarizePublish(publish);
      if (summary.tone === 'fail') {
        setState({ kind: 'failed', peer, detail: summary.detail });
        return;
      }
      if (summary.tone === 'pending') {
        setState({ kind: 'pending', peer, detail: summary.detail });
        return;
      }
      setState({ kind: 'sent', peer, detail: summary.detail });
    } catch (err) {
      setState({
        kind: 'failed',
        peer,
        detail: err instanceof Error ? err.message : 'Could not send.',
      });
    }
  }

  const activePeer =
    state.kind === 'idle' ? null : 'peer' in state ? state.peer : null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Share my family tree</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          Pick one person from your trusted circle. Your tree is sent to them,
          and only them, encrypted end to end — they see who you are related to,
          you stay in control. Nothing else from your wallet goes with it.
        </p>

        {!networkLive && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            Connect the Mycelium network in Settings first — that is the
            encrypted path your tree travels to your friend.
          </div>
        )}

        {networkLive && !identity && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            Set up your own identity first so your friend knows whose tree this
            is.
          </div>
        )}

        {networkLive && myTree.length === 0 && (
          <div className="mt-4 rounded-md border border-ink/10 bg-white px-3 py-3 text-sm text-muted">
            Your family tree is empty. Add a few people on the Your-tree tab
            first, then come back to share it.
          </div>
        )}

        {networkLive && myTree.length > 0 && (
          <>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Share with — your trusted circle
            </div>

            {candidates.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                You have not connected with anyone yet. Connect with a relative
                on the People tab, then you can share your tree with them.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {candidates.map((peer) => {
                  const isActive = activePeer?.pubkey === peer.pubkey;
                  const showConfirm =
                    state.kind === 'confirming' && isActive;
                  const showSending = state.kind === 'sending' && isActive;
                  const showSent = state.kind === 'sent' && isActive;
                  const showPending = state.kind === 'pending' && isActive;
                  const showFailed = state.kind === 'failed' && isActive;
                  return (
                    <li
                      key={peer.pubkey}
                      className="rounded-lg border border-ink/10 bg-white p-3 animate-fresh-rise motion-reduce:animate-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {peer.name}
                          </div>
                          <div className="truncate text-[11px] text-muted">
                            {peer.pubkey.slice(0, 10)}…
                          </div>
                        </div>
                        {!showConfirm &&
                          !showSending &&
                          !showSent &&
                          !showPending && (
                            <button
                              type="button"
                              onClick={() =>
                                setState({ kind: 'confirming', peer })
                              }
                              className="shrink-0 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04]"
                            >
                              Share
                            </button>
                          )}
                      </div>

                      {showConfirm && (
                        <div className="mt-2 rounded-md bg-ink/[0.03] px-3 py-2">
                          <p className="text-xs text-ink">
                            Share my family tree with{' '}
                            <span className="font-semibold">{peer.name}</span>?
                            This sends {peopleCount} tree record
                            {peopleCount === 1 ? '' : 's'} — your people and how
                            they are related — to them and no one else.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void confirmShare(peer)}
                              className="flex-1 rounded-md bg-ink py-1.5 text-xs font-medium text-paper transition active:animate-fresh-press motion-reduce:active:animate-none"
                            >
                              Share my family tree with {peer.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => setState({ kind: 'idle' })}
                              className="rounded-md border border-ink/15 px-3 py-1.5 text-xs text-muted hover:bg-ink/5"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {showSending && (
                        <p className="mt-2 text-xs text-muted">Sending…</p>
                      )}

                      {showSent && (
                        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                          Sent to {peer.name}. {state.detail}
                        </p>
                      )}

                      {showPending && (
                        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                          {state.detail} You can try again if it does not
                          arrive.
                        </p>
                      )}

                      {showFailed && (
                        <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                          <p>{state.detail}</p>
                          <button
                            type="button"
                            onClick={() => setState({ kind: 'confirming', peer })}
                            className="mt-1 font-semibold hover:underline"
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
