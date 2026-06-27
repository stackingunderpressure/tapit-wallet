import { useMemo, useState } from 'react';
import { envelopeId, type Attestation } from 'tapit-attest';
import {
  familyOtherRatifierCount,
  familySignatureProgress,
  isFamilyFounder,
  memberHasSigned,
  readFamilyUnit,
} from '../connections/familyUnit.ts';
import { IdentityChip } from '../connections/IdentityChip.tsx';
import { useWallet } from './useWallet.ts';
import { summarizePublish } from '../transport/publishStatus.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import {
  createPersonNode,
  addRelativeNode,
} from '../family-tree/createFamilyTree.ts';
import { buildKinGraph } from '../family-tree/kinGraph.ts';
import {
  keyedNodeIndex,
  treeNodeForPubkey,
  roleToTreeRelation,
} from '../family-tree/householdTreeJoin.ts';
import type { FamilyRole } from '../connections/familyUnit.ts';

// Identity-tab Family section. Renders a decked-out card per family
// unit the operator is a member of, with full CRUD on the operator's
// own copy:
//
//   Create — the "+ Start family" button (onStartFamily).
//   Read   — the card itself: family name, founded date, a Founder /
//            Member badge framing whether the operator founded this or
//            was named into it, per-member rows with role + as_of +
//            signed/awaiting state, and the N-of-M ratification chip.
//   Update — founder-only "Edit" button, enabled only while the
//            founder is the sole signer (familyOtherRatifierCount===0)
//            because re-signing mints a new envelopeId and orphans any
//            ratifications already collected. Opens StartFamilyModal in
//            edit mode via onEditFamily. Once another member has
//            ratified, Edit is hidden and the operator uses Delete +
//            recreate instead (a proper amendment-envelope flow that
//            preserves ratifications is a follow-up cut).
//   Delete — every card carries a destructive action on the operator's
//            OWN held copy. For the founder it reads "Delete family";
//            for a named member it reads "Leave family". Both call
//            unholdEnvelope, which removes only this wallet's copy —
//            the envelope still exists for anyone else who holds it.
//            This is the fix for the operator's stuck-wrong-wallet
//            family that previously had no removal path at all.
//
// Founder-side "Send to N awaiting members" ships the envelope via
// Mycelium to every named member that has not signed yet; the inbox
// silent-absorb path merges each returning cosigned copy back into
// holdings as members ratify.
//
// Bridge note: rotated wallets sign with their active key, which
// differs from the genesis identity pubkey the family-unit member list
// stores. familyUnit.ts's memberHasSigned + familySignatureProgress +
// familyOtherRatifierCount all accept an optional keyAliases map; this
// component passes a {wallet.identity → wallet.keyHistory} entry so the
// operator's own signature is detected regardless of rotation.

interface Props {
  familyUnits: readonly Attestation[];
  /** Pubkey → display-name lookup so member chips can resolve to
   *  friendly names when the operator has a handshake with them. */
  namesByPubkey: ReadonlyMap<string, string>;
  onStartFamily: () => void;
  /** Open the edit form for a family the operator founded and solely
   *  signed. The card gates the affordance before calling this. */
  onEditFamily: (att: Attestation) => void;
}

// Failure-only send status. Success and pending are surfaced by the
// derived-from-envelope per-member labels and the N-of-M chip, which
// persist across navigation because they're derived from holdings.
interface SendError {
  text: string;
}

