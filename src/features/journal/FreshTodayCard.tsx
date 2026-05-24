import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { categoryAccent, deriveTitle } from './categoryAccents.ts';

interface Props {
  attestation: Attestation;
}

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

// Fresh-styled card for a single journal entry. Renders inside
// FreshTodayList. Each card carries a synthetic title derived
// from the first line of the entry's text, a left-edge accent
// stripe coloured per-category (Diary lime, Family lavender,
// Medical cyan, Marriage amber, Witness coral, custom labels
// hash to a stable palette hue), and the existing anchor / age
// signal. Anchored entries get an amber edge-glow; un-anchored
// entries pulse the mycelium cyan in their first hour.
//
// Rewritten in the 2026-05-24 polish session per operator
// feedback: titles, full visibility, per-category colour pop.
export function FreshTodayCard({ attestation }: Props) {
  const { ownerId } = useWallet();
  const worker = useAnchorWorker();
  const digestHex = useMemo(() => envelopeId(attestation), [attestation]);
  const row = useAnchorStatus(ownerId, digestHex, worker);

  const text = readString(attestation.claim, 'text') ?? '';
  const category = readString(attestation.claim, 'category') ?? 'Diary';
  const writtenAt = readString(attestation.claim, 'written_at') ?? attestation.issuedAt;
  const subject = attestation.subject;
  const walletKey = useWallet().wallet.identity;
  const subjectLabel =
    subject === walletKey ? 'About me' : subject ? `About ${subject}` : null;
  const attachmentMime = readString(attestation.claim, 'attachment_mime');
  const attachmentName = readString(attestation.claim, 'attachment_name');
  const attachmentIcon = attachmentMime
    ? attachmentMime.startsWith('image/')
      ? '📷'
      : '📄'
    : null;

  const accent = categoryAccent(category);
  const derived = deriveTitle(text);
  const title = derived.length > 0
    ? derived
    : attachmentName
      ? attachmentName
      : `${category} entry`;
  // Show the body only when it carries something beyond the
  // derived title (avoids "Lacey loves you" repeating "Lacey
  // loves you" verbatim under itself).
  const body = derived.length > 0 && text.trim() !== derived ? text : '';

  const verifiedAnchor =
    attestation.anchor?.status === 'confirmed'
      ? attestation.anchor
      : row?.state === 'confirmed'
        ? row.anchor
        : null;

  const ageMs = Date.now() - new Date(writtenAt).getTime();
  const stillTimestamping = !verifiedAnchor && ageMs < 60 * 60 * 1000;

  return (
    <Link
      to={`/entry/${digestHex}`}
      className="block rounded-3xl backdrop-blur-xl border border-fresh-surface-edge transition active:animate-fresh-press motion-reduce:active:animate-none overflow-hidden"
      style={{
        background: `linear-gradient(90deg, ${accent.tint} 0%, var(--fresh-surface-glass, rgba(255,255,255,0.06)) 65%)`,
        borderLeft: `4px solid ${accent.hex}`,
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[0.65rem] uppercase tracking-[0.22em] font-medium"
            style={{ color: accent.hex }}
          >
            {category}
          </span>
          <span className="text-xs text-fresh-text-tertiary">
            {new Date(writtenAt).toLocaleDateString()}
          </span>
        </div>
        <h3 className="mt-3 font-fresh-display text-lg leading-snug tracking-[-0.01em] text-fresh-text-primary">
          {title}
        </h3>
        {subjectLabel && (
          <p className="mt-1 text-xs text-fresh-text-tertiary">
            {subjectLabel}
          </p>
        )}
        {body && (
          <p className="mt-3 text-sm text-fresh-text-secondary whitespace-pre-wrap line-clamp-3 font-fresh-body">
            {body}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {attachmentIcon && (
            <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-surface-edge text-fresh-text-secondary bg-fresh-surface-glass">
              {attachmentIcon} {attachmentName ?? 'attachment'}
            </span>
          )}
          {verifiedAnchor ? (
            <span
              className="text-xs rounded-full px-2.5 py-1 border bg-fresh-anchor-glow/[0.08]"
              style={{ color: 'var(--fresh-anchor-glow, #f59e0b)', borderColor: 'rgba(245, 158, 11, 0.5)' }}
            >
              {verifiedAnchor.btcHeight
                ? `Block ${verifiedAnchor.btcHeight} · verified`
                : 'Time-verified'}
            </span>
          ) : (
            <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-mycelium-glow/40 text-fresh-mycelium-glow bg-fresh-mycelium-glow/[0.08]">
              {stillTimestamping ? 'Still timestamping…' : 'Time-verifying…'}
            </span>
          )}
          {attestation.signatures.length > 1 && (
            <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-accent-secondary/40 text-fresh-accent-secondary bg-fresh-accent-secondary/[0.08]">
              {attestation.signatures.length} signers
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
