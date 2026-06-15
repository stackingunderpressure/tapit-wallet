import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { buildKinGraph, type KinGraph, type KinNode } from './kinGraph.ts';
import { createPersonNode, createKinEdge } from './createFamilyTree.ts';
import { groupByGeneration } from './treeGenerations.ts';
import { storiesAbout } from './storiesAbout.ts';
import { explainRelationship } from './kinEducation.ts';
import { identiconSeed } from '../connections/identicon.ts';
import {
  readEventDate,
  formatEventDate,
  normalizeEventDateInput,
} from '../journal/momentDate.ts';
import { createJournalEntry } from '../journal/createJournalEntry.ts';
import type { Attestation, FieldBranch } from 'tapit-attest';

function claimString(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

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

interface Props {
  onClose: () => void;
}

// A stable colored avatar for a person — identicon hues from their key
// (or node id, for keyless ancestors) + initials from their name.
function KinAvatar({ node, size = 36 }: { node: KinNode; size?: number }) {
  const seed = identiconSeed(node.keyedPubkey ?? node.id, node.displayName);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${seed.hueA} 55% 52%), hsl(${seed.hueB} 55% 42%))`,
      }}
    >
      {seed.initials}
    </span>
  );
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

export function FamilyTreeEditor({ onClose }: Props) {
  const { wallet, ownerId, passphrase, prefs, holdings, save } = useWallet();
  const worker = useAnchorWorker();

  const [extra, setExtra] = useState<Extra>({
    nodes: [],
    parents: [],
    spouses: [],
  });
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<Relation>('parent');
  const [born, setBorn] = useState('');
  const [died, setDied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setRelation('parent');
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
  const graph = useMemo<KinGraph>(() => {
    const g = buildKinGraph(holdings);
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
  }, [holdings, extra]);

  const selfId = useMemo<string | null>(() => {
    for (const node of graph.nodes.values()) {
      if (node.keyedPubkey === wallet.identity.toLowerCase()) return node.id;
    }
    return null;
  }, [graph, wallet.identity]);

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
      });
      const relNode: KinNode = {
        id: relId,
        displayName: name.trim(),
        born: born.trim() || undefined,
        died: died.trim() || undefined,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to your tree.');
    } finally {
      setBusy(false);
    }
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

  if (selected) {
    const person = selected.node;
    const stories = storiesAbout([...addedStories, ...holdings], person);
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-muted hover:text-ink"
            >
              ← Tree
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted hover:text-ink"
            >
              Done
            </button>
          </div>

          <div className="mt-3 flex flex-col items-center text-center animate-fresh-rise motion-reduce:animate-none">
            <KinAvatar node={person} size={64} />
            <h2 className="mt-2 text-xl font-semibold">{person.displayName}</h2>
            <span className="mt-1 rounded-full bg-accent/10 px-3 py-0.5 text-sm font-medium text-accent">
              {selected.relationship}
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
                  · remembered by you
                </span>
              )}
            </div>
            {selected.relationship !== 'you' && (
              <p className="mt-2 max-w-xs rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-muted">
                <span aria-hidden>📖 </span>
                {explainRelationship(selected.relationship)}
              </p>
            )}
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Moments about {person.displayName}
            </div>
            {stories.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No moments yet. Add the first one below — a story, something
                they did, how they made you feel.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {stories.map((s) => {
                  const ev = readEventDate(s);
                  const when = ev
                    ? formatEventDate(ev)
                    : new Date(
                        claimString(s, 'written_at') || s.issuedAt,
                      ).toLocaleDateString();
                  const title = claimString(s, 'title');
                  const text = claimString(s, 'text');
                  return (
                    <li
                      key={s.subject + (claimString(s, 'written_at') || s.issuedAt)}
                      className="rounded-lg border border-ink/10 bg-white p-3"
                    >
                      <div className="text-xs font-medium text-ink">{when}</div>
                      {title && (
                        <div className="mt-0.5 text-sm font-semibold">
                          {title}
                        </div>
                      )}
                      {text && (
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm">
                          {text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3">
              <label
                className="text-xs font-medium"
                htmlFor="ft-moment-text"
              >
                Add a moment about {person.displayName}
              </label>
              <textarea
                id="ft-moment-text"
                rows={3}
                value={momentText}
                onChange={(e) => setMomentText(e.target.value)}
                placeholder="A story, something they did, how they made you feel…"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={momentDate}
                  onChange={(e) => setMomentDate(e.target.value)}
                  className="flex-1 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                  aria-label="When did this happen (optional)"
                />
                <button
                  type="button"
                  onClick={() => void addMoment(person)}
                  disabled={momentBusy}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-40"
                >
                  {momentBusy ? 'Signing…' : 'Sign moment'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Optional date — leave empty if it happened today; set a past
                date to record an older memory.
              </p>
              {momentError && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {momentError}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-ink/10 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Grow the tree from {person.displayName}
            </div>
            <p className="mt-1 text-xs text-muted">
              Add their parents, kids, spouse, or a sibling — this is how
              grandparents, great-uncles, and cousins come into your tree.
            </p>
            {renderAddForm({
              onAdd: () => void addRelative(() => Promise.resolve(person.id)),
              canSibling: (graph.parents.get(person.id)?.size ?? 0) > 0,
              relationLabel: `Their relation to ${person.displayName}`,
              submitLabel: '🌿 Add a relative',
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
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
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Done
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Add the people closest to you — the rest fills in as you connect with
          family. Tap anyone to learn how you're related and to keep their
          stories. People with no wallet are simply remembered by you.
        </p>

        <div className="mt-4 rounded-xl border border-ink/10 bg-white p-2.5">
          {!hasPeople ? (
            <p className="px-1 py-2 text-sm text-muted">
              No one here yet 🌱 — add your first relative below and watch your
              tree grow.
            </p>
          ) : (
            <div className="space-y-4">
              {generations.map((group) => (
                <div key={String(group.generation)}>
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {group.title}
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {group.members.map((m) => {
                      const isYou = m.relationship === 'you';
                      return (
                        <li
                          key={m.id}
                          className="animate-fresh-rise motion-reduce:animate-none"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelected({
                                node: m.node,
                                relationship: m.relationship,
                              })
                            }
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-ink/5 active:animate-fresh-press motion-reduce:active:animate-none ${
                              isYou ? 'bg-accent/5' : ''
                            }`}
                          >
                            <KinAvatar node={m.node} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`truncate text-sm ${isYou ? 'font-semibold' : 'font-medium'}`}
                                >
                                  {m.node.displayName}
                                </span>
                                <span className="shrink-0 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] text-muted">
                                  {m.relationship}
                                </span>
                              </span>
                              {!isYou && (
                                <span className="mt-0.5 block truncate text-[11px] text-muted">
                                  {explainRelationship(m.relationship)}
                                </span>
                              )}
                              {(m.node.born || m.node.died) && (
                                <span className="mt-0.5 block text-[11px] text-muted">
                                  {m.node.born ?? '?'}
                                  {m.node.died ? `–${m.node.died}` : ''}
                                </span>
                              )}
                            </span>
                            <span aria-hidden className="text-muted">
                              ›
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderAddForm({
          onAdd: () => void addRelative(() => ensureSelf()),
          canSibling,
          relationLabel: 'Their relation to you',
          submitLabel: '🌿 Add to my tree',
        })}
      </div>
    </div>
  );
}
