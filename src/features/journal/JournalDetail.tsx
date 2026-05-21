import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sha256 } from '@noble/hashes/sha256';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { mediaStore } from '../storage/mediaStore.ts';
import { downloadJournalEntry } from './downloadEntry.ts';
import { bytesToHex } from '../anchoring/hex.ts';

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

export function JournalDetail() {
  const { digest } = useParams<{ digest: string }>();
  const { holdings, ownerId, passphrase } = useWallet();
  const worker = useAnchorWorker();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const entry = useMemo<Attestation | undefined>(() => {
    if (!digest) return undefined;
    for (const a of holdings) {
      const h = bytesToHex(sha256(JSON.stringify(a)));
      if (h === digest) return a;
    }
    return undefined;
  }, [holdings, digest]);

  const photoHash = entry ? readString(entry.claim, 'photo_sha256') : undefined;

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    if (photoHash) {
      mediaStore.get(ownerId, passphrase, photoHash).then((m) => {
        if (!alive || !m) return;
        const blob = new Blob([m.bytes as BlobPart], { type: m.mime });
        const url = URL.createObjectURL(blob);
        revoked = url;
        setPhotoUrl(url);
      });
    }
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [photoHash, ownerId, passphrase]);

  const row = useAnchorStatus(ownerId, digest ?? null, worker);

  if (!entry) {
    return (
      <div className="min-h-screen p-5 max-w-md mx-auto">
        <Link to="/" className="text-sm text-muted">
          ← Back
        </Link>
        <p className="mt-6 text-sm text-muted">Entry not found.</p>
      </div>
    );
  }

  const text = readString(entry.claim, 'text');
  const category = readString(entry.claim, 'category') ?? 'Diary';
  const subject = entry.subject;
  const writtenAt = readString(entry.claim, 'written_at') ?? entry.issuedAt;

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">{category}</h1>
        <span className="w-12" aria-hidden />
      </header>

      <article className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="text-xs text-muted">
          {new Date(writtenAt).toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted">About: {subject}</div>
        {text && <p className="mt-3 whitespace-pre-wrap">{text}</p>}
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="mt-4 w-full rounded-lg border border-ink/10"
          />
        )}
        <div className="mt-4 text-xs text-muted">
          Signers:{' '}
          {entry.signatures.length === 1
            ? '1 signer (you)'
            : `${entry.signatures.length} signers`}
        </div>
        <div className="mt-1 text-xs">
          {row?.state === 'confirmed' && row.anchor?.btcHeight
            ? `Anchored at Bitcoin block ${row.anchor.btcHeight}`
            : row?.state === 'pending'
              ? 'Anchored — waiting on Bitcoin confirmation'
              : row?.state === 'failed'
                ? 'Anchor retrying'
                : 'Anchor queued'}
        </div>
      </article>

      <button
        type="button"
        onClick={() => downloadJournalEntry(ownerId, passphrase, entry)}
        className="mt-4 w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
      >
        Save to my files
      </button>
    </div>
  );
}
