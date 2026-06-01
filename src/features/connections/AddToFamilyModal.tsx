import { useMemo, useState } from 'react';
import { envelopeId } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import {
  buildFamilyWithAddedMember,
  familyOtherRatifierCount,
  FAMILY_ROLES,
  findFamilyUnitsForMember,
  isFamilyFounder,
  readFamilyUnit,
  type FamilyRole,
} from './familyUnit.ts';

// "Add to family" — the founder-driven leg of the invite-link family
// flow. Opened from a connection (PeerThread) once that person is
// connected. Adding a member to an immutable family envelope means
// rebuilding + re-signing the whole thing (buildFamilyWithAddedMember),
// exactly as the Edit flow does, so the same sole-signer gate applies:
// re-signing mints a new envelopeId and would orphan any ratifications
// already collected, so only families the operator FOUNDED and is the
// SOLE signer of (familyOtherRatifierCount === 0) are offered. A family
// the peer is already in is filtered out.
//
// On confirm: rebuild → sign → hold the new envelope → unhold the old
// one (after the new is safely held, so a crash never leaves neither) →
// queue anchoring → save → refresh → best-effort send the rebuilt
// envelope to every named member so their copies update and they can
// ratify. Mirrors StartFamilyModal's edit-mode sequence.

const ROLE_LABELS: Record<FamilyRole, string> = {
  dad: 'Dad',
  mom: 'Mom',
  parent: 'Parent',
  spouse: 'Spouse',
  child: 'Child',
  sibling: 'Sibling',
};

interface Props {
  peerPubkey: string;
  peerName: string;
  onClose: () => void;
}

export function AddToFamilyModal({ peerPubkey, peerName, onClose }: Props) {
  const { wallet, ownerId, holdings, identity, save, refresh, sendEnvelope } =
    useWallet();
  const anchorWorker = useAnchorWorker();
  const myIdentity = wallet.identity.toLowerCase();
  const peerLower = peerPubkey.toLowerCase();

  const keyAliases = useMemo<ReadonlyMap<string, readonly string[]>>(() => {
    const m = new Map<string, readonly string[]>();
    m.set(myIdentity, wallet.keyHistory.map((k) => k.toLowerCase()));
    return m;
  }, [myIdentity, wallet.keyHistory]);

  // Families the operator founded, is the sole signer of, and that do
  // NOT already include the peer.
  const eligibleFamilies = useMemo(() => {
    return findFamilyUnitsForMember(holdings, wallet.identity).filter((a) => {
      if (!isFamilyFounder(a, wallet.identity)) return false;
      if (familyOtherRatifierCount(a, keyAliases) !== 0) return false;
      const view = readFamilyUnit(a);
      return !view.members.some((m) => m.pubkey.toLowerCase() === peerLower);
    });
  }, [holdings, wallet.identity, keyAliases, peerLower]);

  const [selectedId, setSelectedId] = useState<string>(
    () => (eligibleFamilies[0] ? envelopeId(eligibleFamilies[0]) : ''),
  );
  const [role, setRole] = useState<FamilyRole>('child');
  const [asOf, setAsOf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const selected = eligibleFamilies.find((a) => envelopeId(a) === selectedId);

  async function add() {
    setError(null);
    if (!identity) {
      setError('Your identity is not ready — re-unlock and try again.');
      return;
    }
    if (!selected) {
      setError('Pick a family.');
      return;
    }
    setBusy(true);
    try {
      const draft = buildFamilyWithAddedMember(identity, selected, {
        pubkey: peerPubkey,
        name: peerName || 'Member',
        role,
        ...(asOf ? { as_of: asOf } : {}),
      });
      const signed = wallet.sign(draft);
      await wallet.hold(signed);
      const oldId = envelopeId(selected);
      const newId = envelopeId(signed);
      if (oldId !== newId) {
        await wallet.unhold(oldId);
      }
      if (ownerId) {
        await anchorQueue.upsert(ownerId, {
          digestHex: newId,
          state: 'queued',
          anchor: null,
          attempts: 0,
          last_attempt: null,
          last_error: null,
        });
        if (anchorWorker) void anchorWorker.kick();
      }
      await save();
      await refresh();
      // Best-effort: send the rebuilt envelope to every named non-self
      // member so their held copy updates and the new member can ratify.
      const view = readFamilyUnit(signed);
      const targets = view.members
        .map((m) => m.pubkey)
        .filter((pk) => pk.toLowerCase() !== myIdentity);
      for (const pk of targets) {
        try {
          await sendEnvelope(pk, signed);
        } catch {
          // Non-fatal — the family is held locally; the family card's
          // "Send to awaiting members" is the retry path.
        }
      }
      setDone(view.familyName || 'your family');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to family.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add to a family</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {done ? (
          <>
            <p className="mt-3 text-sm">
              Added <span className="font-medium">{peerName || 'them'}</span> to{' '}
              <span className="font-medium">{done}</span>. They'll get a
              ratification request, and the family card on your Identity tab
              shows them as awaiting their signature.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Done
            </button>
          </>
        ) : eligibleFamilies.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-muted">
              No family is available to add {peerName || 'this person'} to.
              You can only add people to a family you founded and are the
              only signer of yet — once someone has ratified, the roster is
              locked. Start a family from your Identity tab, or they may
              already be in your families.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Add <span className="font-medium">{peerName || 'this person'}</span>{' '}
              to one of your families. They'll be sent a ratification request.
            </p>

            <label className="mt-4 block text-xs">
              <span className="text-muted">Family</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              >
                {eligibleFamilies.map((a) => {
                  const id = envelopeId(a);
                  const v = readFamilyUnit(a);
                  return (
                    <option key={id} value={id}>
                      {v.familyName || 'Unnamed family'}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="mt-3 block text-xs">
              <span className="text-muted">Their role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as FamilyRole)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              >
                {FAMILY_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs">
              <span className="text-muted">
                As-of date <span className="text-muted/70">(optional)</span>
              </span>
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy || !selected}
                className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                {busy ? 'Adding…' : 'Add to family'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
