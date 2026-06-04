import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import { IdentityChip } from './IdentityChip.tsx';
import {
  CATEGORY_COLOR,
  FAMILY_UNIT_EDGE_COLOR,
  ORG_EDGE_COLOR,
  extractFamilies,
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
  /** Operator's key-history (every pubkey the operator has ever used,
   *  including the genesis identity). Threaded through to the family
   *  layout so the operator's signature on family-unit envelopes is
   *  detected across rotation — without the bridge, a rotated wallet
   *  signs with its active key, which differs from the genesis pubkey
   *  stored in members[], and the family node would under-count the
   *  operator's own ratification. */
  myKeyHistory?: readonly string[];
  /** Lookup map for resolving peer pubkeys to names — same map
   *  HomeScreen builds via peerNamesByPubkey. Passed through to each
   *  IdentityChip so peers whose handshake leaf has no name (rare but
   *  possible for older handshakes) still resolve to a name when the
   *  operator has another attestation that names them. */
  namesByPubkey?: ReadonlyMap<string, string>;
}

const CANVAS_WIDTH = 340;
const CANVAS_HEIGHT = 460;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;
const PEER_RING_RADIUS = 100;
const FAMILY_RING_RADIUS = 145;
const ORG_RING_RADIUS = 190;
const NODE_WIDTH = 100;
const NODE_HEIGHT = 36;
const FAMILY_NODE_WIDTH = 110;
const FAMILY_NODE_HEIGHT = 44;

export function PeopleTree({
  holdings,
  myIdentity,
  myDisplayName,
  myKeyHistory,
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
  // keyAliases bridges the operator's genesis identity to every key
  // they have ever used, so the family node's signed-count reflects
  // their ratification regardless of whether they have rotated. Built
  // once per render from the myKeyHistory prop the caller threads
  // through from useWallet.
  const families = useMemo(() => {
    const aliases = myKeyHistory
      ? new Map<string, readonly string[]>([
          [myIdentity.toLowerCase(), myKeyHistory.map((k) => k.toLowerCase())],
        ])
      : undefined;
    return extractFamilies(holdings, myIdentity, aliases);
  }, [holdings, myIdentity, myKeyHistory]);

  if (peers.length === 0 && orgs.length === 0 && families.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white px-5 py-8 text-center text-sm text-muted">
        <p className="font-medium text-ink">Your mycelium tree is empty.</p>
        <p className="mt-2">
          Make a handshake with someone, join an organization, or start a
          family, and they will start appearing here as branches around
          you.
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
                // In-person ties read bold + solid; remote (online-only)
                // ties read thinner, fainter, and dashed — the same
                // "lighter" visual register as the dashed org edges. The
                // verified-in-person edge is the one you'd trust more, so
                // it carries more visual weight.
                strokeWidth={p.verification === 'in-person' ? 3 : 1.5}
                strokeOpacity={p.verification === 'in-person' ? 0.85 : 0.4}
                strokeDasharray={p.verification === 'in-person' ? undefined : '4 4'}
              />
            );
          })}
          {families.map((f) => {
            const pos = ringPosition(
              CENTER_X,
              CENTER_Y,
              FAMILY_RING_RADIUS,
              f.angle,
            );
            return (
              <line
                key={`edge-family-${f.envelopeId}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={pos.x}
                y2={pos.y}
                stroke={FAMILY_UNIT_EDGE_COLOR}
                strokeWidth={3}
                strokeOpacity={0.7}
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

        {families.map((f) => {
          const pos = ringPosition(
            CENTER_X,
            CENTER_Y,
            FAMILY_RING_RADIUS,
            f.angle,
          );
          const allSigned =
            f.memberCount > 0 && f.signedCount === f.memberCount;
          return (
            <div
              key={`node-family-${f.envelopeId}`}
              className="absolute rounded-lg bg-rose-50 border border-rose-300 px-2 py-1 shadow-sm z-10"
              style={{
                left: pos.x - FAMILY_NODE_WIDTH / 2,
                top: pos.y - FAMILY_NODE_HEIGHT / 2,
                width: FAMILY_NODE_WIDTH,
              }}
            >
              <div className="text-[11px] font-semibold leading-tight truncate text-rose-900">
                {f.familyName || 'Family'}
              </div>
              <div
                className={`mt-0.5 text-[10px] leading-tight ${
                  allSigned ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {f.signedCount} of {f.memberCount} signed
              </div>
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
            className="inline-block h-[3px] w-4"
            style={{ background: FAMILY_UNIT_EDGE_COLOR }}
          />
          Family unit
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

      {/* A1: line STYLE encodes how a tie was verified — a bold solid
          line is someone you met in person (the strongest tie), a thin
          dashed line is an online-only connection. Color still encodes
          relationship; thickness/dash encodes trust strength. */}
      <div className="mx-auto mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[3px] w-5 rounded-full bg-current opacity-80" />
          Met in person
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-5"
            style={{ borderTop: '1.5px dashed currentColor', opacity: 0.6 }}
          />
          Online only
        </span>
      </div>
    </div>
  );
}
