import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import { IdentityChip } from './IdentityChip.tsx';
import {
  CATEGORY_COLOR,
  ORG_EDGE_COLOR,
  extractOrgs,
  extractPeers,
  ringPosition,
} from './peopleTreeLayout.ts';

// First-version mycelium-tree visualization (operator's 2026-05-27
// vision, ideas.md entry). The operator sits at the canvas center as
// a friendly IdentityChip bubble; their handshake-known peers ring
// the center on an inner orbit; the orgs they are a member of ring
// further out on a second orbit. Edges from operator to each peer
// are color-coded by relationship category (family / friend /
// coworker / acquaintance / other — same five-bucket vocabulary the
// handshake relationship leaf already defines); edges to orgs are
// drawn in a distinct violet with a dashed stroke so person-ties and
// org-ties read as visually distinct kinds of connection.
//
// Layout is deterministic: a peer's angular position on the ring is a
// stable FNV-1a hash of their pubkey, so the same peer always lands
// in the same spot across reloads and across devices for the same
// wallet. No force layout, no animation, no collapse interaction —
// that lives in later cuts. This first version is the smallest useful
// thing: see your people in one frame, with their actual relationship
// categories named in the visual itself.
//
// Implementation: a positioned div container with two layers — an
// absolute-positioned SVG layer behind for the edges (clean line
// rendering, pointer-events-none so it does not eat clicks) and
// absolute-positioned HTML divs in front for the IdentityChip nodes
// (so the avatars stay crisp and the chip primitive is reused
// verbatim instead of being re-implemented inside SVG).

interface Props {
  holdings: readonly Attestation[];
  myIdentity: string;
  /** The operator's own display name from their identity attestation. */
  myDisplayName?: string;
  /** Lookup map for resolving peer pubkeys to names — same map
   *  HomeScreen builds via peerNamesByPubkey. Passed through to each
   *  IdentityChip so peers whose handshake leaf has no name (rare but
   *  possible for older handshakes) still resolve to a name when the
   *  operator has another attestation that names them. */
  namesByPubkey?: ReadonlyMap<string, string>;
}

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 420;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;
const PEER_RING_RADIUS = 110;
const ORG_RING_RADIUS = 165;
const NODE_WIDTH = 100;
const NODE_HEIGHT = 36;

export function PeopleTree({
  holdings,
  myIdentity,
  myDisplayName,
  namesByPubkey,
}: Props) {
  const peers = useMemo(
    () => extractPeers(holdings, myIdentity),
    [holdings, myIdentity],
  );
  const orgs = useMemo(
    () => extractOrgs(holdings, myIdentity),
    [holdings, myIdentity],
  );

  if (peers.length === 0 && orgs.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white px-5 py-8 text-center text-sm text-muted">
        <p className="font-medium text-ink">Your mycelium tree is empty.</p>
        <p className="mt-2">
          Make a handshake with someone, or join an organization, and they
          will start appearing here as branches around you.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div
        className="relative mx-auto rounded-2xl border border-ink/10 bg-white overflow-hidden"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        <svg
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="absolute inset-0 pointer-events-none"
        >
          {peers.map((p) => {
            const pos = ringPosition(
              CENTER_X,
              CENTER_Y,
              PEER_RING_RADIUS,
              p.angle,
            );
            return (
              <line
                key={`edge-peer-${p.pubkey}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={pos.x}
                y2={pos.y}
                stroke={CATEGORY_COLOR[p.category]}
                strokeWidth={2}
                strokeOpacity={0.55}
              />
            );
          })}
          {orgs.map((o) => {
            const pos = ringPosition(
              CENTER_X,
              CENTER_Y,
              ORG_RING_RADIUS,
              o.angle,
            );
            return (
              <line
                key={`edge-org-${o.pubkey}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={pos.x}
                y2={pos.y}
                stroke={ORG_EDGE_COLOR}
                strokeWidth={2}
                strokeOpacity={0.45}
                strokeDasharray="5 3"
              />
            );
          })}
        </svg>

        <div
          className="absolute rounded-lg bg-paper px-2 py-1 shadow-md ring-2 ring-accent z-10"
          style={{
            left: CENTER_X - NODE_WIDTH / 2,
            top: CENTER_Y - NODE_HEIGHT / 2,
            width: NODE_WIDTH,
          }}
        >
          <IdentityChip
            pubkey={myIdentity}
            name={myDisplayName || 'You'}
            size="sm"
            hideShortKey
          />
        </div>

        {peers.map((p) => {
          const pos = ringPosition(
            CENTER_X,
            CENTER_Y,
            PEER_RING_RADIUS,
            p.angle,
          );
          return (
            <div
              key={`node-peer-${p.pubkey}`}
              className="absolute rounded-lg bg-paper px-2 py-1 shadow-sm border z-10"
              style={{
                left: pos.x - NODE_WIDTH / 2,
                top: pos.y - NODE_HEIGHT / 2,
                width: NODE_WIDTH,
                borderColor: CATEGORY_COLOR[p.category],
              }}
            >
              <IdentityChip
                pubkey={p.pubkey}
                name={p.name}
                namesByPubkey={namesByPubkey}
                size="sm"
                hideShortKey
              />
            </div>
          );
        })}

        {orgs.map((o) => {
          const pos = ringPosition(
            CENTER_X,
            CENTER_Y,
            ORG_RING_RADIUS,
            o.angle,
          );
          return (
            <div
              key={`node-org-${o.pubkey}`}
              className="absolute rounded-lg bg-violet-50 px-2 py-1 shadow-sm border border-violet-300 z-10"
              style={{
                left: pos.x - NODE_WIDTH / 2,
                top: pos.y - NODE_HEIGHT / 2,
                width: NODE_WIDTH,
              }}
            >
              <IdentityChip
                pubkey={o.pubkey}
                name={o.name}
                namesByPubkey={namesByPubkey}
                size="sm"
                hideShortKey
              />
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: CATEGORY_COLOR.family }}
          />
          Family
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: CATEGORY_COLOR.friend }}
          />
          Friend
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: CATEGORY_COLOR.coworker }}
          />
          Coworker
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: CATEGORY_COLOR.acquaintance }}
          />
          Acquaintance
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-4"
            style={{
              borderTop: `2px dashed ${ORG_EDGE_COLOR}`,
            }}
          />
          Organization
        </span>
      </div>
    </div>
  );
}
