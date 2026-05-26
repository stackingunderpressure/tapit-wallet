import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import {
  acceptedSelfMemberships,
  pendingSelfMemberships,
  publishOpenMemberRoster,
} from '../connections/openMemberRoster.ts';
import { useWallet } from './useWallet.ts';

// Phase 8 Phase E4 cut 3 — extracted from HomeScreen.tsx so the Identity-
// tab org-mode roster section keeps its computed members + publish
// handler in one cohesive surface without pushing HomeScreen past the
// 800-line hard limit. Returns the chronological joined-members list,
// the pending-delta against the latest published roster, a publishing
// flag, and the publish callback that signs + holds + anchors a fresh
// open-member-roster envelope.
//
// `enabled === false` (i.e. the wallet has not self-declared as an
// org) returns empty arrays + a no-op publish so the call site can
// invoke this hook unconditionally inside the org-mode render branch
// without extra null guards.

interface OpenMemberRosterControls {
  joinedMembers: readonly Attestation[];
  pendingMembers: readonly Attestation[];
  publishing: boolean;
  publish: () => Promise<void>;
}

export function useOpenMemberRosterControls(
  enabled: boolean,
): OpenMemberRosterControls {
  const { wallet, ownerId, holdings, anchorWorker, save, refresh } = useWallet();
  const [publishing, setPublishing] = useState(false);

  const joinedMembers = useMemo(
    () => (enabled ? acceptedSelfMemberships(wallet.identity, holdings) : []),
    [holdings, wallet.identity, enabled],
  );
  const pendingMembers = useMemo(
    () => (enabled ? pendingSelfMemberships(wallet.identity, holdings) : []),
    [holdings, wallet.identity, enabled],
  );

  async function publish() {
    if (!enabled || publishing) return;
    setPublishing(true);
    try {
      await publishOpenMemberRoster(wallet, ownerId, anchorWorker, holdings);
      await save();
      await refresh();
    } catch (err) {
      console.warn('publish open-member roster failed', err);
    } finally {
      setPublishing(false);
    }
  }

  return { joinedMembers, pendingMembers, publishing, publish };
}
