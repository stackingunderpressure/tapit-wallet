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
import {
  buildMinimalProjection,
  type MinimalTreeProjection,
} from './familyTreeProjection.ts';
import { generationSpan } from './generationSpan.ts';

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

type ShareMode = 'minimal' | 'full';

export function ShareTreeModal({ onClose }: Props) {
  const { wallet, holdings, relayStatus, sendEnvelope, identity } = useWallet();
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  // Privacy default: MINIMAL. The operator opts IN to a full share. This is
  // the privacy rail's user-facing default — first names + structure only,
  // no dates, no surnames, no other wallet keys leave the wallet.
  const [mode, setMode] = useState<ShareMode>('minimal');

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

  // The MINIMAL projection that WOULD be sent — computed at build time on the
  // sender from the FOLDED graph so the preview shows EXACTLY what crosses the
  // wire (first names + structure + the one shared-anchor key, nothing else).
  // The anchor pubkey is the sender's own identity (the keyedPubkey on their
  // self-node), so mergeCandidates still finds the shared relative on receipt.
  const projection = useMemo<MinimalTreeProjection>(
    () => buildMinimalProjection(myTree, wallet.identity),
    [myTree, wallet.identity],
  );
  // Preview figures, derived ONLY from the redacted projection (so the preview
  // itself reveals nothing the share would not).
  const previewPeople = projection.nodes.length;
  const previewGenerations = useMemo(
    () => generationSpan(projection),
    [projection],
  );
  const previewFirstNames = useMemo(() => {
    const names = projection.nodes
      .map((n) => n.firstName)
      .filter((n) => n.length > 0);
    return names.slice(0, 8);
  }, [projection]);

  async function confirmShare(peer: VouchingCandidate) {
    setState({ kind: 'sending', peer });
    try {
      // MINIMAL (default): ship ONLY the redacted projection — redaction
      // already happened at build time, so surnames / dates / sex / non-anchor
      // keys never enter the envelope. FULL (opt-in): ship the attestations.
      const draft =
        mode === 'minimal'
          ? buildFamilyTreeBundleDraft(wallet.identity, {
              projection,
              rootNodeId: myRootId,
              sharerName: myName,
            })
          : buildFamilyTreeBundleDraft(wallet.identity, {
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
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">
              How much to share
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('minimal')}
                className={`rounded-lg border px-3 py-2 text-left transition active:animate-fresh-press motion-reduce:active:animate-none ${
                  mode === 'minimal'
                    ? 'border-ink bg-ink/[0.04]'
                    : 'border-ink/15 bg-white hover:bg-ink/[0.02]'
                }`}
              >
                <div className="text-xs font-semibold">Minimal</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  First names only, no dates
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('full')}
                className={`rounded-lg border px-3 py-2 text-left transition active:animate-fresh-press motion-reduce:active:animate-none ${
                  mode === 'full'
                    ? 'border-ink bg-ink/[0.04]'
                    : 'border-ink/15 bg-white hover:bg-ink/[0.02]'
                }`}
              >
                <div className="text-xs font-semibold">Full</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  Complete tree
                </div>
              </button>
            </div>

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
                          {mode === 'minimal' ? (
                            <>
                              <p className="text-xs text-ink">
                                Share my family tree with{' '}
                                <span className="font-semibold">
                                  {peer.name}
                                </span>
                                ?
                              </p>
                              <div className="mt-2 rounded-md border border-ink/10 bg-white px-2.5 py-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                                  This is exactly what {peer.name} will receive
                                </div>
                                <div className="mt-1 text-xs text-ink">
                                  {previewPeople} {previewPeople === 1
                                    ? 'person'
                                    : 'people'}{' '}
                                  · {previewGenerations}{' '}
                                  {previewGenerations === 1
                                    ? 'generation'
                                    : 'generations'}{' '}
                                  · first names only
                                </div>
                                {previewFirstNames.length > 0 && (
                                  <div className="mt-1 text-[11px] text-muted">
                                    {previewFirstNames.join(', ')}
                                    {previewPeople > previewFirstNames.length
                                      ? '…'
                                      : ''}
                                  </div>
                                )}
                                <div className="mt-1.5 text-[10px] text-muted">
                                  No surnames, no birth or death dates, no other
                                  wallet keys. Just first names and who is
                                  related to whom.
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-ink">
                              Share my <span className="font-semibold">full</span>{' '}
                              family tree with{' '}
                              <span className="font-semibold">{peer.name}</span>?
                              This sends {peopleCount} tree record
                              {peopleCount === 1 ? '' : 's'} — full names, dates,
                              and how everyone is related — to them and no one
                              else.
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void confirmShare(peer)}
                              className="flex-1 rounded-md bg-ink py-1.5 text-xs font-medium text-paper transition active:animate-fresh-press motion-reduce:active:animate-none"
                            >
                              Share with {peer.name}
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
