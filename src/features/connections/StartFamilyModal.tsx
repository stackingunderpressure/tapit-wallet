import { useMemo, useState } from 'react';
import { envelopeId } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import {
  buildFamilyUnitDraft,
  FAMILY_ROLES,
  type FamilyMember,
  type FamilyRole,
} from './familyUnit.ts';
import {
  displayNameOf,
  isHandshake,
  readHandshake,
} from './createHandshake.ts';
import { IdentityChip } from './IdentityChip.tsx';

// Family-mode form (operator authorization 2026-05-27, second cut on
// the family-mode arc). The founder names their family, picks their
// own role (dad / mom / parent / spouse), adds members from their
// handshake roster as one-tap rows with per-member role + optional
// backdated as_of date (a kid's actual birthday signed today). Sign
// produces a founder-signed family-unit credential, holds it locally,
// and refreshes — the family appears on the Identity tab immediately.
// Member-side ratification (each named member co-signs to confirm
// membership) is a follow-up cut that reuses the existing cosigning
// + Mycelium transport patterns; for this cut the family unit ships
// founder-signed and any named member's wallet can be sent the
// envelope later to add their signature.

interface Props {
  onClose: () => void;
}

interface DraftMember {
  pubkey: string;
  name: string;
  role: FamilyRole;
  asOf: string;
}

interface ContactOption {
  pubkey: string;
  name: string;
}

const ROLE_LABELS: Record<FamilyRole, string> = {
  dad: 'Dad',
  mom: 'Mom',
  parent: 'Parent',
  spouse: 'Spouse',
  child: 'Child',
  sibling: 'Sibling',
};

export function StartFamilyModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, identity, save, refresh } = useWallet();
  const anchorWorker = useAnchorWorker();
  const [familyName, setFamilyName] = useState('');
  const [myRole, setMyRole] = useState<FamilyRole>('parent');
  const [myAsOf, setMyAsOf] = useState('');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contacts = useMemo<ContactOption[]>(() => {
    const found: ContactOption[] = [];
    const seen = new Set<string>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      const candidates: ContactOption[] = [];
      if (v.initiatorId && v.initiatorId !== wallet.identity) {
        candidates.push({ pubkey: v.initiatorId, name: v.initiatorName || '' });
      }
      if (v.responderId && v.responderId !== wallet.identity) {
        candidates.push({ pubkey: v.responderId, name: v.responderName || '' });
      }
      for (const c of candidates) {
        const k = c.pubkey.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        found.push({ pubkey: k, name: c.name });
      }
    }
    return found;
  }, [holdings, wallet.identity]);

  const addedKeys = useMemo(
    () => new Set(members.map((m) => m.pubkey.toLowerCase())),
    [members],
  );

  function addContact(c: ContactOption) {
    const lower = c.pubkey.toLowerCase();
    if (addedKeys.has(lower)) return;
    setMembers((prev) => [
      ...prev,
      { pubkey: lower, name: c.name, role: 'child', asOf: '' },
    ]);
  }

  function updateMember(idx: number, patch: Partial<DraftMember>) {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function sign() {
    setError(null);
    if (!identity) {
      setError('Your identity attestation is missing — re-unlock and try again.');
      return;
    }
    if (familyName.trim().length === 0) {
      setError('Give your family a name.');
      return;
    }
    setBusy(true);
    try {
      const founderMember: FamilyMember = {
        pubkey: identity.subject,
        name: displayNameOf(identity),
        role: myRole,
        ...(myAsOf ? { as_of: myAsOf } : {}),
      };
      const others: FamilyMember[] = members.map((m) => ({
        pubkey: m.pubkey,
        name: m.name || 'Member',
        role: m.role,
        ...(m.asOf ? { as_of: m.asOf } : {}),
      }));
      const draft = buildFamilyUnitDraft(identity, familyName.trim(), [
        founderMember,
        ...others,
      ]);
      const signed = wallet.sign(draft);
      await wallet.hold(signed);
      const digestHex = envelopeId(signed);
      if (ownerId) {
        await anchorQueue.upsert(ownerId, {
          digestHex,
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Start a family</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Name your family, then add the people in it from your
          connections. Each member's role is recorded. You can set a
          backdated date for when each member joined (a kid's actual
          birthday, a spouse's marriage date) even though you are
          signing today.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Family name</span>
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="The Winchesters"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            autoCapitalize="words"
            autoCorrect="off"
          />
        </label>

        <div className="mt-4 rounded-md border border-ink/10 bg-white p-3">
          <div className="text-xs font-medium">You</div>
          <div className="mt-2">
            <IdentityChip
              pubkey={wallet.identity}
              name={identity ? displayNameOf(identity) : 'You'}
              size="md"
            />
          </div>
          <label className="mt-3 block text-xs">
            <span className="text-muted">Your role in this family</span>
            <select
              value={myRole}
              onChange={(e) => setMyRole(e.target.value as FamilyRole)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            >
              {FAMILY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block text-xs">
            <span className="text-muted">
              Your as-of date <span className="text-muted/70">(optional)</span>
            </span>
            <input
              type="date"
              value={myAsOf}
              onChange={(e) => setMyAsOf(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium">Family members ({members.length})</div>
          {members.length > 0 && (
            <ul className="mt-2 space-y-2">
              {members.map((m, i) => (
                <li
                  key={m.pubkey}
                  className="rounded-md border border-ink/15 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <IdentityChip
                      pubkey={m.pubkey}
                      name={m.name}
                      size="md"
                      className="min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeMember(i)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="text-muted">Role</span>
                      <select
                        value={m.role}
                        onChange={(e) =>
                          updateMember(i, { role: e.target.value as FamilyRole })
                        }
                        className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                      >
                        {FAMILY_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs">
                      <span className="text-muted">As-of</span>
                      <input
                        type="date"
                        value={m.asOf}
                        onChange={(e) => updateMember(i, { asOf: e.target.value })}
                        className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-md border border-ink/10 bg-white p-3">
          <div className="text-xs font-medium">Add from your connections</div>
          {contacts.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              No handshake connections yet. Make a handshake with a family
              member first, then come back to add them.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {contacts.map((c) => {
                const already = addedKeys.has(c.pubkey);
                return (
                  <li key={c.pubkey}>
                    <button
                      type="button"
                      onClick={() => addContact(c)}
                      disabled={already}
                      className={`w-full text-left rounded-md border px-3 py-2 ${
                        already
                          ? 'border-ink/10 bg-ink/5 opacity-60'
                          : 'border-ink/15 bg-white hover:bg-ink/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <IdentityChip
                          pubkey={c.pubkey}
                          name={c.name}
                          size="md"
                          className="min-w-0"
                        />
                        {already && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                            Added
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-muted">
          Signing creates a founder-signed family-unit envelope held in
          your wallet. Each named member's wallet can co-sign later to
          ratify their membership; ratifications progress is shown on
          the family card on your Identity tab.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={sign}
            disabled={busy || familyName.trim().length === 0}
            className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
          >
            {busy ? 'Signing…' : 'Sign and create family'}
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
      </div>
    </div>
  );
}