function formatFounded(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function FamilyIdentitySections({
  familyUnits,
  namesByPubkey,
  onStartFamily,
  onEditFamily,
}: Props) {
  const { wallet, ownerId, holdings, save, refresh, sendEnvelope, unholdEnvelope } =
    useWallet();
  const worker = useAnchorWorker();
  const myIdentity = wallet.identity.toLowerCase();
  // Household ↔ tree join (one super Family tab, Tier 1). A household member
  // and a genealogy person-node for the same living person share a key — the
  // genesis pubkey — so this index lets each member row say whether that
  // person is already in the tree, and offer a one-tap add when they are not,
  // killing the double-entry between the two family models. Pure + derived
  // from holdings, so after an add the refresh re-derives it and the row flips.
  const treeIndex = useMemo(() => keyedNodeIndex(holdings), [holdings]);
  // Per-member tree-add progress + failure, keyed by member pubkey (a person
  // is the same person across families, so the pubkey is the right key).
  const [addingToTree, setAddingToTree] = useState<string | null>(null);
  const [treeAddError, setTreeAddError] = useState<Record<string, string>>({});

  async function addMemberToTree(member: {
    pubkey: string;
    name: string;
    role: FamilyRole;
  }) {
    setAddingToTree(member.pubkey);
    setTreeAddError((prev) => {
      const { [member.pubkey]: _gone, ...rest } = prev;
      return rest;
    });
    try {
      // Adding YOURSELF just roots the tree — create your self-node if it's
      // missing, never a relation (you are not your own parent). The badge
      // then flips to "in your tree".
      if (member.pubkey.toLowerCase() === myIdentity) {
        if (!treeNodeForPubkey(treeIndex, myIdentity)) {
          await createPersonNode(wallet, ownerId, worker, {
            displayName: namesByPubkey.get(myIdentity) ?? member.name,
            keyedPubkey: wallet.identity,
          });
          await save();
          await refresh();
        }
        return;
      }
      // The tree roots on your self-node; ensure it exists before attaching a
      // relative to it (mirrors the editor's ensureSelf).
      let selfId = treeNodeForPubkey(treeIndex, myIdentity);
      if (!selfId) {
        const { nodeId } = await createPersonNode(wallet, ownerId, worker, {
          displayName: namesByPubkey.get(myIdentity) ?? 'Me',
          keyedPubkey: wallet.identity,
        });
        selfId = nodeId;
      }
      const relation = roleToTreeRelation(member.role);
      // A sibling attaches under the parent you share; look up your first
      // recorded parent. addRelativeNode throws a friendly nudge if there
      // isn't one yet, surfaced as the per-row error below.
      let targetParentId: string | null = null;
      if (relation === 'sibling') {
        const graph = buildKinGraph(holdings);
        targetParentId = [...(graph.parents.get(selfId) ?? [])][0] ?? null;
      }
      // One writer of kin edges (addRelativeNode) places the member CONNECTED
      // by their household role — dad/mom above you, child below, spouse
      // beside, sibling under your shared parent — keyed to their pubkey, so a
      // person is entered once and the two family models reconcile. The match
      // guard on the button means we never duplicate someone already noded.
      await addRelativeNode(wallet, ownerId, worker, {
        relation,
        targetId: selfId,
        targetParentId,
        person: { displayName: member.name, keyedPubkey: member.pubkey },
      });
      await save();
      await refresh();
    } catch (err) {
      setTreeAddError((prev) => ({
        ...prev,
        [member.pubkey]: err instanceof Error ? err.message : 'add failed',
      }));
    } finally {
      setAddingToTree(null);
    }
  }
  // keyAliases[wallet.identity] = every key in the operator's history.
  // This is the bridge that fixes "founder shows unsigned after
  // rotation" — the signature's signer is the active key, which for a
  // rotated wallet differs from the genesis identity pubkey stored in
  // the family-unit member list.
  const keyAliases = useMemo<ReadonlyMap<string, readonly string[]>>(() => {
    const m = new Map<string, readonly string[]>();
    m.set(myIdentity, wallet.keyHistory.map((k) => k.toLowerCase()));
    return m;
  }, [myIdentity, wallet.keyHistory]);
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [errorByIndex, setErrorByIndex] = useState<Record<number, SendError>>({});
  // Inline two-step delete confirm, keyed by card index — mirrors the
  // PeerThread "Remove this person" pattern so the destructive action
  // is never a single tap.
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<Record<number, string>>({});

  async function sendToUnsignedMembers(
    idx: number,
    att: Attestation,
    targets: readonly { pubkey: string }[],
  ) {
    if (targets.length === 0) return;
    setSending((prev) => ({ ...prev, [idx]: true }));
    setErrorByIndex((prev) => {
      const { [idx]: _gone, ...rest } = prev;
      return rest;
    });
    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const result = await sendEnvelope(t.pubkey, att);
        const s = summarizePublish(result);
        if (s.tone === 'fail') failed += 1;
        else sent += 1;
      } catch {
        failed += 1;
      }
    }
    setSending((prev) => {
      const { [idx]: _gone, ...rest } = prev;
      return rest;
    });
    if (failed > 0) {
      const text =
        sent === 0
          ? `Could not reach any of the ${failed} member${failed === 1 ? '' : 's'}. Check your connection and try again.`
          : `Sent to ${sent}, ${failed} failed. Try again.`;
      setErrorByIndex((prev) => ({ ...prev, [idx]: { text } }));
    }
  }

  async function handleDelete(idx: number, att: Attestation) {
    setDeleting(idx);
    setDeleteError((prev) => {
      const { [idx]: _gone, ...rest } = prev;
      return rest;
    });
    try {
      await unholdEnvelope(envelopeId(att));
      // Holdings refresh re-derives familyUnits and the card drops out,
      // so no local removal bookkeeping is needed here.
      setConfirmingDelete(null);
    } catch (err) {
      setDeleteError((prev) => ({
        ...prev,
        [idx]: err instanceof Error ? err.message : 'remove failed',
      }));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          Family ({familyUnits.length})
        </h2>
        <button
          type="button"
          onClick={onStartFamily}
          className="text-xs font-medium text-accent hover:underline"
        >
          + Start family
        </button>
      </div>
      {familyUnits.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No families yet. Tap Start family to declare your family
          unit — name it, pick the people in it from your connections,
          and set their roles plus optional backdated dates (a kid's
          actual birthday, a spouse's marriage date) even though you
          sign today.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {familyUnits.map((a, i) => {
            const view = readFamilyUnit(a);
            const progress = familySignatureProgress(a, keyAliases);
            const signers = new Set(
              a.signatures.map((s) => s.signer.toLowerCase()),
            );
            const isFounder = isFamilyFounder(a, myIdentity);
            const founded = formatFounded(view.foundedAt);
            const otherRatifiers = familyOtherRatifierCount(a, keyAliases);
            const canEdit = isFounder && otherRatifiers === 0;
            const unsignedNonFounder = view.members.filter((m) => {
              const lower = m.pubkey.toLowerCase();
              if (lower === myIdentity) return false;
              return !memberHasSigned(m.pubkey, signers, keyAliases);
            });
            const sendBusy = !!sending[i];
            const error = errorByIndex[i];
            const isConfirming = confirmingDelete === i;
            const isDeleting = deleting === i;
            const delErr = deleteError[i];
            return (
              <li
                key={envelopeId(a)}
                className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {view.familyName || 'Unnamed family'}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          isFounder
                            ? 'bg-accent/10 text-accent'
                            : 'bg-ink/5 text-ink/70'
                        }`}
                      >
                        {isFounder ? 'You founded this' : 'You were named'}
                      </span>
                      <span>
                        {view.members.length} member
                        {view.members.length === 1 ? '' : 's'}
                      </span>
                      {founded && <span>· founded {founded}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {progress.signed} of {progress.total} signed
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {view.members.map((m) => {
                    const signed = memberHasSigned(m.pubkey, signers, keyAliases);
                    const memberIsFounder = isFamilyFounder(a, m.pubkey);
                    const isMe = m.pubkey.toLowerCase() === myIdentity;
                    return (
                      <li key={m.pubkey}>
                        <div className="flex items-center justify-between gap-2">
                          <IdentityChip
                            pubkey={m.pubkey}
                            name={m.name}
                            namesByPubkey={namesByPubkey}
                            size="sm"
                            hideShortKey
                          />
                          <div className="shrink-0 flex items-center gap-1">
                            {memberIsFounder && (
                              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-accent">
                                Founder
                              </span>
                            )}
                            {isMe && (
                              <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink/70">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-10 -mt-1 text-[10px] uppercase tracking-wide text-muted">
                          {m.role}
                          {m.as_of ? ` · since ${m.as_of}` : ''}
                          {signed ? (
                            <span className="text-emerald-700"> · confirmed</span>
                          ) : (
                            <span className="text-amber-700"> · waiting for them</span>
                          )}
                        </div>
                        {/* Household ↔ tree reconciliation. One person, one
                            entry: if they're already a node in your tree say
                            so, otherwise offer the one-tap add that ends the
                            retype. */}
                        {treeNodeForPubkey(treeIndex, m.pubkey) ? (
                          <div className="ml-10 mt-0.5 text-[10px] text-emerald-700">
                            In your tree ✓
                          </div>
                        ) : (
                          <div className="ml-10 mt-0.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void addMemberToTree({
                                  pubkey: m.pubkey,
                                  name: m.name,
                                  role: m.role,
                                })
                              }
                              disabled={addingToTree === m.pubkey}
                              className="text-[10px] font-medium text-accent hover:underline disabled:opacity-60"
                            >
                              {addingToTree === m.pubkey
                                ? 'Adding to your tree…'
                                : '+ Add to your tree'}
                            </button>
                            {treeAddError[m.pubkey] && (
                              <span className="text-[10px] text-red-600" role="alert">
                                {treeAddError[m.pubkey]}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {isFounder && unsignedNonFounder.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        void sendToUnsignedMembers(i, a, unsignedNonFounder)
                      }
                      disabled={sendBusy}
                      className="w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-60"
                    >
                      {sendBusy
                        ? 'Sending…'
                        : `Ask ${unsignedNonFounder.length} ${unsignedNonFounder.length === 1 ? 'member' : 'members'} to confirm`}
                    </button>
                  </div>
                )}
                {error && (
                  <p className="mt-2 text-xs text-red-700" role="alert">
                    {error.text}
                  </p>
                )}

                {/* CRUD action row. Edit is a bordered button rather
                    than a hover-underline link because the label "Edit"
                    by itself does not telegraph that the surface behind
                    it carries per-member Remove + Role + As-of editing —
                    the operator surfaced this directly 2026-05-31
                    ("I see Edit on the card but didn't realize it opens
                    per-member editing"). The expanded label + button
                    chrome makes the scope discoverable without changing
                    behavior. Delete stays as a subtler red link because
                    destructive should be less prominent than the
                    constructive editing path. */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink/5 pt-3">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onEditFamily(a)}
                      className="rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                    >
                      Edit family & members
                    </button>
                  ) : isFounder ? (
                    <span className="text-[10px] text-muted">
                      Editing is locked — {otherRatifiers} member
                      {otherRatifiers === 1 ? ' has' : 's have'} confirmed.
                      Delete and recreate to change who's in it.
                    </span>
                  ) : (
                    <span />
                  )}
                  {!isConfirming && (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(i)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      {isFounder ? 'Delete family' : 'Leave family'}
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
                    <p className="text-red-900">
                      {isFounder ? (
                        <>
                          Delete{' '}
                          <span className="font-semibold">
                            {view.familyName || 'this family'}
                          </span>{' '}
                          from your wallet? It leaves your holdings. Members
                          who already hold a copy keep theirs — this only
                          removes it here. Use this to clear out a family you
                          created by mistake or on the wrong wallet.
                        </>
                      ) : (
                        <>
                          Leave{' '}
                          <span className="font-semibold">
                            {view.familyName || 'this family'}
                          </span>
                          ? Your copy leaves your holdings. The founder and
                          other members keep theirs.
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(i, a)}
                        disabled={isDeleting}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                      >
                        {isDeleting
                          ? 'Removing…'
                          : isFounder
                            ? 'Delete'
                            : 'Leave'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        disabled={isDeleting}
                        className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                    {delErr && (
                      <p className="mt-2 text-red-700" role="alert">
                        {delErr}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
