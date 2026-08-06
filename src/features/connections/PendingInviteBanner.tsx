import { useState } from 'react';
import { peekPendingInvite } from './pendingInvite.ts';
import type { InvitePayload } from './inviteLink.ts';

// The missing half of the /join -> sign-in handoff. JoinScreen stashes
// the decoded invite (setPendingInvite) and sends a signed-out visitor
// into the normal app entry, which AuthGate routes to LoginPage — but
// until this component existed, nothing on LoginPage ever looked at
// what was stashed. A visitor with no wallet yet landed on a bare
// sign-in / create-account form with no trace that an invite had
// ever been involved, which reads as "the invite got lost" — even
// though pendingInvite.ts was carrying it the whole time for
// useAcceptPendingInvite to pick up once they're unlocked.
//
// peekPendingInvite() (pendingInvite.ts) already existed for exactly
// this and was unused everywhere except its own file — this is the
// first real caller. Read-only: consuming (clearing) the stash still
// happens exactly once, post-unlock, in useAcceptPendingInvite.
//
// Written once in Classic tokens (bg-ink / text-paper / bg-white /
// text-accent) -- index.css's [data-theme="fresh"] override already
// reskins these same classes for the Fresh login shell, so this one
// component covers both presentations without a theme branch.
export function PendingInviteBanner() {
  // Lazy initializer -- reads sessionStorage once, during the first
  // render itself, so there's no post-mount effect and no one-frame
  // flash of a missing banner before it pops in.
  const [invite] = useState<InvitePayload | null>(() => peekPendingInvite());

  if (!invite) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 border-b border-ink/15 bg-ink px-4 py-2.5 text-center text-xs font-medium text-paper"
    >
      Signing in to accept {invite.founderName}'s invite
      {invite.familyName ? ` to join ${invite.familyName}` : ''} — nothing
      new happens until you finish signing in.
    </div>
  );
}
