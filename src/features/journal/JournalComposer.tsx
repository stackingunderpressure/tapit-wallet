import { lazy, Suspense, useRef, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { createJournalEntry } from './createJournalEntry.ts';
import { SUGGESTED_CATEGORIES } from './categories.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { normalizeImage } from './normalizeImage.ts';

const CameraCaptureModal = lazy(() =>
  import('../camera/CameraCaptureModal.tsx').then((m) => ({
    default: m.CameraCaptureModal,
  })),
);

const DOC_ACCEPT =
  'application/pdf,text/plain,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/heic';

interface Props {
  /** Called with the new entry's digest when the entry lands. */
  onCreated: (digestHex: string) => void;
  /** Called when the user dismisses without creating. */
  onCancel: () => void;
  /**
   * Sub-cut 2c — optional pre-fill from a chat moment. When the
   * operator promotes a chat bubble or composer-line into a
   * journal entry, PeerThread sends the source text + peer name
   * upward; HomeScreen routes it here so the composer opens with
   * the text already written and the subject pinned to the peer.
   */
  prefill?: {
    text?: string;
    subjectLabel?: string;
    category?: string;
  };
}

type SubjectMode = 'me' | 'other';

export function JournalComposer({ onCreated, onCancel, prefill }: Props) {
  const { wallet, ownerId, passphrase, prefs, save, syncEnvelope } = useWallet();
  const worker = useAnchorWorker();
  const [title, setTitle] = useState('');
  const [text, setText] = useState(prefill?.text ?? '');
  const initialCategory =
    prefill?.category && SUGGESTED_CATEGORIES.includes(prefill.category as never)
      ? prefill.category
      : prefill?.category
        ? '__custom'
        : SUGGESTED_CATEGORIES[0];
  const [category, setCategory] = useState<string>(initialCategory);
  const [customCategory, setCustomCategory] = useState(
    initialCategory === '__custom' ? (prefill?.category ?? '') : '',
  );
  const [subjectMode, setSubjectMode] = useState<SubjectMode>(
    prefill?.subjectLabel ? 'other' : 'me',
  );
  const [subjectLabel, setSubjectLabel] = useState(prefill?.subjectLabel ?? '');
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker handler — normalizes HEIC/HEIF/etc. to JPEG so the photo
  // renders everywhere (iPhone captures HEIC by default; Chrome and
  // Android cannot display HEIC in an <img> tag). Visible
  // attachmentBusy lets the operator see something is happening
  // when the conversion takes a second on a big photo.
  async function onPickAttachment(file: File | null) {
    if (!file) {
      setAttachment(null);
      return;
    }
    setError(null);
    setAttachmentBusy(true);
    try {
      const normalized = await normalizeImage(file);
      setAttachment(normalized);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read photo: ${err.message}`
          : 'Could not read photo on this device.',
      );
      setAttachment(null);
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0) {
      setError('Write something for the entry.');
      return;
    }
    if (subjectMode === 'other' && subjectLabel.trim().length === 0) {
      setError("Name the subject (or pick 'About me').");
      return;
    }
    const chosenCategory =
      category === '__custom' ? customCategory.trim() : category;
    if (chosenCategory.length === 0) {
      setError('Pick or type a category.');
      return;
    }
    if (!passphrase) {
      setError('Wallet is locked — sign in again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createJournalEntry(
        wallet,
        ownerId,
        passphrase,
        worker,
        {
          title: title.trim() || undefined,
          text: text.trim(),
          category: chosenCategory,
          subject:
            subjectMode === 'me'
              ? wallet.identity
              : subjectLabel.trim(),
          attachment: attachment ?? undefined,
        },
        prefs.cloudSync,
      );
      // Persist wallet state so the held attestation survives reload.
      await save();
      // 5c-iii-b — fire-and-forget multi-device sync. When Mycelium is
      // on, this publishes a self-CC encrypted to our own pubkey so
      // any other device of this wallet catches the entry in real time.
      // When Mycelium is off, syncEnvelope returns null and we don't
      // care; the existing cloud-sync via walletStore.save still
      // delivers eventually.
      void syncEnvelope(result.attestation).catch((err) => {
        console.warn('multi-device sync publish failed', err);
      });
      onCreated(result.digestHex);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="entry-title">
          Title{' '}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="entry-title"
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          placeholder="Short headline — leave empty to let the first line stand in"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="entry-text">
          What happened?
        </label>
        <textarea
          id="entry-text"
          required
          rows={5}
          autoFocus={title.length === 0}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          placeholder="What did you do today? Who was there? What do you want to remember?"
        />
      </div>

      <div>
        <span className="text-sm font-medium">About</span>
        <div className="mt-1 flex gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={subjectMode === 'me'}
              onChange={() => setSubjectMode('me')}
            />
            Me
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={subjectMode === 'other'}
              onChange={() => setSubjectMode('other')}
            />
            Someone else
          </label>
        </div>
        {subjectMode === 'other' && (
          <input
            type="text"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
            placeholder='e.g. "Grandson Tom Jr"'
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        )}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="entry-category">
          Category
        </label>
        <select
          id="entry-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
        {category === '__custom' && (
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Type a category"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        )}
      </div>

      <div>
        <span className="text-sm font-medium">Attachment (optional)</span>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onPickAttachment(e.target.files?.[0] ?? null)}
        />
        <input
          ref={docRef}
          type="file"
          accept={DOC_ACCEPT}
          hidden
          onChange={(e) => onPickAttachment(e.target.files?.[0] ?? null)}
        />
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm hover:bg-ink/5"
          >
            📷 Camera
          </button>
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm hover:bg-ink/5"
          >
            🖼 Photo
          </button>
          <button
            type="button"
            onClick={() => docRef.current?.click()}
            className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm hover:bg-ink/5"
          >
            📄 Document
          </button>
        </div>
        {attachmentBusy && (
          <p className="mt-2 text-xs text-muted">Reading photo…</p>
        )}
        {!attachmentBusy && attachment && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted truncate">
              ✓ {attachment.name} — {Math.round(attachment.size / 1024)} KB
              {attachment.type && (
                <span className="ml-1">({attachment.type})</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-xs text-muted hover:text-ink ml-2 shrink-0"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Signing your entry…' : 'Sign this entry'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {cameraOpen && (
        <Suspense fallback={null}>
          <CameraCaptureModal
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => {
              setCameraOpen(false);
              void onPickAttachment(file);
            }}
          />
        </Suspense>
      )}
    </form>
  );
}
