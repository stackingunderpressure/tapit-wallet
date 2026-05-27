import type { Attestation } from 'tapit-attest';
import {
  familySignatureProgress,
  readFamilyUnit,
} from '../connections/familyUnit.ts';
import { IdentityChip } from '../connections/IdentityChip.tsx';

// Extracted from HomeScreen.tsx in the StartFamilyModal cut to keep
// HomeScreen under the 800-line hard limit. Renders the Identity-tab
// Family section — a card per family unit the operator is a member
// of, with each member rendered as an IdentityChip plus their role
// and optional as_of date, and a "N of M signed" chip that reflects
// how many named members have ratified the family-unit envelope so
// far. Render-only — the parent owns the "+ Start family" button and
// the modal launch state.

interface Props {
  familyUnits: readonly Attestation[];
  /** Pubkey → display-name lookup so member chips can resolve to
   *  friendly names when the operator has a handshake with them. */
  namesByPubkey: ReadonlyMap<string, string>;
  onStartFamily: () => void;
}

export function FamilyIdentitySections({
  familyUnits,
  namesByPubkey,
  onStartFamily,
}: Props) {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          Family ({familyUnits.length})
        </h2>
        <button
          type="button"
          onClick={onStartFamily}
          className="text-xs font-medium text-accent hover:underline"
        >
          + Start family
        </button>
      </div>
      {familyUnits.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No families yet. Tap Start family to declare your family
          unit — name it, pick the people in it from your connections,
          and set their roles plus optional backdated dates (a kid's
          actual birthday, a spouse's marriage date) even though you
          sign today.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {familyUnits.map((a, i) => {
            const view = readFamilyUnit(a);
            const progress = familySignatureProgress(a);
            return (
              <li
                key={i}
                className="rounded-2xl bg-white border border-ink/10 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">
                    {view.familyName || 'Unnamed family'}
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {progress.signed} of {progress.total} signed
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {view.members.map((m) => (
                    <li key={m.pubkey}>
                      <IdentityChip
                        pubkey={m.pubkey}
                        name={m.name}
                        namesByPubkey={namesByPubkey}
                        size="sm"
                        hideShortKey
                      />
                      <div className="ml-10 -mt-1 text-[10px] uppercase tracking-wide text-muted">
                        {m.role}
                        {m.as_of ? ` · since ${m.as_of}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
