import { useEffect, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  foreignTreesStore,
  type ForeignTreeRecord,
} from '../storage/foreignTreesStore.ts';
import {
  buildKinGraph,
  type KinGraph,
  type KinNode,
} from '../family-tree/kinGraph.ts';
import { mergeCandidates } from '../family-tree/mergeCandidates.ts';
import { kinGraphFromProjection } from './familyTreeProjection.ts';
import { createKinEdge } from '../family-tree/createFamilyTree.ts';
import { heldSameAsPairs, pairIsLinked } from '../family-tree/sameAsLinks.ts';
import { FamilyTreeCanvas } from '../family-tree/FamilyTreeCanvas.tsx';
import { KinAvatar } from '../family-tree/KinAvatar.tsx';
import { genderKinLabel } from '../family-tree/gender.ts';

// Friends' trees — the read-only RECEIVE + VIEW surface (slice 1).
//
// PRIVACY RAIL #2: friends' trees are read ONLY from the encrypted
// foreignTreesStore; they are never wallet.hold'd and never folded into the
// operator's own kin graph. The operator's own tree (the Your-tree tab) is
// unaffected by anything here.
//
// PRIVACY RAIL #5: a friend's tree is strictly READ-ONLY. The person detail
// below is a presentational panel with NO edit, add, remove, or sign controls
// — you can look at who your friend is related to, and that is all.
//
// PRIVACY RAIL #6: every view leads with provenance — "{friend}'s tree —
// shared with you on {date}" — and the friend's sender pubkey is shown so the
// share is attributable.
//
// PRIVACY RAIL #7: "People you both know" is sourced from mergeCandidates — a
// pure, read-only highlight of keyless people who look like the same person in
// both trees, anchored on the friend you both connect through.
//
// CONSENTED SAME-AS MERGE SLICE (2026-06-16): a candidate pair can be CONFIRMED
// as one person by an explicit per-pair human tap, which signs a same_as kin-
// edge binding YOUR node id to the FRIEND's node id, then holds + anchors + saves
// it (via createKinEdge, the wallet's standard sign -> hold -> anchorQueue
// pipeline). Rails enforced here:
//   - NEVER auto-merge: a bind happens only on an explicit per-pair confirm tap.
//     No bind on render, no bulk "merge all".
//   - The same_as edge carries ONLY the two node ids + the signer's signature
//     (buildSameAsEdgeDraft) — no names, no dates, no foreign personal data.
//   - Binding does NOT import the friend's personal data: the ONLY thing held is
//     the same_as edge (ids). The friend's tree stays in foreignTreesStore,
//     untouched; we never wallet.hold a foreign attestation here.
//   - The friend-tree view stays otherwise READ-ONLY — the confirm-bind is the
//     only new write; no edit/remove of the friend's people.
//   - Honest reversibility: a same_as edge is append-only and signed, so a wrong
//     bind is the user's own local CLAIM, correctable later by a removal follow-on
//     (unbind is a DEFERRED slice; a wrong bind is not catastrophic).
// Already-confirmed pairs are detected by reading the user's own held same_as
// edges (sameAsLinks.heldSameAsPairs) and matching the candidate's two node ids
// in either order; confirmed pairs render in a "linked" state.

interface Props {
  /** Optional: open straight onto one friend's tree (e.g. deep link). */
  initialFromPubkey?: string;
}

