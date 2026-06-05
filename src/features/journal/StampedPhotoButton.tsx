import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { buildVerifyUrl } from '../disclosure/buildVerifyUrl.ts';
import { stampPhoto } from './stampPhoto.ts';
import { shareFile } from '../../shared/lib/share.ts';

// "Share a stamped copy" — composites the verification badge (Tapit mark +
// date + who captured it + Bitcoin block + a scannable verify QR) into the
// corner of a COPY of the photo and hands it to the system share sheet, or
// downloads it where file-sharing isn't supported. The original signed +
// anchored photo is never modified (operator chose "stamped copy on share").
//
// The QR discloses the attachment hash leaf via the same proof-bundle path
// the Fresh share card uses, so anyone who scans it lands on /verify with the
// proof loaded and can re-hash the photo to confirm it is the one that was
// signed and time-anchored.

interface Props {
  attestation: Attestation;
  /** Object URL of the original photo bytes (already loaded for display). */
  imageUrl: string;
  /** Operator display name / handle for the "captured by" line. */
  capturedBy: string;
  /** Pre-formatted capture date. */
  dateText: string;
  /** Confirmed Bitcoin block height, or undefined while still anchoring. */
  btcHeight?: number;
}

// True when the claim tree carries a top-level leaf by this name. Used to
// disclose `written_at` only when it actually exists — older or foreign
// entries may lack it, and multiDisclosureProof throws on a missing path.
function hasLeaf(att: Attestation, name: string): boolean {
  return att.claim.children.some((c) => c.name === name);
}

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; detail: string }
  | { kind: 'error'; detail: string };

export function StampedPhotoButton({
  attestation,
  imageUrl,
  capturedBy,
  dateText,
  btcHeight,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function run() {
    setState({ kind: 'working' });
    try {
      // Disclose the attachment hash (the integrity commitment), and the
      // written-at date for context only when that leaf exists — older or
      // foreign entries may not carry it, and a missing path would throw.
      const paths = ['attachment_sha256'];
      if (hasLeaf(attestation, 'written_at')) paths.push('written_at');
      const minted = buildVerifyUrl(attestation, paths);
      const blob = await stampPhoto(imageUrl, {
        name: capturedBy,
        dateText,
        btcHeight,
        verifyUrl: minted.verifyUrl,
      });
      const file = new File([blob], 'tapit-verified-photo.jpg', {
        type: 'image/jpeg',
      });
      // Pass the verify URL as share text too, so the link survives even if
      // the recipient never scans the QR baked into the image.
      const outcome = await shareFile(
        file,
        'Tapit verified photo',
        minted.verifyUrl,
      );
      setState({
        kind: 'done',
        detail:
          outcome === 'shared'
            ? 'Shared the stamped copy.'
            : outcome === 'downloaded'
              ? 'Saved the stamped copy to your files.'
              : 'Share cancelled.',
      });
    } catch (err) {
      setState({
        kind: 'error',
        detail:
          err instanceof Error ? err.message : 'Could not stamp the photo.',
      });
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state.kind === 'working'}
        className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
      >
        {state.kind === 'working'
          ? 'Stamping the photo…'
          : '🔏 Share a stamped copy'}
      </button>
      <p className="mt-1 text-[11px] text-muted">
        Burns a small verify badge — date, who took it, the Bitcoin block, and
        a scannable code — into the corner of a copy. Your original photo is
        left untouched.
      </p>
      {state.kind === 'done' && (
        <p className="mt-1 text-xs text-emerald-700" role="status">
          {state.detail}
        </p>
      )}
      {state.kind === 'error' && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {state.detail}
        </p>
      )}
    </div>
  );
}
