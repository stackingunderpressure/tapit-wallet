// Thin wrapper around the Web Share API with a clipboard fallback.
// On iOS Safari and the installed PWA, navigator.share surfaces the
// system share sheet — AirDrop, Messages, Mail, and any other app
// the user has installed — which is exactly the channel families
// will use to hand off signed envelopes between devices. On
// browsers without navigator.share (Firefox desktop, some older
// engines) we fall back to clipboard so the operator can still
// paste the payload manually.
//
// The user cancelling the share sheet is treated as a successful
// handoff from our side — no fall-through to clipboard, because
// the user explicitly closed the picker. Other share failures
// fall through to clipboard so the operator always has a usable
// path.

export type ShareOutcome =
  | 'shared'
  | 'cancelled'
  | 'copied'
  | 'unavailable';

export async function shareText(opts: {
  title: string;
  text: string;
}): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: opts.title, text: opts.text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User dismissed the share sheet — that's a deliberate
        // close, not an error. Don't fall back to clipboard.
        return 'cancelled';
      }
      // Real failure (permission, payload too large, etc.) — try clipboard.
    }
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(opts.text);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}

/** True if navigator.share exists at all. Lets UIs hide the
 *  Share button on browsers that don't support it rather than
 *  showing a button that always falls through to clipboard. */
export function canShare(): boolean {
  return typeof navigator.share === 'function';
}

export type FileShareOutcome = 'shared' | 'cancelled' | 'downloaded';

// Share an actual file (e.g. a stamped photo) through the Web Share
// API Level 2 file pathway — on iOS / the installed PWA this is the
// same system sheet (AirDrop, Messages, Save to Files) but carrying
// the image itself, not just text. Where files-sharing is not
// supported (most desktop browsers) we fall back to a download so
// the operator always ends up with the file in hand. A user
// cancelling the sheet is a deliberate close, not a failure.
export async function shareFile(
  file: File,
  title: string,
): Promise<FileShareOutcome> {
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Real failure — fall through to download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
