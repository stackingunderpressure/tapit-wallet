import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import {
  buildRemoteHandshakeDraft,
  findCompletedHandshakeWith,
  holdAndAnchor,
} from './createHandshake.ts';
import { consumePendingInvite } from './pendingInvite.ts';
import type { InvitePayload } from './inviteLink.ts';

// Once the wallet is unlocked, complete any invite the visitor accepted
// from a /join link. The invite carries the founder's pubkey + name;
// this hook drives the invitee side of the remote handshake:
//
//   1. Build a remote (Tier R) handshake draft naming the founder as
//      the responder, with relationship 'family' when the invite named
//      a family (so the connection card reads correctly).
//   2. Sign it and hold-and-anchor it locally so the invitee's own
//      copy persists.
//   3. sendEnvelope it to the founder. The founder's existing inbox
//      routing (cosign-witness → absorb) co-signs and returns it; the
//      invitee absorbs via the existing absorb-cosign path. No new
//      transport code — this reuses the proven remote-handshake loop.
//
// Idempotency: consumePendingInvite read-and-clears, and a ranRef gates
// against React StrictMode's double-invoke. If a completed handshake
// with the founder already exists (re-accept of the same link), the
// hook no-ops rather than minting a duplicate.
//
// Family note: the invite's familyName is surfaced back to the caller
// as `pendingFamilyName` so the founder side can prompt "add them to
// [family]" once they see the new connection. The invitee cannot add
// THEMSELVES to the founder's family — only the founder signs the
// family-unit envelope — so the family leg is founder-driven and lives
// on the family card, not here. This hook's job is the connection.

export interface AcceptInviteState {
  /** Non-null while a handshake-back is in flight or just finished, so
   *  the surface can show a small "Connecting with <name>…" / "Connected"
   *  affordance. Cleared after the operator dismisses or on next mount. */
  status:
    | { kind: 'idle' }
    | { kind: 'connecting'; founderName: string }
    | { kind: 'sent'; founderName: string; familyName?: string }
    | { kind: 'error'; founderName: string; message: string };
  dismiss: () => void;
}

export function useAcceptPendingInvite(): AcceptInviteState {
  const { wallet, ownerId, identity, holdings, sendEnvelope } = useWallet();
  const anchorWorker = useAnchorWorker();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<AcceptInviteState['status']>({
    kind: 'idle',
  });

  useEffect(() => {
    if (ranRef.current) return;
    if (!identity || !ownerId) return; // wait until the wallet is fully ready
    const invite = consumePendingInvite();
    if (!invite) return;
    ranRef.current = true;
    void run(invite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, ownerId]);

  async function run(invite: InvitePayload) {
    // Self-invite guard: opening your own link does nothing.
    if (invite.founderPubkey.toLowerCase() === wallet.identity.toLowerCase()) {
      return;
    }
    // Already connected (re-accept): no duplicate handshake.
    if (
      findCompletedHandshakeWith(holdings, wallet.keyHistory, invite.founderPubkey)
    ) {
      setStatus({
        kind: 'sent',
        founderName: invite.founderName,
        familyName: invite.familyName,
      });
      return;
    }
    if (!identity) return;
    setStatus({ kind: 'connecting', founderName: invite.founderName });
    try {
      const draft = buildRemoteHandshakeDraft(
        identity,
        { pubkey: invite.founderPubkey, name: invite.founderName },
        invite.familyName ? 'family' : undefined,
        invite.familyName,
      );
      const signed = wallet.sign(draft);
      await holdAndAnchor(wallet, ownerId ?? '', anchorWorker, signed);
      await sendEnvelope(invite.founderPubkey, signed);
      setStatus({
        kind: 'sent',
        founderName: invite.founderName,
        familyName: invite.familyName,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        founderName: invite.founderName,
        message:
          err instanceof Error
            ? err.message
            : 'Could not reach them — is Mycelium on?',
      });
    }
  }

  return { status, dismiss: () => setStatus({ kind: 'idle' }) };
}
