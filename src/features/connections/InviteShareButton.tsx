import { useState } from 'react';
import { buildInviteUrl } from './inviteLink.ts';
import { shareText } from '../../shared/lib/share.ts';

// "Invite by link" affordance. Builds a /join link carrying the
// operator's pubkey + display name (and, when `familyName` is passed,
// that family) and hands it to the system share sheet (iOS: Messages,
// AirDrop, Mail…) with a clipboard fallback. The link carries only
// public data — no secret rides it (see inviteLink.ts).
//
// Whoever opens the link lands on /join, taps Accept, and once they
// have an unlocked wallet their device remote-handshakes back to the
// operator automatically (useAcceptPendingInvite). When a family was
// named, the operator gets prompted to add the new connection to it.

interface Props {
  /** The operator's identity pubkey (founder of the invite). */
  founderPubkey: string;
  /** The operator's display name, shown to the invitee on /join. */
  founderName: string;
  /** When set, the invite names this family so the join flow can offer
   *  to add the new connection to it. Omit for a wallet-only invite. */
  familyName?: string;
  /** Button label override. Defaults to wallet-invite wording. */
  label?: string;
  /** Visual variant. 'primary' = filled accent; 'subtle' = text link. */
  variant?: 'primary' | 'subtle';
}

export function InviteShareButton({
  founderPubkey,
  founderName,
  familyName,
  label,
  variant = 'subtle',
}: Props) {
  const [note, setNote] = useState<string | null>(null);

  async function onShare() {
    setNote(null);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    let url: string;
    try {
      url = buildInviteUrl(origin, { founderPubkey, founderName, familyName });
    } catch {
      setNote('Could not build the link — your identity may not be ready yet.');
      return;
    }
    const message = familyName
      ? `${founderName} invited you to connect and join ${familyName} on Tapit:`
      : `${founderName} invited you to connect on Tapit:`;
    const outcome = await shareText({
      title: 'Join me on Tapit',
      text: `${message}\n${url}`,
    });
    if (outcome === 'copied') setNote('Link copied to clipboard.');
    else if (outcome === 'unavailable') setNote(url);
    // 'shared' / 'cancelled' need no note — the sheet spoke for itself.
  }

  const text =
    label ?? (familyName ? 'Invite by link' : 'Invite someone by link');

  return (
    <div>
      {variant === 'primary' ? (
        <button
          type="button"
          onClick={() => void onShare()}
          className="w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium hover:bg-ink/5"
        >
          {text}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void onShare()}
          className="text-xs font-medium text-accent hover:underline"
        >
          {text}
        </button>
      )}
      {note && (
        <p className="mt-2 break-all text-xs text-muted" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
