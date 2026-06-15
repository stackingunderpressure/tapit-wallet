import { useMemo, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { buildKinGraph, type KinGraph, type KinNode } from './kinGraph.ts';
import { createPersonNode, createKinEdge } from './createFamilyTree.ts';
import { groupByGeneration } from './treeGenerations.ts';

// Family-tree CUT 1 — the edit-your-adjacent-layer editor.
//
// You only ever add the people closest to you — your parents, your kids,
// your spouse, your siblings. The deep tree self-assembles later when you
// handshake relatives (the merge cut). Adding a "parent"/"child"/"spouse"
// is one primitive edge from your own node; a "sibling" attaches under a
// shared parent (so you need a parent on the tree first). Each add signs
// + holds + anchors a witnessed person-node plus the edge, then saves.

type Relation = 'parent' | 'child' | 'spouse' | 'sibling';

interface Props {
  onClose: () => void;
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
  const { wallet, ownerId, holdings, save } = useWallet();
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0) {
      setError('Give this person a name.');
      return;
    }
    if (relation === 'sibling' && !canSibling) {
      setError('Add one of your parents first, so siblings can share them.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await ensureSelf();
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
        await createKinEdge(wallet, ownerId, worker, 'parent_of', relId, me);
        newParents.push([relId, me]);
      } else if (relation === 'child') {
        await createKinEdge(wallet, ownerId, worker, 'parent_of', me, relId);
        newParents.push([me, relId]);
      } else if (relation === 'spouse') {
        await createKinEdge(wallet, ownerId, worker, 'spouse', me, relId);
        newSpouses.push([me, relId]);
      } else {
        // sibling — share my first parent
        const parentId = myParentId as string;
        await createKinEdge(wallet, ownerId, worker, 'parent_of', parentId, relId);
        newParents.push([parentId, relId]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your family tree</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Done
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          Add the people closest to you — parents, kids, your spouse, your
          siblings. The rest fills in when you connect with family. People with
          no wallet of their own are simply remembered by you.
        </p>

        <div className="mt-4 rounded-xl border border-ink/10 bg-white p-3">
          {!hasPeople ? (
            <p className="text-sm text-muted">
              No one on your tree yet. Add your first relative below.
            </p>
          ) : (
            <div className="space-y-4">
              {generations.map((group) => (
                <div key={String(group.generation)}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {group.title}
                  </div>
                  <ul className="mt-1 space-y-1.5">
                    {group.members.map((m) => (
                      <li
                        key={m.id}
                        className={`flex items-center justify-between text-sm ${
                          m.relationship === 'you' ? 'font-semibold' : ''
                        }`}
                      >
                        <span>{m.node.displayName}</span>
                        <span className="text-xs text-muted">
                          {m.relationship}
                          {m.node.born || m.node.died ? (
                            <span className="ml-1">
                              ({m.node.born ?? '?'}
                              {m.node.died ? `–${m.node.died}` : ''})
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
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
            <label className="text-sm font-medium" htmlFor="ft-relation">
              Their relation to you
            </label>
            <select
              id="ft-relation"
              value={relation}
              onChange={(e) => setRelation(e.target.value as Relation)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="spouse">Spouse</option>
              <option value="sibling">Sibling</option>
            </select>
            {relation === 'sibling' && !canSibling && (
              <p className="mt-1 text-xs text-amber-700">
                Add one of your parents first — siblings are linked by the
                parent you share.
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
            className="w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
          >
            {busy ? 'Adding to your tree…' : 'Add to my tree'}
          </button>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
