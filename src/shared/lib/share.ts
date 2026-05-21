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
