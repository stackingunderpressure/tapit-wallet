import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import {
  buildKinGraph,
  generationOf,
  type KinGraph,
  type KinNode,
} from './kinGraph.ts';
import {
  createPersonNode,
  createKinEdge,
  createPersonEdit,
} from './createFamilyTree.ts';
import { readPersonChanges } from './personEdit.ts';
import { groupByGeneration } from './treeGenerations.ts';
import { withAncestorSlots } from './ancestorSlots.ts';
import { storiesAbout } from './storiesAbout.ts';
import type { Sex } from './personNode.ts';
import { FamilyTreeCanvas } from './FamilyTreeCanvas.tsx';
import { PersonDetailView } from './PersonDetailView.tsx';
import { normalizeEventDateInput } from '../journal/momentDate.ts';
import { createJournalEntry } from '../journal/createJournalEntry.ts';
import type { Attestation } from 'tapit-attest';

// Family-tree CUT 1 — the edit-your-adjacent-layer editor.
//
// You only ever add the people closest to you — your parents, your kids,
// your spouse, your siblings. The deep tree self-assembles later when you
// handshake relatives (the merge cut). Adding a "parent"/"child"/"spouse"
// is one primitive edge from your own node; a "sibling" attaches under a
// shared parent (so you need a parent on the tree first). Each add signs
// + holds + anchors a witnessed person-node plus the edge, then saves.

type Relation = 'parent' | 'child' | 'spouse' | 'sibling';

const RELATION_CHIPS: { value: Relation; label: string; emoji: string }[] = [
  { value: 'parent', label: 'Parent', emoji: '↑' },
  { value: 'sibling', label: 'Sibling', emoji: '↔' },
  { value: 'spouse', label: 'Spouse', emoji: '∞' },
  { value: 'child', label: 'Child', emoji: '↓' },
];

// The sex toggle reads in the family's own words for the chosen relation —
// "Mother / Father" when adding a parent, "Sister / Brother" for a sibling —
// so a person can say which one without learning the word "sex". Optional;
// left unset, the tree keeps the neutral label.
const SEX_LABELS: Record<Relation, { female: string; male: string }> = {
  parent: { female: 'Mother', male: 'Father' },
  child: { female: 'Daughter', male: 'Son' },
  sibling: { female: 'Sister', male: 'Brother' },
  spouse: { female: 'Wife', male: 'Husband' },
};

interface Props {
  /** Modal mode supplies this; embedded tab mode omits it. */
  onClose?: () => void;
  /** When true, render as an inline page (the Family tab) instead of a
   *  full-screen modal — no overlay, no "Done" button. */
  embedded?: boolean;
}

interface Extra {
  nodes: KinNode[];
  parents: [string, string][]; // [parentId, childId]
  spouses: [string, string][];
}

function addToSet(map: Map<string, Set<string>>, k: string, v: string) {
  let s = map.get(k);
  if (!s) {
    s = new Set();
    map.set(k, s);
  }
  s.add(v);
}

