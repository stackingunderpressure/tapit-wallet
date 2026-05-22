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

// The entry is committed the moment it is signed. The verification
// badge is async metadata that arrives later — sometimes within an
// hour, sometimes after days of retry. UI never frames the entry as
// "waiting" or "pending" or "failed" — only the verification badge
// varies, and it never alarms.

function verificationBadge(
  state: string | undefined,
  btcHeight?: number,
): { text: string; tone: 'verified' | 'verifying' } {
  if (state === 'confirmed') {
    return {
      text: btcHeight ? `Time-verified · block ${btcHeight}` : 'Time-verified',
      tone: 'verified',
    };
  }
  return { text: 'Time-verifying…', tone: 'verifying' };
}

function toneClass(tone: 'verified' | 'verifying'): string {
  if (tone === 'verified') return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  return 'bg-ink/5 text-muted border-ink/10';
}

export function JournalCard({ attestation }: Props) {
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

  // The verified state lives durably on the attestation itself — the
  // WalletProvider attaches the confirmed anchor and it rides the
  // encrypted wallet backup. Read that first; the live queue is only
  // a fallback for entries not yet confirmed. This keeps a verified
  // badge sticky across reloads, re-unlocks, and device restores.
  const verifiedAnchor =
    attestation.anchor?.status === 'confirmed'
      ? attestation.anchor
      : row?.state === 'confirmed'
        ? row.anchor
        : null;
  const badge = verifiedAnchor
    ? verificationBadge('confirmed', verifiedAnchor.btcHeight)
    : verificationBadge(row?.state);

  return (
    <Link
      to={`/entry/${digestHex}`}
      className="block rounded-2xl bg-white border border-ink/10 p-5 shadow-sm hover:border-ink/20"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">
          {category}
        </span>
        <span className="text-xs text-muted">
          {new Date(writtenAt).toLocaleDateString()}
        </span>
      </div>
      {text && (
        <p className="mt-2 text-sm whitespace-pre-wrap line-clamp-4">{text}</p>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {attachmentIcon && (
          <span className="text-xs rounded-full px-2 py-0.5 border border-ink/10 text-muted">
            {attachmentIcon} attachment
          </span>
        )}
        <span
          className={`text-xs rounded-full px-2 py-0.5 border ${toneClass(badge.tone)}`}
        >
          {badge.text}
        </span>
      </div>
    </Link>
  );
}
