import { useMemo } from 'react';
import type { KinGraph, KinNode } from './kinGraph.ts';
import { layoutTree } from './treeLayout.ts';
import { genderKinLabel } from './gender.ts';
import { KinAvatar } from './KinAvatar.tsx';

// Family-tree — the connected node-link CANVAS.
//
// A dumb renderer over the pure treeLayout engine: nodes sit on their
// (row, col) grid, each row centered, with orthogonal connector lines drawn
// behind them (parent_of down the generations, spouse across a couple). You
// are ringed in the middle. The whole thing scrolls if the family is wider or
// taller than the viewport, so it reads as a branching tree on a phone.

const NODE_W = 92;
const NODE_H = 78;
const COL_GAP = 104;
const ROW_GAP = 116;
const PAD = 24;

interface Props {
  graph: KinGraph;
  selfId: string | null;
  onSelect: (node: KinNode, relationship: string) => void;
}

export function FamilyTreeCanvas({ graph, selfId, onSelect }: Props) {
  const { layout, positions, width, height } = useMemo(() => {
    const lay = layoutTree(graph, selfId);
    const innerW = Math.max(1, lay.maxRowSize) * COL_GAP;
    const pos = new Map<string, { cx: number; cy: number }>();
    for (const n of lay.nodes) {
      const rowLeft = PAD + (innerW - n.rowSize * COL_GAP) / 2;
      pos.set(n.id, {
        cx: rowLeft + n.col * COL_GAP + COL_GAP / 2,
        cy: PAD + n.row * ROW_GAP + ROW_GAP / 2,
      });
    }
    return {
      layout: lay,
      positions: pos,
      width: innerW + PAD * 2,
      height: lay.rowCount * ROW_GAP + PAD * 2,
    };
  }, [graph, selfId]);

  const edges = layout.edges;

  return (
    <div className="overflow-auto" style={{ maxHeight: '46vh' }}>
      <div className="relative mx-auto" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          aria-hidden
        >
          {edges.map((e, i) => {
            const a = positions.get(e.fromId);
            const b = positions.get(e.toId);
            if (!a || !b) return null;
            if (e.relation === 'spouse') {
              return (
                <line
                  key={`s${i}`}
                  x1={a.cx}
                  y1={a.cy}
                  x2={b.cx}
                  y2={b.cy}
                  stroke="rgba(120,90,40,0.45)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              );
            }
            // parent_of: orthogonal elbow from the parent's bottom to the
            // child's top, bending at the midpoint between the two rows.
            const pBottom = a.cy + NODE_H / 2 - 18;
            const cTop = b.cy - NODE_H / 2 + 18;
            const midY = (pBottom + cTop) / 2;
            return (
              <path
                key={`p${i}`}
                d={`M ${a.cx} ${pBottom} L ${a.cx} ${midY} L ${b.cx} ${midY} L ${b.cx} ${cTop}`}
                fill="none"
                stroke="rgba(40,40,40,0.18)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {layout.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const label = genderKinLabel(n.relationship, n.node.sex);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.node, n.relationship)}
              className={`absolute flex flex-col items-center rounded-xl border bg-white px-1.5 py-1.5 text-center transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.03] ${
                n.isSelf ? 'border-accent ring-2 ring-accent/40' : 'border-ink/15'
              }`}
              style={{
                left: p.cx - NODE_W / 2,
                top: p.cy - NODE_H / 2,
                width: NODE_W,
              }}
            >
              <KinAvatar node={n.node} size={34} />
              <span className="mt-1 w-full truncate text-[12px] font-medium leading-tight">
                {n.node.displayName}
              </span>
              <span className="w-full truncate text-[10px] text-muted">
                {n.isSelf ? 'you' : label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
