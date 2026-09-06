import { useMemo, useState } from 'react';
import { envelopeId, type Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import {
  buildFamilyUnitDraft,
  buildFamilyWithAddedMembers,
  familyOtherRatifierCount,
  findFamilyUnitsForMember,
  isFamilyFounder,
  readFamilyUnit,
  type FamilyMember,
  type FamilyRole,
} from './familyUnit.ts';
import { displayNameOf, isHandshake, readHandshake } from './createHandshake.ts';
import {
  MemberDetailsStep,
  NameStep,
  PickContactStep,
  PickFamilyStep,
  RosterStep,
  Sheet,
  type Contact,
  type DraftMember,
} from './FamilyWizardSteps.tsx';

// FamilyWizard -- step-by-step overhaul of the family-building flow
// (operator: "let's gut check it and overhaul to be better ui. Start
// your family then build it member by member through adding and
// attesting each. It's kinda dumb now"). Replaces two things that used
// to be separate and partly duplicated each other: StartFamilyModal
// (one long scrolling form -- name the family, then a members list AND
// a contacts picker both crammed into the same screen) and
// AddToFamilyModal (a near-duplicate single-member form opened from a
// connection's thread). One wizard now covers all three real entry
// points:
//   'create'     -- name a new family, then add members one at a time,
//                    each reviewed and confirmed before moving to the
//                    next, then sign once at the end.
//   'edit'       -- same shape, pre-filled from an existing family the
//                    founder is still the sole signer of; the full
//                    roster stays editable (add / remove / change
//                    anyone), matching the old edit affordance.
//   'add-member' -- opened from a peer's connection thread. Existing
//                    members are shown locked (read only -- this mode
//                    never rewrites someone else's row, same guarantee
//                    AddToFamilyModal made); only the newly staged
//                    member(s) this session are editable. Picks the
//                    target family first when the operator has more
//                    than one eligible.
// The core UX change asked for: "adding" is now its own dedicated step
// (pick a contact from your connections, searchable; set their role +
// an optional backdated as-of date) capped by an explicit confirm --
// the per-member "attest" ritual the operator named -- rather than an
// ever-growing single form. The roster screen between adds is the hub:
// see what's staged, add another, or sign. Only one credential envelope
// is ever produced either way (family_unit's data model is deliberately
// ONE signed unit, not per-member envelopes -- see familyUnit.ts's
// header comment); "attesting each" describes this per-member confirm
// step at the UI layer, not a new cryptographic signature per person.
//
// Split from a single 828-line file into this orchestrator (state +
// signing logic) plus FamilyWizardSteps.tsx (the step JSX) to stay
// under the 800-line hard limit / 400-line soft warn.

type Step =
  | { kind: 'pick-family' }
  | { kind: 'name' }
  | { kind: 'roster' }
  | { kind: 'pick-contact' }
  | { kind: 'member-details'; contact: Contact; editIndex?: number };

interface Props {
  mode: 'create' | 'edit' | 'add-member';
  /** 'edit' only -- the existing family being edited. */
  editing?: Attestation;
  /** 'add-member' only -- who is being added, from their thread. */
  addMemberTarget?: Contact;
  /** 'add-member' only -- pre-select the family matching an invite's
   *  family_hint when the operator has more than one eligible. */
  preselectFamilyName?: string;
  onClose: () => void;
}

export function FamilyWizard({
  mode,
  editing,
  addMemberTarget,
  preselectFamilyName,
  onClose,
}: Props) {
  const { wallet, ownerId, holdings, identity, save, refresh, sendEnvelope } =
    useWallet();
  const anchorWorker = useAnchorWorker();
  const myIdentityLower = wallet.identity.toLowerCase();

  const keyAliases = useMemo<ReadonlyMap<string, readonly string[]>>(() => {
    const m = new Map<string, readonly string[]>();
    m.set(myIdentityLower, wallet.keyHistory.map((k) => k.toLowerCase()));
    return m;
  }, [myIdentityLower, wallet.keyHistory]);

  // -- add-member: which existing family this session targets ---------
  const eligibleFamilies = useMemo(() => {
    if (mode !== 'add-member' || !addMemberTarget) return [];
    const peerLower = addMemberTarget.pubkey.toLowerCase();
    return findFamilyUnitsForMember(holdings, wallet.identity).filter((a) => {
      if (!isFamilyFounder(a, wallet.identity)) return false;
      if (familyOtherRatifierCount(a, keyAliases) !== 0) return false;
      const view = readFamilyUnit(a);
      return !view.members.some((m) => m.pubkey.toLowerCase() === peerLower);
    });
  }, [mode, addMemberTarget, holdings, wallet.identity, keyAliases]);

  const [targetFamilyId, setTargetFamilyId] = useState<string>(() => {
    if (mode !== 'add-member') return '';
    if (preselectFamilyName) {
      const match = eligibleFamilies.find(
        (a) =>
          readFamilyUnit(a).familyName.trim().toLowerCase() ===
          preselectFamilyName.trim().toLowerCase(),
      );
      if (match) return envelopeId(match);
    }
    return eligibleFamilies[0] ? envelopeId(eligibleFamilies[0]) : '';
  });
  const targetFamily =
    mode === 'add-member'
      ? eligibleFamilies.find((a) => envelopeId(a) === targetFamilyId)
      : undefined;
  const targetFamilyView = targetFamily ? readFamilyUnit(targetFamily) : null;

  const activeEditing = mode === 'edit' ? editing : targetFamily;
  const editingView = useMemo(
    () => (activeEditing ? readFamilyUnit(activeEditing) : null),
    [activeEditing],
  );

  // -- name / your-role state (create + edit only) ---------------------
  const [familyName, setFamilyName] = useState(() => editingView?.familyName ?? '');
  const [myRole, setMyRole] = useState<FamilyRole>(
    () =>
      editingView?.members.find((m) => m.pubkey.toLowerCase() === myIdentityLower)
        ?.role ?? 'parent',
  );
  const [myAsOf, setMyAsOf] = useState(
    () =>
      editingView?.members.find((m) => m.pubkey.toLowerCase() === myIdentityLower)
        ?.as_of ?? '',
  );

  // -- roster state ------------------------------------------------------
  // create/edit: every row is editable, seeded from the editing envelope
  // (founder split out above into the myRole/myAsOf fields).
  // add-member: `lockedMembers` mirrors the target family's CURRENT
  // roster verbatim -- never rewritten by this mode; `members` is only
  // what's being staged this session.
  const [members, setMembers] = useState<DraftMember[]>(() => {
    if (mode === 'add-member') return [];
    return (editingView?.members ?? [])
      .filter((m) => m.pubkey.toLowerCase() !== myIdentityLower)
      .map((m) => ({
        pubkey: m.pubkey.toLowerCase(),
        name: m.name,
        role: m.role,
        asOf: m.as_of ?? '',
      }));
  });
  const lockedMembers: DraftMember[] = useMemo(() => {
    if (mode !== 'add-member' || !targetFamilyView) return [];
    return targetFamilyView.members.map((m) => ({
      pubkey: m.pubkey.toLowerCase(),
      name: m.name,
      role: m.role,
      asOf: m.as_of ?? '',
    }));
  }, [mode, targetFamilyView]);

  const [step, setStep] = useState<Step>(() => {
    if (mode === 'add-member') {
      if (eligibleFamilies.length > 1 && !preselectFamilyName) return { kind: 'pick-family' };
      if (addMemberTarget) return { kind: 'member-details', contact: addMemberTarget };
      return { kind: 'roster' };
    }
    return { kind: 'name' };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState('');
  const [doneFamilyName, setDoneFamilyName] = useState<string | null>(null);

  const allTakenKeys = useMemo(
    () => new Set([...lockedMembers, ...members].map((m) => m.pubkey)),
    [lockedMembers, members],
  );

  const contacts = useMemo<Contact[]>(() => {
    const found: Contact[] = [];
    const seen = new Set<string>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      const candidates: Contact[] = [];
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

  const filteredContacts = useMemo(() => {
    const q = contactFilter.trim().toLowerCase();
    return contacts.filter((c) => {
      if (allTakenKeys.has(c.pubkey)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.pubkey.includes(q);
    });
  }, [contacts, allTakenKeys, contactFilter]);

  function confirmMember(contact: Contact, role: FamilyRole, asOf: string, editIndex?: number) {
    const draft: DraftMember = {
      pubkey: contact.pubkey.toLowerCase(),
      name: contact.name || 'Member',
      role,
      asOf,
    };
    setMembers((prev) =>
      editIndex !== undefined
        ? prev.map((m, i) => (i === editIndex ? draft : m))
        : [...prev, draft],
    );
    setStep({ kind: 'roster' });
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function signAndSend() {
    setError(null);
    if (!identity) {
      setError('Your identity attestation is missing -- re-unlock and try again.');
      return;
    }
    setBusy(true);
    try {
      let draft: Attestation;
      let targets: string[];
      let resultFamilyName: string;
      if (mode === 'add-member') {
        if (!targetFamily) throw new Error('Pick a family first.');
        if (members.length === 0) throw new Error('Add at least one member first.');
        const newOnes: FamilyMember[] = members.map((m) => ({
          pubkey: m.pubkey,
          name: m.name,
          role: m.role,
          ...(m.asOf ? { as_of: m.asOf } : {}),
        }));
        draft = buildFamilyWithAddedMembers(identity, targetFamily, newOnes);
        const view = readFamilyUnit(draft);
        resultFamilyName = view.familyName || 'your family';
        targets = view.members
          .map((m) => m.pubkey)
          .filter((pk) => pk.toLowerCase() !== myIdentityLower);
      } else {
        if (familyName.trim().length === 0) throw new Error('Give your family a name.');
        const founderMember: FamilyMember = {
          pubkey: identity.subject,
          name: displayNameOf(identity),
          role: myRole,
          ...(myAsOf ? { as_of: myAsOf } : {}),
        };
        const others: FamilyMember[] = members.map((m) => ({
          pubkey: m.pubkey,
          name: m.name,
          role: m.role,
          ...(m.asOf ? { as_of: m.asOf } : {}),
        }));
        draft = buildFamilyUnitDraft(identity, familyName.trim(), [
          founderMember,
          ...others,
        ]);
        resultFamilyName = familyName.trim();
        targets = others.map((m) => m.pubkey);
      }

      const signed = wallet.sign(draft);
      await wallet.hold(signed);
      if (mode !== 'create' && activeEditing) {
        const oldId = envelopeId(activeEditing);
        const newId = envelopeId(signed);
        if (oldId !== newId) await wallet.unhold(oldId);
      }
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

      let sendFailed = 0;
      for (const pubkey of targets) {
        try {
          await sendEnvelope(pubkey, signed);
        } catch {
          sendFailed += 1;
        }
      }
      if (sendFailed > 0 && mode === 'create') {
        setError(
          `Family created and held, but could not reach ${sendFailed} of ${targets.length} member${targets.length === 1 ? '' : 's'} -- open the family card and tap "Send to awaiting members" once connected.`,
        );
        setBusy(false);
        return;
      }
      if (mode === 'add-member') {
        setDoneFamilyName(resultFamilyName);
        setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sign failed');
    } finally {
      setBusy(false);
    }
  }

  // -- no eligible family for add-member -------------------------------
  if (mode === 'add-member' && eligibleFamilies.length === 0) {
    return (
      <Sheet title="Add to a family" onClose={onClose}>
        <p className="mt-3 text-sm text-muted">
          No family is available to add {addMemberTarget?.name || 'this person'}{' '}
          to. You can only add people to a family you founded and are the only
          signer of yet -- once someone has ratified, the roster is locked.
          Start a family from your Identity tab, or they may already be in
          your families.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium"
        >
          Close
        </button>
      </Sheet>
    );
  }

  if (doneFamilyName) {
    return (
      <Sheet title="Add to a family" onClose={onClose}>
        <p className="mt-3 text-sm">
          Added <span className="font-medium">{addMemberTarget?.name || 'them'}</span>{' '}
          to <span className="font-medium">{doneFamilyName}</span>. They'll get a
          ratification request, and the family card on your Identity tab shows
          them as awaiting their signature.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
        >
          Done
        </button>
      </Sheet>
    );
  }

  const title =
    mode === 'edit' ? 'Edit family' : mode === 'add-member' ? 'Add to a family' : 'Start a family';

  return (
    <Sheet title={title} onClose={onClose}>
      {step.kind === 'pick-family' && (
        <PickFamilyStep
          addMemberTargetName={addMemberTarget?.name}
          eligibleFamilies={eligibleFamilies}
          onPick={(id) => {
            setTargetFamilyId(id);
            setStep(
              addMemberTarget
                ? { kind: 'member-details', contact: addMemberTarget }
                : { kind: 'roster' },
            );
          }}
        />
      )}

      {step.kind === 'name' && mode !== 'add-member' && (
        <NameStep
          mode={mode}
          familyName={familyName}
          setFamilyName={setFamilyName}
          myRole={myRole}
          setMyRole={setMyRole}
          myAsOf={myAsOf}
          setMyAsOf={setMyAsOf}
          myPubkey={wallet.identity}
          identity={identity}
          onContinue={() => setStep({ kind: 'roster' })}
          onClose={onClose}
        />
      )}

      {step.kind === 'roster' && (
        <RosterStep
          mode={mode}
          familyName={familyName}
          myPubkey={wallet.identity}
          identity={identity}
          myRole={myRole}
          lockedMembers={lockedMembers}
          members={members}
          busy={busy}
          canGoBackToName={mode === 'create'}
          onEditMember={(idx) => {
            const m = members[idx];
            if (!m) return;
            setStep({
              kind: 'member-details',
              contact: { pubkey: m.pubkey, name: m.name },
              editIndex: idx,
            });
          }}
          onRemoveMember={removeMember}
          onAddMember={() => setStep({ kind: 'pick-contact' })}
          onSign={() => void signAndSend()}
          onBack={mode === 'create' ? () => setStep({ kind: 'name' }) : onClose}
          targetFamilyName={targetFamilyView?.familyName}
        />
      )}

      {step.kind === 'pick-contact' && (
        <PickContactStep
          contacts={contacts}
          filteredContacts={filteredContacts}
          contactFilter={contactFilter}
          setContactFilter={setContactFilter}
          onPick={(c) => setStep({ kind: 'member-details', contact: c })}
          onBack={() => setStep({ kind: 'roster' })}
        />
      )}

      {step.kind === 'member-details' && (
        <MemberDetailsStep
          contact={step.contact}
          isEdit={step.editIndex !== undefined}
          initial={step.editIndex !== undefined ? members[step.editIndex] : undefined}
          onConfirm={(role, asOf) => confirmMember(step.contact, role, asOf, step.editIndex)}
          onBack={() =>
            setStep(
              step.editIndex !== undefined
                ? { kind: 'roster' }
                : mode === 'add-member' && addMemberTarget
                  ? { kind: 'roster' }
                  : { kind: 'pick-contact' },
            )
          }
        />
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
