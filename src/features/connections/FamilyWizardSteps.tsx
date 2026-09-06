import { useState } from 'react';
import { envelopeId, type Attestation } from 'tapit-attest';
import { FAMILY_ROLES, readFamilyUnit, type FamilyRole } from './familyUnit.ts';
import { displayNameOf } from './createHandshake.ts';
import { IdentityChip } from './IdentityChip.tsx';

// Step renderers for FamilyWizard.tsx, split out purely to keep both
// files under the 800-line hard limit / 400-line soft warn -- these
// are presentational, each step's own local input state plus a couple
// of callbacks into the orchestrator. No wallet/network calls live
// here; FamilyWizard.tsx owns all of that.

export interface Contact {
  pubkey: string;
  name: string;
}

export interface DraftMember {
  pubkey: string;
  name: string;
  role: FamilyRole;
  asOf: string;
}

export const ROLE_LABELS: Record<FamilyRole, string> = {
  dad: 'Dad',
  mom: 'Mom',
  parent: 'Parent',
  spouse: 'Spouse',
  child: 'Child',
  sibling: 'Sibling',
};

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PickFamilyStep({
  addMemberTargetName,
  eligibleFamilies,
  onPick,
}: {
  addMemberTargetName: string | undefined;
  eligibleFamilies: readonly Attestation[];
  onPick: (id: string) => void;
}) {
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Add <span className="font-medium">{addMemberTargetName || 'this person'}</span>{' '}
        to which family?
      </p>
      <ul className="mt-3 space-y-1">
        {eligibleFamilies.map((a) => {
          const id = envelopeId(a);
          const v = readFamilyUnit(a);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onPick(id)}
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-left text-sm hover:bg-ink/5"
              >
                {v.familyName || 'Unnamed family'}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function NameStep({
  mode,
  familyName,
  setFamilyName,
  myRole,
  setMyRole,
  myAsOf,
  setMyAsOf,
  myPubkey,
  identity,
  onContinue,
  onClose,
}: {
  mode: 'create' | 'edit';
  familyName: string;
  setFamilyName: (v: string) => void;
  myRole: FamilyRole;
  setMyRole: (v: FamilyRole) => void;
  myAsOf: string;
  setMyAsOf: (v: string) => void;
  myPubkey: string;
  identity: Attestation | null;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        {mode === 'edit'
          ? "Fix the name or your own role/date. Next you'll add or edit the people in it."
          : "Name your family, then you'll add the people in it, one at a time, from your connections."}
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
          autoFocus
        />
      </label>
      <div className="mt-4 rounded-md border border-ink/10 bg-white p-3">
        <div className="text-xs font-medium">You</div>
        <div className="mt-2">
          <IdentityChip
            pubkey={myPubkey}
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
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={familyName.trim().length === 0}
          className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

export function RosterStep({
  mode,
  familyName,
  myPubkey,
  identity,
  myRole,
  lockedMembers,
  members,
  busy,
  canGoBackToName,
  onEditMember,
  onRemoveMember,
  onAddMember,
  onSign,
  onBack,
  targetFamilyName,
}: {
  mode: 'create' | 'edit' | 'add-member';
  familyName: string;
  myPubkey: string;
  identity: Attestation | null;
  myRole: FamilyRole;
  lockedMembers: readonly DraftMember[];
  members: readonly DraftMember[];
  busy: boolean;
  canGoBackToName: boolean;
  onEditMember: (idx: number) => void;
  onRemoveMember: (idx: number) => void;
  onAddMember: () => void;
  onSign: () => void;
  onBack: () => void;
  targetFamilyName?: string;
}) {
  const canSign = mode === 'add-member' ? members.length > 0 : familyName.trim().length > 0;
  return (
    <>
      {mode !== 'add-member' && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium">{familyName || 'Your family'}</span> so
          far. Add people one at a time, then sign once you're done.
        </p>
      )}
      {mode === 'add-member' && (
        <p className="mt-2 text-sm text-muted">
          Adding to <span className="font-medium">{targetFamilyName || 'your family'}</span>.
          Existing members are locked here -- only what you add this session
          is editable.
        </p>
      )}

      {mode !== 'add-member' && (
        <div className="mt-3 rounded-md border border-ink/10 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <IdentityChip
              pubkey={myPubkey}
              name={identity ? displayNameOf(identity) : 'You'}
              size="sm"
            />
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
              {ROLE_LABELS[myRole]}
            </span>
          </div>
        </div>
      )}

      {lockedMembers.length > 0 && (
        <ul className="mt-2 space-y-2">
          {lockedMembers.map((m) => (
            <li key={m.pubkey} className="rounded-md border border-ink/10 bg-ink/5 p-3 opacity-80">
              <div className="flex items-center justify-between gap-2">
                <IdentityChip pubkey={m.pubkey} name={m.name} size="sm" />
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                  {ROLE_LABELS[m.role]} · already in family
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {members.length > 0 && (
        <ul className="mt-2 space-y-2">
          {members.map((m, i) => (
            <li key={m.pubkey} className="rounded-md border border-ink/15 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <IdentityChip pubkey={m.pubkey} name={m.name} size="sm" />
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {ROLE_LABELS[m.role]}
                    {m.asOf ? ` · since ${m.asOf}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditMember(i)}
                    className="text-xs text-accent hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveMember(i)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {members.length === 0 && lockedMembers.length === 0 && (
        <p className="mt-3 text-xs text-muted">
          No one added yet. Tap "+ Add a member" to bring in someone from
          your connections.
        </p>
      )}

      <button
        type="button"
        onClick={onAddMember}
        className="mt-3 w-full rounded-md border border-dashed border-ink/25 bg-white py-2.5 text-sm font-medium text-accent hover:bg-accent/5"
      >
        + Add a member
      </button>

      <p className="mt-4 text-xs text-muted">
        {mode === 'add-member'
          ? 'Signing rebuilds the family envelope with the new member(s) added, sends the updated copy to everyone named, and asks the new member to ratify.'
          : mode === 'edit'
            ? 'Saving re-signs the corrected family-unit envelope, replaces the old one, and re-sends it to each named member. Ratification progress resets because the envelope is new.'
            : 'Signing creates a founder-signed family-unit envelope and sends it to each named member to ratify.'}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSign}
          disabled={busy || !canSign}
          className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
        >
          {busy
            ? 'Signing…'
            : mode === 'edit'
              ? 'Save changes'
              : mode === 'add-member'
                ? 'Sign and add'
                : 'Sign and create family'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm"
        >
          {canGoBackToName ? 'Back' : 'Cancel'}
        </button>
      </div>
    </>
  );
}

export function PickContactStep({
  contacts,
  filteredContacts,
  contactFilter,
  setContactFilter,
  onPick,
  onBack,
}: {
  contacts: readonly Contact[];
  filteredContacts: readonly Contact[];
  contactFilter: string;
  setContactFilter: (v: string) => void;
  onPick: (c: Contact) => void;
  onBack: () => void;
}) {
  return (
    <>
      <label className="mt-2 block">
        <span className="sr-only">Search connections</span>
        <input
          type="text"
          value={contactFilter}
          onChange={(e) => setContactFilter(e.target.value)}
          placeholder="Search your connections"
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          autoFocus
        />
      </label>
      {contacts.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          No handshake connections yet. Make a handshake with a family member
          first, then come back to add them.
        </p>
      ) : filteredContacts.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No matches.</p>
      ) : (
        <ul className="mt-2 space-y-1 max-h-[50vh] overflow-y-auto">
          {filteredContacts.map((c) => (
            <li key={c.pubkey}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full text-left rounded-md border border-ink/15 bg-white px-3 py-2 hover:bg-ink/5"
              >
                <IdentityChip pubkey={c.pubkey} name={c.name} size="md" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full rounded-md border border-ink/15 px-4 py-2 text-sm"
      >
        Back
      </button>
    </>
  );
}

export function MemberDetailsStep({
  contact,
  isEdit,
  initial,
  onConfirm,
  onBack,
}: {
  contact: Contact;
  isEdit: boolean;
  initial?: DraftMember;
  onConfirm: (role: FamilyRole, asOf: string) => void;
  onBack: () => void;
}) {
  const [role, setRole] = useState<FamilyRole>(initial?.role ?? 'child');
  const [asOf, setAsOf] = useState(initial?.asOf ?? '');

  return (
    <>
      <div className="mt-2 rounded-md border border-ink/10 bg-white p-3">
        <IdentityChip pubkey={contact.pubkey} name={contact.name} size="lg" />
      </div>
      <label className="mt-4 block text-xs">
        <span className="text-muted">Their role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as FamilyRole)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
          autoFocus
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
          As-of date{' '}
          <span className="text-muted/70">
            (optional -- their actual birthday, marriage date, etc., even
            though you're signing today)
          </span>
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
          onClick={() => onConfirm(role, asOf)}
          className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
        >
          {isEdit ? 'Save' : `Add ${contact.name || 'them'} to family`}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm"
        >
          Back
        </button>
      </div>
    </>
  );
}
