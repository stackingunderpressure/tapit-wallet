import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';

interface Props {
  attestation: Attestation;
}

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

// Fresh-styled card for a single journal entry. Renders inside
// FreshTodayCarousel. Anchored entries get an amber edge-glow.
// Un-anchored entries pulse the mycelium cyan in their first hour
// as "still timestamping" — soft confirmation that the math is
// running without alarming the operator.
//
// Same data shape as JournalCard; different visual register.
// Shipped as part of Cut 3 of the 2026-05-24 Fresh roadmap.
export function FreshTodayCard({ attestation }: Props) {
  const { ownerId } = useWallet();
  const worker = useAnchorWorker();
  const digestHex = useMemo(() => envelopeId(attestation), [attestation]);
  const row = useAnchorStatus(ownerId, digestHex, worker);

  const text = readString(attestation.claim, 'text');
  const category = readString(attestation.claim, 'category') ?? 'Diary';
  const writtenAt = readString(attestation.claim, 'written_at') ?? attestation.issuedAt;
  const attachmentMime = readString(attestation.claim, 'attachment_mime');
  const attachmentIcon = attachmentMime
    ? attachmentMime.startsWith('image/')
      ? '📷'
      : '📄'
    : null;

  const verifiedAnchor =
    attestation.anchor?.status === 'confirmed'
      ? attestation.anchor
      : row?.state === 'confirmed'
        ? row.anchor
        : null;

  // "Still timestamping" pulse fades after the first hour. After
  // that the entry is just un-anchored, not actively waiting.
  const ageMs = Date.now() - new Date(writtenAt).getTime();
  const stillTimestamping = !verifiedAnchor && ageMs < 60 * 60 * 1000;

  const edgeGlowClass = verifiedAnchor
    ? 'shadow-[0_0_30px_-8px_var(--fresh-anchor-glow)] border-fresh-anchor-glow/40'
    : stillTimestamping
      ? 'shadow-[0_0_24px_-10px_var(--fresh-mycelium-glow)] border-fresh-mycelium-glow/30 animate-pulse motion-reduce:animate-none'
      : 'border-fresh-surface-edge';

  return (
    <Link
      to={`/entry/${digestHex}`}
      className={`block rounded-3xl bg-fresh-surface-glass backdrop-blur-xl border p-6 transition active:animate-fresh-press motion-reduce:active:animate-none ${edgeGlowClass}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          {category}
        </span>
        <span className="text-xs text-fresh-text-tertiary">
          {new Date(writtenAt).toLocaleDateString()}
        </span>
      </div>
      {text && (
        <p className="mt-4 text-base text-fresh-text-primary whitespace-pre-wrap line-clamp-6 font-fresh-body">
          {text}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {attachmentIcon && (
          <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-surface-edge text-fresh-text-secondary bg-fresh-surface-glass">
            {attachmentIcon} attachment
          </span>
        )}
        {verifiedAnchor ? (
          <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-anchor-glow/50 text-fresh-anchor-glow bg-fresh-anchor-glow/[0.08]">
            {verifiedAnchor.btcHeight
              ? `Block ${verifiedAnchor.btcHeight} · verified`
              : 'Time-verified'}
          </span>
        ) : (
          <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-mycelium-glow/40 text-fresh-mycelium-glow bg-fresh-mycelium-glow/[0.08]">
            {stillTimestamping ? 'Still timestamping…' : 'Time-verifying…'}
          </span>
        )}
      </div>
    </Link>
  );
}
