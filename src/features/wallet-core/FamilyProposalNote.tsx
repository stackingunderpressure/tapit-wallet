import type { Attestation } from 'tapit-attest';
import { readFamilyUnit } from '../connections/familyUnit.ts';
import { amendmentProgress, familyVersionInfo } from '../connections/familyAmendment.ts';

// The "someone is being let in" strip on a family card (family
// amendments, 2026-11-27). Shows who the pending version adds and how
// far it is from the agreement rule: more than half of the current
// family plus the newcomer's own signature. Split out of
// FamilyIdentitySections to keep that file under the size warning.

interface Props {
  proposal: Attestation;
  keyAliases: ReadonlyMap<string, readonly string[]>;
  /** Founder only: send the proposal to everyone who has not signed it. */
  onAsk?: () => void;
  asking?: boolean;
  /** True when this device holds only the proposal (no version in
   *  effect) -- e.g. the grandchild being added. */
  standalone?: boolean;
}

export function FamilyProposalNote({ proposal, keyAliases, onAsk, asking, standalone }: Props) {
  const info = familyVersionInfo(proposal);
  const p = amendmentProgress(proposal, keyAliases);
  const view = readFamilyUnit(proposal);
  const names = view.members
    .filter((m) => info.admits.includes(m.pubkey.toLowerCase()))
    .map((m) => m.name || 'someone');
  const stillNeeded = Math.max(0, p.priorNeeded - p.priorSigned);
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <p>
        {standalone ? 'Waiting on the family: ' : 'Proposed: '}
        letting <span className="font-semibold">{names.join(', ')}</span> in.
      </p>
      <p className="mt-1">
        {p.priorSigned} of {p.priorTotal} current members have signed; it needs{' '}
        {p.priorNeeded}
        {stillNeeded > 0 ? ` (${stillNeeded} more)` : ''}.
        {p.admitsAwaiting.length > 0
          ? ` ${names.length === 1 ? names[0] : 'The people being added'} still ${names.length === 1 ? 'has' : 'have'} to sign too.`
          : ''}
        {standalone ? '' : ' Until then the family below stays as it is.'}
      </p>
      {onAsk && (
        <button
          type="button"
          onClick={onAsk}
          disabled={asking}
          className="mt-2 w-full min-h-[44px] rounded-md border border-amber-400 bg-white py-2 text-sm font-medium disabled:opacity-60"
        >
          {asking ? 'Sending…' : 'Ask the family to sign'}
        </button>
      )}
    </div>
  );
}
