import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';
import { deriveVerificationStatus } from '../anchoring/verificationStatus.ts';
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
// FreshTodayList.
//
// Visual treatment (revised 2026-05-24 polish session after the
// first rework washed out text contrast under the light :root
// Fresh defaults): solid raised surface for the body, NO
// gradient tint — text reads cleanly under both light and dark
// Fresh palettes. Colour signal lives in (a) a 4px left-edge
// accent stripe and (b) a small chip with a coloured dot next
// to the category name. Title prefers an explicit `title` leaf
// on the attestation; falls back to the first sentence of the
// body text; falls back to the attachment name; falls back to
// "{category} entry". Body text only renders when it carries
// something beyond what is already shown in the title.
export function FreshTodayCard({ attestation }: Props) {
  const { ownerId, wallet } = useWallet();
  const worker = useAnchorWorker();
  const digestHex = useMemo(() => envelopeId(attestation), [attestation]);
  const row = useAnchorStatus(ownerId, digestHex, worker);

  const explicitTitle = readString(attestation.claim, 'title') ?? '';
  const text = readString(attestation.claim, 'text') ?? '';
  const category = readString(attestation.claim, 'category') ?? 'Diary';
  const writtenAt = readString(attestation.claim, 'written_at') ?? attestation.issuedAt;
  const subject = attestation.subject;
  const subjectLabel =
    subject === wallet.identity ? null : subject ? `About ${subject}` : null;
  const attachmentMime = readString(attestation.claim, 'attachment_mime');
  const attachmentName = readString(attestation.claim, 'attachment_name');
  const attachmentIcon = attachmentMime
    ? attachmentMime.startsWith('image/')
      ? '📷'
      : '📄'
    : null;

  const accent = categoryAccent(category);
  const derived = deriveTitle(text);
  const title =
    explicitTitle ||
    derived ||
    attachmentName ||
    `${category} entry`;
  // Show the body when it carries something the title does NOT
  // already say — avoids a short entry repeating itself.
  const body =
    text.trim().length > 0 && text.trim() !== title ? text : '';

  const verification = deriveVerificationStatus(attestation, row);
  const verifiedAnchor =
    verification.kind === 'verified' ? verification.anchor : null;

  const ageMs = Date.now() - new Date(writtenAt).getTime();
  const stillTimestamping = !verifiedAnchor && ageMs < 60 * 60 * 1000;
  const calendarSlow = verification.kind === 'stalled';

  return (
    <Link
      to={`/entry/${digestHex}`}
      className="block rounded-3xl bg-fresh-surface-raised border border-fresh-surface-edge transition active:animate-fresh-press motion-reduce:active:animate-none overflow-hidden"
      style={{ borderLeft: `4px solid ${accent.hex}` }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] font-medium border border-fresh-surface-edge bg-fresh-surface-glass text-fresh-text-secondary">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accent.hex }}
            />
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
            <span className="text-xs rounded-full px-2.5 py-1 border border-fresh-anchor-glow/50 text-fresh-anchor-glow bg-fresh-anchor-glow/[0.08]">
              {verifiedAnchor.btcHeight
                ? `Block ${verifiedAnchor.btcHeight} · verified`
                : 'Time-verified'}
            </span>
          ) : calendarSlow ? (
            <span className="text-xs rounded-full px-2.5 py-1 border border-amber-300/60 text-amber-200 bg-amber-400/[0.10]">
              Time-verifying — calendar slow
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
