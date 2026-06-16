import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';
import { deriveVerificationStatus } from '../anchoring/verificationStatus.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { mediaStore } from '../storage/mediaStore.ts';
import { downloadJournalEntry } from './downloadEntry.ts';
import {
  verifyAttachmentIntegrity,
  type VerifyResult,
} from './verifyAttachmentIntegrity.ts';
import { CosignRequestModal } from '../cosigning/CosignRequestModal.tsx';
import { AbsorbCosignModal } from '../cosigning/AbsorbCosignModal.tsx';
import { CustodyHandoffModal } from '../cosigning/CustodyHandoffModal.tsx';
import { ShareProofModal } from '../disclosure/ShareProofModal.tsx';
import { StampedPhotoButton } from './StampedPhotoButton.tsx';
import { readEventDate, isBackfilled, formatEventDate } from './momentDate.ts';
import { readTags } from './journalTags.ts';
import { displayNameOf } from '../connections/createHandshake.ts';
import { noteTextFromEntry } from '../transport/nostrNote.ts';
import { sharedNotesStore } from '../storage/sharedNotesStore.ts';
import { summarizePublish } from '../transport/publishStatus.ts';

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

export function JournalDetail() {
  const { digest } = useParams<{ digest: string }>();
  const { wallet, holdings, ownerId, passphrase, relayStatus, publishPublicNote } =
    useWallet();
  const worker = useAnchorWorker();
  const [modal, setModal] = useState<
    'request' | 'absorb' | 'custody' | 'share-proof' | null
  >(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  // Share-to-Nostr (Tier 1 item 8). `shared` is non-null once this
  // entry has been published as a public note (loaded from
  // sharedNotesStore, keyed by the entry's envelopeId). shareStatus
  // carries the in-flight / result message.
  const [shared, setShared] = useState<boolean>(false);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const entry = useMemo<Attestation | undefined>(() => {
    if (!digest) return undefined;
    for (const a of holdings) {
      if (envelopeId(a) === digest) return a;
    }
    return undefined;
  }, [holdings, digest]);

  const attachmentHash = entry
    ? readString(entry.claim, 'attachment_sha256')
    : undefined;
  const attachmentMime = entry
    ? readString(entry.claim, 'attachment_mime')
    : undefined;
  const attachmentName = entry
    ? readString(entry.claim, 'attachment_name')
    : undefined;
  const attachmentIsImage = !!attachmentMime?.startsWith('image/');

  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    if (attachmentHash) {
      mediaStore.get(ownerId, passphrase, attachmentHash).then((m) => {
        if (!alive || !m) return;
        const blob = new Blob([m.bytes as BlobPart], { type: m.mime });
        const url = URL.createObjectURL(blob);
        revoked = url;
        setAttachmentUrl(url);
      });
    }
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [attachmentHash, ownerId, passphrase]);

  // Load whether this entry has already been shared to Nostr, keyed by
  // its envelopeId (== the route digest). Re-runs on owner / entry change.
  useEffect(() => {
    let alive = true;
    if (!ownerId || !digest) {
      setShared(false);
      return;
    }
    void sharedNotesStore.load(ownerId).then((map) => {
      if (alive) setShared(Boolean(map[digest]));
    });
    return () => {
      alive = false;
    };
  }, [ownerId, digest]);

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
  const entryTags = readTags(entry);
  const category = readString(entry.claim, 'category') ?? 'Diary';
  const subject = entry.subject;
  const writtenAt = readString(entry.claim, 'written_at') ?? entry.issuedAt;
  // The honestly-marked day the moment happened, when the author set one.
  const eventDate = readEventDate(entry);
  const backfilled = isBackfilled(entry);
  // about-me entries use wallet.identity as subject; about-other
  // entries use a typed label. Hand-off only makes sense for the
  // latter.
  const aboutSelf = subject === wallet.identity;

  // Prefer the anchor persisted on the attestation — the durable
  // verified state that rides the encrypted wallet backup. The live
  // queue row is only a fallback for entries not yet confirmed, so a
  // verified entry stays verified across reloads and restores. The
  // shared deriveVerificationStatus helper also surfaces the
  // `stalled` third state (2026-05-28 PLAN.md Tier 1 item 4) when
  // the OpenTimestamps calendar has been unreachable across enough
  // attempts that the operator should see the case honestly.
  const verification = deriveVerificationStatus(entry, row);
  const verifiedAnchor =
    verification.kind === 'verified' ? verification.anchor : null;

  const title = readString(entry.claim, 'title');
  const noteText = noteTextFromEntry({ title, text });

  // Operator display name for the "captured by" line on a stamped photo.
  // Falls back gracefully when the founding identity isn't in holdings.
  const identityAtt = holdings.find(
    (a) => a.kind === 'identity' && a.subject === wallet.identity,
  );
  const capturedBy = identityAtt ? displayNameOf(identityAtt) : 'A Tapit user';
  const anyRelayLive = (relayStatus ?? []).some((s) => s.open);

  async function handleShareToNostr() {
    if (!noteText || !digest) return;
    setSharing(true);
    setShareStatus(null);
    try {
      const { eventId, publish } = await publishPublicNote(noteText);
      const summary = summarizePublish(publish);
      if (summary.tone === 'fail') {
        setShareStatus(summary.detail);
      } else {
        if (ownerId) await sharedNotesStore.markShared(ownerId, digest, eventId);
        setShared(true);
        setShareStatus(
          summary.tone === 'ok'
            ? 'Posted to Nostr. It now shows on your profile in apps like Damus and Primal.'
            : 'Sending… it may take a moment to appear.',
        );
      }
    } catch (err) {
      setShareStatus(
        err instanceof Error ? err.message : 'Could not post to Nostr.',
      );
    } finally {
      setSharing(false);
    }
  }

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
        {eventDate ? (
          <>
            <div className="text-sm font-medium text-ink">
              Happened on {formatEventDate(eventDate)}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {backfilled ? 'Recorded ' : 'Logged '}
              {new Date(writtenAt).toLocaleString()}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted">
            {new Date(writtenAt).toLocaleString()}
          </div>
        )}
        <div className="mt-1 text-xs text-muted">About: {subject}</div>
        {entryTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entryTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-xs text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {text && <p className="mt-3 whitespace-pre-wrap">{text}</p>}
        {attachmentUrl && attachmentIsImage && (
          <>
            <img
              src={attachmentUrl}
              alt=""
              className="mt-4 w-full rounded-lg border border-ink/10"
            />
            <StampedPhotoButton
              attestation={entry}
              imageUrl={attachmentUrl}
              capturedBy={capturedBy}
              dateText={new Date(writtenAt).toLocaleDateString()}
              btcHeight={verifiedAnchor?.btcHeight}
            />
          </>
        )}
        {attachmentUrl && !attachmentIsImage && (
          <a
            href={attachmentUrl}
            download={attachmentName ?? 'attachment'}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-medium hover:bg-ink/5"
          >
            📄 Open {attachmentName ?? 'attachment'}
          </a>
        )}
        <div className="mt-4 text-xs text-muted">
          Signers:{' '}
          {entry.signatures.length === 1
            ? '1 signer (you)'
            : `${entry.signatures.length} signers`}
        </div>
        <div className="mt-1 text-xs text-muted">
          {verifiedAnchor
            ? verifiedAnchor.btcHeight
              ? `Time-verified · Bitcoin block ${verifiedAnchor.btcHeight}`
              : 'Time-verified'
            : verification.kind === 'stalled'
              ? `Time-verifying — the OpenTimestamps calendar has been unreachable across ${verification.attempts} attempts. The wallet keeps trying; your entry is signed and waiting.`
              : 'Time-verifying… (usually within an hour; can take days)'}
        </div>

        {attachmentHash && (
          <div className="mt-4 rounded-md border border-ink/10 bg-paper/50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              File integrity
            </div>
            <p className="mt-1 text-xs text-muted">
              The hash of this file was signed and time-anchored when you
              saved it. Re-hashing the bytes on the device now should match
              that signed-and-anchored value exactly — if it does, no one
              has tampered with the file since the day it was filed.
            </p>
            <div className="mt-2 text-[11px] font-mono text-muted break-all">
              SHA-256 · {attachmentHash}
            </div>
            <button
              type="button"
              onClick={async () => {
                setVerifyBusy(true);
                setVerifyResult(null);
                try {
                  const result = await verifyAttachmentIntegrity(
                    ownerId,
                    passphrase,
                    attachmentHash,
                  );
                  setVerifyResult(result);
                } finally {
                  setVerifyBusy(false);
                }
              }}
              disabled={verifyBusy}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
            >
              {verifyBusy ? 'Re-hashing the file…' : 'Verify file integrity'}
            </button>
            {verifyResult?.state === 'match' && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                ✓ Match. The bytes on this device today hash to exactly what
                the signed envelope committed to
                {verifiedAnchor?.btcHeight
                  ? ` at Bitcoin block ${verifiedAnchor.btcHeight}`
                  : ' at signing time'}
                . The file has not been tampered with since the day it was
                filed.
              </div>
            )}
            {verifyResult?.state === 'mismatch' && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                ✗ Mismatch. The bytes on this device hash to{' '}
                <span className="font-mono break-all">
                  {verifyResult.actual}
                </span>{' '}
                which does not match the signed value. Treat the local copy
                as untrusted and pull a fresh copy from a backup, a cohort
                peer, or your original source.
              </div>
            )}
            {verifyResult?.state === 'missing' && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                The encrypted file is not present in local storage or in the
                cloud mirror right now. The signed envelope still proves
                what the file's hash was on the day you filed it — re-supply
                the bytes from any source that produces that same hash and
                the integrity claim holds.
              </div>
            )}
          </div>
        )}
      </article>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => setModal('request')}
          className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
        >
          Ask someone to confirm this
        </button>
        <button
          type="button"
          onClick={() => setModal('absorb')}
          className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
        >
          Add someone's confirmation
        </button>
        {noteText && (
          <>
            <button
              type="button"
              onClick={() => void handleShareToNostr()}
              disabled={sharing || !anyRelayLive}
              className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
            >
              {sharing
                ? 'Posting…'
                : shared
                  ? 'Post to Nostr again'
                  : 'Share to Nostr'}
            </button>
            {!anyRelayLive && (
              <p className="text-xs text-muted">
                Turn on staying reachable in Settings to post.
              </p>
            )}
            {shared && !sharing && (
              <p className="text-xs text-emerald-700">
                ✓ Already shared to Nostr.
              </p>
            )}
            {shareStatus && (
              <p className="text-xs text-muted" role="status">
                {shareStatus}
              </p>
            )}
          </>
        )}
        {!aboutSelf && (
          <button
            type="button"
            onClick={() => setModal('custody')}
            className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
          >
            Hand off custody of {subject}
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal('share-proof')}
          className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
        >
          Share a proof of one field
        </button>
        <button
          type="button"
          onClick={() => downloadJournalEntry(ownerId, passphrase, entry)}
          className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
        >
          Save to my files
        </button>
      </div>

      {modal === 'request' && (
        <CosignRequestModal
          attestation={entry}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'absorb' && (
        <AbsorbCosignModal onClose={() => setModal(null)} />
      )}
      {modal === 'custody' && (
        <CustodyHandoffModal
          subject={subject}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'share-proof' && (
        <ShareProofModal
          attestation={entry}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