export function FamilyTreeEditor({ onClose, embedded = false }: Props) {
  const { wallet, ownerId, passphrase, prefs, holdings, save } = useWallet();
  const worker = useAnchorWorker();

  const [extra, setExtra] = useState<Extra>({
    nodes: [],
    parents: [],
    spouses: [],
  });
  // Optimistic signed corrections (rename / dates / sex / remove) — appended
  // to the holdings the graph is folded from so an edit shows instantly,
  // before the wallet context refreshes.
  const [addedEdits, setAddedEdits] = useState<Attestation[]>([]);
  // Per-person edit panel state (only meaningful while a person is selected).
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBorn, setEditBorn] = useState('');
  const [editDied, setEditDied] = useState('');
  const [editSex, setEditSex] = useState<Sex | undefined>(undefined);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('parent');
  const [sex, setSex] = useState<Sex | undefined>(undefined);
  const [born, setBorn] = useState('');
  const [died, setDied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When you tap an empty "known spot above you" in the tree, the add form
  // below points at that child so a new name lands as their parent.
  const [slotTarget, setSlotTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  // When set, the modal shows that person's detail (relationship + the
  // moments you've signed about them) instead of the editor.
  const [selected, setSelected] = useState<{
    node: KinNode;
    relationship: string;
  } | null>(null);
  // Moments composed from within a person's detail, kept locally so they
  // show immediately; they are also real held+anchored journal entries.
  const [addedStories, setAddedStories] = useState<Attestation[]>([]);
  const [momentText, setMomentText] = useState('');
  const [momentDate, setMomentDate] = useState('');
  const [momentBusy, setMomentBusy] = useState(false);
  const [momentError, setMomentError] = useState<string | null>(null);

  // The add form (name/relation/dates) is shared between the main "add to
  // me" view and a person's detail "add a relative of them" view — only
  // one renders at a time. Clear it whenever you switch so nothing leaks
  // across people.
  useEffect(() => {
    setName('');
    setBorn('');
    setDied('');
    setSex(undefined);
    setError(null);
    setRelation('parent');
    setEditing(false);
    setEditError(null);
    setConfirmRemove(false);
  }, [selected]);

  async function addMoment(person: KinNode) {
    if (momentText.trim().length === 0) {
      setMomentError('Write a few words first.');
      return;
    }
    if (!passphrase) {
      setMomentError('Wallet is locked — sign in again.');
      return;
    }
    setMomentBusy(true);
    setMomentError(null);
    try {
      const { attestation } = await createJournalEntry(
        wallet,
        ownerId,
        passphrase,
        worker,
        {
          text: momentText.trim(),
          category: 'Family',
          subject: person.keyedPubkey ?? person.displayName,
          subjectNode: person.id,
          eventDate: normalizeEventDateInput(momentDate),
        },
        prefs.cloudSync,
      );
      await save();
      setAddedStories((prev) => [attestation, ...prev]);
      setMomentText('');
      setMomentDate('');
    } catch (err) {
      setMomentError(
        err instanceof Error ? err.message : 'Could not save this moment.',
      );
    } finally {
      setMomentBusy(false);
    }
  }

  // Merge the persisted graph with the optimistic adds so a just-added
  // relative shows immediately, regardless of context refresh timing.
  // Holdings the tree is folded from, plus optimistic corrections.
  const sourceHoldings = useMemo(
    () => [...holdings, ...addedEdits],
    [holdings, addedEdits],
  );

  const graph = useMemo<KinGraph>(() => {
    const g = buildKinGraph(sourceHoldings);
    for (const n of extra.nodes) if (!g.nodes.has(n.id)) g.nodes.set(n.id, n);
    for (const [p, c] of extra.parents) {
      addToSet(g.parents, c, p);
      addToSet(g.children, p, c);
    }
    for (const [a, b] of extra.spouses) {
      addToSet(g.spouses, a, b);
      addToSet(g.spouses, b, a);
    }
    return g;
  }, [sourceHoldings, extra]);

  const selfId = useMemo<string | null>(() => {
    for (const node of graph.nodes.values()) {
      if (node.keyedPubkey === wallet.identity.toLowerCase()) return node.id;
    }
    return null;
  }, [graph, wallet.identity]);

  // The graph the CANVAS draws: the real graph plus dashed placeholder slots
  // for the missing known spots above you (your unfilled parents and
  // grandparents). Kept separate so stats / generations stay counted off the
  // real people only.
  const canvasGraph = useMemo<KinGraph>(
    () => withAncestorSlots(graph, selfId),
    [graph, selfId],
  );

  const myParentId = selfId
    ? [...(graph.parents.get(selfId) ?? [])][0] ?? null
    : null;
  const canSibling = Boolean(selfId && myParentId);

  // Generation rows (oldest at top, you in the middle, children below) —
  // the tree read as a shape rather than a flat list.
  const generations = useMemo(
    () => groupByGeneration(graph, selfId),
    [graph, selfId],
  );
  const hasPeople = graph.nodes.size > (selfId ? 1 : 0);
  const peopleCount = graph.nodes.size;
  const generationSpan = generations.length;

  // Delightful, honest headline numbers about the tree — the Merkle family
  // tree "screaming" what it knows back at you. All derived from the graph.
  const stats = useMemo(() => {
    let back = 0;
    let forward = 0;
    let remembered = 0;
    let keyed = 0;
    let oldestYear: number | null = null;
    for (const node of graph.nodes.values()) {
      if (node.keyed) keyed++;
      else remembered++;
      if (selfId && node.id !== selfId) {
        const g = generationOf(graph, selfId, node.id);
        if (g !== null && g > 0) back = Math.max(back, g);
        if (g !== null && g < 0) forward = Math.max(forward, -g);
      }
      const year = node.born ? new Date(node.born).getFullYear() : NaN;
      if (!Number.isNaN(year) && (oldestYear === null || year < oldestYear)) {
        oldestYear = year;
      }
    }
    const links =
      [...graph.parents.values()].reduce((n, s) => n + s.size, 0) +
      [...graph.spouses.values()].reduce((n, s) => n + s.size, 0) / 2;
    return { back, forward, remembered, keyed, oldestYear, links };
  }, [graph, selfId]);

  // The selected person's append-only change history + governance verdict.
  const changes = useMemo(
    () =>
      selected
        ? readPersonChanges(
            sourceHoldings,
            selected.node.aliasIds ?? [selected.node.id],
            selected.node,
          )
        : null,
    [selected, sourceHoldings],
  );

  function openEdit(person: KinNode) {
    setEditName(person.displayName);
    setEditBorn(person.born ?? '');
    setEditDied(person.died ?? '');
    setEditSex(person.sex);
    setEditError(null);
    setConfirmRemove(false);
    setEditing(true);
  }

  // Sign an append-only correction to the selected person. While the person is
  // solo-controlled this takes effect at once; once two signers control them
  // it is saved as a proposal that applies only when the others co-sign.
  async function applyEdit(person: KinNode) {
    if (editName.trim().length === 0) {
      setEditError('Give this person a name.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const { attestation } = await createPersonEdit(
        wallet,
        ownerId,
        worker,
        person.id,
        {
          displayName: editName.trim(),
          born: editBorn.trim() || undefined,
          died: editDied.trim() || undefined,
          sex: editSex,
        },
      );
      await save();
      setAddedEdits((prev) => [...prev, attestation]);
      setEditing(false);
      // Reflect the change in the open detail header immediately.
      setSelected((s) =>
        s
          ? {
              ...s,
              node: {
                ...s.node,
                displayName: editName.trim(),
                born: editBorn.trim() || undefined,
                died: editDied.trim() || undefined,
                sex: editSex,
              },
            }
          : s,
      );
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Could not save this change.',
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function removePerson(person: KinNode) {
    setEditBusy(true);
    setEditError(null);
    try {
      const { attestation } = await createPersonEdit(
        wallet,
        ownerId,
        worker,
        person.id,
        { removed: true, displayName: person.displayName },
      );
      await save();
      setAddedEdits((prev) => [...prev, attestation]);
      setSelected(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Could not remove this person.',
      );
    } finally {
      setEditBusy(false);
    }
  }

  // Short, friendly label for who signed a change.
  function signerLabel(signer: string): string {
    return signer === wallet.identity.toLowerCase()
      ? 'you'
      : `${signer.slice(0, 8)}…`;
  }

  async function ensureSelf(): Promise<string> {
    if (selfId) return selfId;
    const myName =
      [...graph.nodes.values()].find(
        (n) => n.keyedPubkey === wallet.identity.toLowerCase(),
      )?.displayName ?? 'Me';
    const { nodeId, attestation } = await createPersonNode(
      wallet,
      ownerId,
      worker,
      { displayName: myName, keyedPubkey: wallet.identity },
    );
    const view: KinNode = {
      id: nodeId,
      displayName: myName,
      keyed: true,
      keyedPubkey: wallet.identity.toLowerCase(),
    };
    void attestation;
    setExtra((e) => ({ ...e, nodes: [...e.nodes, view] }));
    return nodeId;
  }

  // Add a relative of WHOEVER `resolveTarget` returns — yourself (from the
  // main form) or any person you've tapped into (from their detail). This
  // is what lets the tree grow outward: add Mom, then from Mom add her
  // parents (your grandparents), her siblings (your aunts/uncles), and so
  // on — so great-uncles and third cousins actually come into being.
  async function addRelative(resolveTarget: () => Promise<string>): Promise<void> {
    if (name.trim().length === 0) {
      setError('Give this person a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const targetId = await resolveTarget();
      const targetParent = [...(graph.parents.get(targetId) ?? [])][0] ?? null;
      if (relation === 'sibling' && !targetParent) {
        throw new Error(
          'Add a parent for this person first — siblings are linked by the parent they share.',
        );
      }
      const { nodeId: relId } = await createPersonNode(wallet, ownerId, worker, {
        displayName: name.trim(),
        born: born.trim() || undefined,
        died: died.trim() || undefined,
        sex,
      });
      const relNode: KinNode = {
        id: relId,
        displayName: name.trim(),
        born: born.trim() || undefined,
        died: died.trim() || undefined,
        sex,
        keyed: false,
      };
      const newParents: [string, string][] = [];
      const newSpouses: [string, string][] = [];
      if (relation === 'parent') {
        await createKinEdge(wallet, ownerId, worker, 'parent_of', relId, targetId);
        newParents.push([relId, targetId]);
      } else if (relation === 'child') {
        await createKinEdge(wallet, ownerId, worker, 'parent_of', targetId, relId);
        newParents.push([targetId, relId]);
      } else if (relation === 'spouse') {
        await createKinEdge(wallet, ownerId, worker, 'spouse', targetId, relId);
        newSpouses.push([targetId, relId]);
      } else {
        await createKinEdge(
          wallet,
          ownerId,
          worker,
          'parent_of',
          targetParent as string,
          relId,
        );
        newParents.push([targetParent as string, relId]);
      }
      await save();
      setExtra((prev) => ({
        nodes: [...prev.nodes, relNode],
        parents: [...prev.parents, ...newParents],
        spouses: [...prev.spouses, ...newSpouses],
      }));
      setName('');
      setBorn('');
      setDied('');
      setSex(undefined);
      setSlotTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to your tree.');
    } finally {
      setBusy(false);
    }
  }

  // Tapping an empty "known spot above you" — point the add form at that
  // child as a parent add. We stay on the tree view and prime the form below.
  function openSlot(childId: string) {
    const child = graph.nodes.get(childId);
    setSlotTarget({ id: childId, name: child?.displayName || 'this person' });
    setRelation('parent');
    setName('');
    setBorn('');
    setDied('');
    setSex(undefined);
    setError(null);
  }

  // The shared add-relative form — rendered on the main view ("add to me")
  // and on a person's detail ("add a relative of them"). Same state, one at
  // a time, cleared on view switch by the effect above.
  function renderAddForm(opts: {
    onAdd: () => void;
    canSibling: boolean;
    relationLabel: string;
    submitLabel: string;
  }) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          opts.onAdd();
        }}
        className="mt-4 space-y-3"
      >
        <div>
          <label className="text-sm font-medium" htmlFor="ft-name">
            Name
          </label>
          <input
            id="ft-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Grandma Pam"'
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <span className="text-sm font-medium">{opts.relationLabel}</span>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {RELATION_CHIPS.map((c) => {
              const active = relation === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setRelation(c.value)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium transition active:animate-fresh-press motion-reduce:active:animate-none ${
                    active
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]'
                  }`}
                >
                  <span aria-hidden className="block text-sm">
                    {c.emoji}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
          {relation === 'sibling' && !opts.canSibling && (
            <p className="mt-1 text-xs text-amber-700">
              Add a parent first — siblings are linked by the parent they share.
            </p>
          )}
        </div>
        <div>
          <span className="text-sm font-medium">
            {SEX_LABELS[relation].female} or {SEX_LABELS[relation].male}?{' '}
            <span className="font-normal text-muted">(optional)</span>
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(['female', 'male'] as const).map((s) => {
              const active = sex === s;
              return (
                <button
                  key={s}
                  type="button"
                  // Tap the active one again to clear it (back to unspecified).
                  onClick={() => setSex(active ? undefined : s)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition active:animate-fresh-press motion-reduce:active:animate-none ${
                    active
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]'
                  }`}
                >
                  <span aria-hidden className="mr-1">
                    {s === 'female' ? '♀' : '♂'}
                  </span>
                  {SEX_LABELS[relation][s]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted" htmlFor="ft-born">
              Born (optional)
            </label>
            <input
              id="ft-born"
              type="date"
              value={born}
              onChange={(e) => setBorn(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted" htmlFor="ft-died">
              Died (optional)
            </label>
            <input
              id="ft-died"
              type="date"
              value={died}
              onChange={(e) => setDied(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-ink py-3 text-paper font-medium transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-40"
        >
          {busy ? 'Adding…' : opts.submitLabel}
        </button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  // Page/modal chrome. Embedded (the Family tab) renders inline; modal mode
  // keeps the full-screen overlay. A plain function, not a component, so the
  // form inputs inside never remount and lose focus between renders.
  const frame = (children: ReactNode) =>
    embedded ? (
      <div>{children}</div>
    ) : (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
          {children}
        </div>
      </div>
    );

  if (selected) {
    const person = selected.node;
    const stories = storiesAbout([...addedStories, ...holdings], person);
    return frame(
      <PersonDetailView
        person={person}
        relationship={selected.relationship}
        embedded={embedded}
        onBack={() => setSelected(null)}
        onClose={onClose}
        stories={stories}
        changes={changes}
        editing={editing}
        editName={editName}
        setEditName={setEditName}
        editBorn={editBorn}
        setEditBorn={setEditBorn}
        editDied={editDied}
        setEditDied={setEditDied}
        editSex={editSex}
        setEditSex={setEditSex}
        editBusy={editBusy}
        editError={editError}
        confirmRemove={confirmRemove}
        setConfirmRemove={setConfirmRemove}
        onOpenEdit={() => openEdit(person)}
        onApplyEdit={() => void applyEdit(person)}
        onRemove={() => void removePerson(person)}
        onCancelEdit={() => setEditing(false)}
        signerLabel={signerLabel}
        momentText={momentText}
        setMomentText={setMomentText}
        momentDate={momentDate}
        setMomentDate={setMomentDate}
        momentBusy={momentBusy}
        momentError={momentError}
        onAddMoment={() => void addMoment(person)}
        renderAddForm={renderAddForm}
        onAddRelative={() => void addRelative(() => Promise.resolve(person.id))}
        canSibling={(graph.parents.get(person.id)?.size ?? 0) > 0}
      />,
    );
  }

  return frame(
    <>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">🌳 Your family tree</h2>
            {hasPeople && (
              <div className="mt-0.5 text-xs text-muted">
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'} ·{' '}
                {generationSpan} generation{generationSpan === 1 ? '' : 's'}
              </div>
            )}
          </div>
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-ink"
            >
              Done
            </button>
          )}
        </div>

        {hasPeople && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { n: peopleCount, label: peopleCount === 1 ? 'person' : 'people' },
              {
                n: generationSpan,
                label: generationSpan === 1 ? 'generation' : 'generations',
              },
              { n: stats.back, label: stats.back === 1 ? 'gen back' : 'gens back' },
              {
                n: stats.forward,
                label: stats.forward === 1 ? 'gen ahead' : 'gens ahead',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-ink/10 bg-white px-1 py-2 text-center"
              >
                <div className="text-lg font-semibold text-accent">{s.n}</div>
                <div className="text-[10px] leading-tight text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
        {hasPeople && (
          <p className="mt-2 text-center text-[11px] text-muted">
            🌳 Rooted by you{stats.oldestYear ? `, back to ${stats.oldestYear}` : ''}
            {' '}· {Math.round(stats.links)} ties · anchored to Bitcoin
          </p>
        )}
        {!hasPeople && (
          <p className="mt-1 text-xs text-muted">
            Add the people closest to you — the rest fills in as you connect
            with family. Tap anyone to see how you're related, fix details, or
            keep their stories. People with no wallet are simply remembered by
            you.
          </p>
        )}

        <div className="mt-4 rounded-xl border border-ink/10 bg-white p-2.5">
          {!hasPeople ? (
            <p className="px-1 py-2 text-sm text-muted">
              No one here yet 🌱 — add your first relative below and watch your
              tree grow.
            </p>
          ) : (
            <FamilyTreeCanvas
              graph={canvasGraph}
              selfId={selfId}
              onSelect={(node, relationship) =>
                setSelected({ node, relationship })
              }
              onAddAncestor={openSlot}
            />
          )}
        </div>

        {slotTarget && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-ink/15 bg-accent/10 px-3 py-2">
            <span className="text-xs text-ink">
              🌿 Filling in a parent for{' '}
              <span className="font-semibold">{slotTarget.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setSlotTarget(null)}
              className="text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
        {renderAddForm({
          onAdd: () =>
            void addRelative(() =>
              slotTarget ? Promise.resolve(slotTarget.id) : ensureSelf(),
            ),
          canSibling,
          relationLabel: slotTarget
            ? `Their relation to ${slotTarget.name}`
            : 'Their relation to you',
          submitLabel: slotTarget ? '🌿 Add this parent' : '🌿 Add to my tree',
        })}
      </>,
    );
}