function formatShared(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'an unknown date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function FriendTreesView({ initialFromPubkey }: Props) {
  const { wallet, ownerId, anchorWorker, passphrase, holdings, save } =
    useWallet();
  const [records, setRecords] = useState<ForeignTreeRecord[] | null>(null);
  const [openFrom, setOpenFrom] = useState<string | null>(
    initialFromPubkey ?? null,
  );
  const [selected, setSelected] = useState<{
    node: KinNode;
    relationship: string;
  } | null>(null);
  // Pairs the human confirmed THIS session (order-insensitive keys), shown
  // immediately so the row flips to "linked" before the holdings refresh lands.
  const [optimisticLinked, setOptimisticLinked] = useState<Set<string>>(
    () => new Set(),
  );
  // The candidate pair a same_as bind is in flight for ("mineId:theirsId"),
  // so its single confirm button can show a pending state and stay disabled.
  const [binding, setBinding] = useState<string | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await foreignTreesStore.load(ownerId, passphrase);
      if (!cancelled) setRecords(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, passphrase]);

  const open = useMemo(
    () => records?.find((r) => r.fromPubkey === openFrom) ?? null,
    [records, openFrom],
  );

  // The friend's graph, built PURELY from their shared data. A MINIMAL share
  // (projection present) is reconstructed directly from the redacted projection
  // (kinGraphFromProjection) — first names + structure + the one shared-anchor
  // key, nothing else ever crossed the wire. A FULL share (legacy / opt-in) is
  // built from the shared attestations. Either way this is a separate graph
  // object — never merged into the operator's holdings.
  const theirGraph = useMemo<KinGraph | null>(() => {
    if (!open) return null;
    if (open.projection) return kinGraphFromProjection(open.projection);
    return buildKinGraph(open.trees);
  }, [open]);

  // The operator's own graph, for the read-only "people you both know"
  // highlight only.
  const myGraph = useMemo<KinGraph>(
    () => buildKinGraph(holdings as Attestation[]),
    [holdings],
  );

  // People you both know — anchored on the friend (the sender) you both
  // connect through. Pure, read-only; never auto-binds.
  const bothKnow = useMemo(() => {
    if (!theirGraph || !open) return [];
    return mergeCandidates(myGraph, theirGraph, open.fromPubkey);
  }, [myGraph, theirGraph, open]);

  // The same_as pairs THIS wallet already holds (read from own holdings only —
  // the friend's foreign tree is never consulted). Order-insensitive keys.
  const heldPairs = useMemo(
    () => heldSameAsPairs(holdings as Attestation[]),
    [holdings],
  );

  // A candidate is CONFIRMED when a held same_as edge binds its two node ids
  // (either order), OR it was confirmed this session (optimistic).
  function isConfirmed(mineId: string, theirsId: string): boolean {
    return (
      pairIsLinked(heldPairs, mineId, theirsId) ||
      pairIsLinked(optimisticLinked, mineId, theirsId)
    );
  }

  // CONSENTED bind: sign a same_as edge (your node id <-> friend's node id),
  // hold + anchor + save it, then mark the pair confirmed optimistically. The
  // edge carries only the two ids + your signature; no foreign data is held.
  async function confirmSamePerson(mineId: string, theirsId: string) {
    const rowKey = `${mineId}:${theirsId}`;
    setBindError(null);
    setBinding(rowKey);
    try {
      await createKinEdge(wallet, ownerId, anchorWorker, 'same_as', mineId, theirsId);
      await save();
      setOptimisticLinked((prev) => {
        const next = new Set(prev);
        next.add(mineId < theirsId ? `${mineId} ${theirsId}` : `${theirsId} ${mineId}`);
        return next;
      });
    } catch (e) {
      setBindError(e instanceof Error ? e.message : 'Could not link these people.');
    } finally {
      setBinding(null);
    }
  }

  if (records === null) {
    return (
      <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
        Loading shared trees…
      </div>
    );
  }

  // ----- Detail of one friend's tree -----
  if (open && theirGraph) {
    if (selected) {
      return (
        <ReadOnlyPersonDetail
          person={selected.node}
          relationship={selected.relationship}
          onBack={() => setSelected(null)}
        />
      );
    }
    return (
      <section className="mt-5">
        <button
          type="button"
          onClick={() => {
            setOpenFrom(null);
            setSelected(null);
          }}
          className="text-sm text-muted hover:text-ink"
        >
          ← Friends' trees
        </button>

        <div className="mt-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2">
          <div className="text-sm font-semibold">
            {open.sharerName}'s tree
          </div>
          <div className="text-[11px] text-muted">
            Shared with you on {formatShared(open.sharedAt)}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted">
            from {open.fromPubkey.slice(0, 16)}…
          </div>
        </div>

        <div className="mt-3">
          <FamilyTreeCanvas
            graph={theirGraph}
            selfId={open.rootNodeId}
            onSelect={(node, relationship) =>
              setSelected({ node, relationship })
            }
          />
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            People you both know
          </div>
          {bothKnow.length === 0 ? (
            <p className="mt-1 text-xs text-muted">
              No overlapping people surfaced yet. As your trees grow around the
              relatives you share, the same people show up here.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {bothKnow.map((c) => {
                const rowKey = `${c.mine.id}:${c.theirs.id}`;
                const confirmed = isConfirmed(c.mine.id, c.theirs.id);
                const pending = binding === rowKey;
                const yourName = c.mine.displayName;
                const friendName = c.theirs.displayName;
                return (
                  <li
                    key={rowKey}
                    className={`rounded-lg border px-3 py-2 ${
                      confirmed
                        ? 'border-accent/30 bg-accent/[0.06]'
                        : 'border-ink/10 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <KinAvatar node={c.theirs} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {friendName}
                        </div>
                        {confirmed ? (
                          <div className="truncate text-[11px] text-accent">
                            ✓ Linked — same as your {yourName}
                          </div>
                        ) : (
                          <div className="truncate text-[11px] text-muted">
                            {c.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    {!confirmed && (
                      <div className="mt-2">
                        <p className="text-[11px] text-muted">
                          Link {open.sharerName}'s "{friendName}" with your "
                          {yourName}" as one person?
                        </p>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            void confirmSamePerson(c.mine.id, c.theirs.id)
                          }
                          className="mt-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-60"
                        >
                          {pending
                            ? 'Linking…'
                            : 'This is the same person — link them'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {bindError && (
            <p className="mt-1 text-[11px] text-red-600">{bindError}</p>
          )}
          <p className="mt-1 text-[10px] text-muted">
            Linking signs a private claim that these two records are one person.
            It binds only the two records' ids — none of your friend's details
            are copied into your wallet, and their tree is left untouched.
          </p>
        </div>
      </section>
    );
  }

  // ----- List of friends who shared a tree -----
  return (
    <section className="mt-5">
      {records.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
          No one has shared their family tree with you yet. When a relative taps
          "Share my family tree with you," it appears here — read-only, yours to
          look through.
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.fromPubkey}>
              <button
                type="button"
                onClick={() => setOpenFrom(r.fromPubkey)}
                className="w-full rounded-lg border border-ink/10 bg-white px-4 py-3 text-left transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.03]"
              >
                <div className="text-sm font-medium">{r.sharerName}'s tree</div>
                <div className="text-[11px] text-muted">
                  Shared with you on {formatShared(r.sharedAt)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A strictly READ-ONLY person detail for a friend's tree node. No edit, add,
// remove, or sign controls — the operator can only look. Mirrors the visual
// shape of the real PersonDetailView header without any of its mutating
// machinery (privacy rail #5).
function ReadOnlyPersonDetail({
  person,
  relationship,
  onBack,
}: {
  person: KinNode;
  relationship: string;
  onBack: () => void;
}) {
  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted hover:text-ink"
      >
        ← Tree
      </button>

      <div className="mt-3 flex flex-col items-center text-center animate-fresh-rise motion-reduce:animate-none">
        <KinAvatar node={person} size={64} />
        <h2 className="mt-2 text-xl font-semibold">{person.displayName}</h2>
        <span className="mt-1 rounded-full bg-accent/10 px-3 py-0.5 text-sm font-medium text-accent">
          {genderKinLabel(relationship, person.sex)}
        </span>
        <div className="mt-1 text-xs text-muted">
          {person.born || person.died ? (
            <span>
              {person.born ?? '?'}
              {person.died ? `–${person.died}` : ''}
            </span>
          ) : null}
          {!person.keyed && (
            <span className={person.born || person.died ? 'ml-1' : ''}>
              · remembered in this tree
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-ink/[0.03] px-3 py-2 text-center text-xs text-muted">
        This is your friend's record of {person.displayName}. You are viewing it
        read-only — nothing here can be edited from your wallet.
      </p>
    </section>
  );
}
