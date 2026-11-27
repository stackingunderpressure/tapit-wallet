import type { Attestation } from 'tapit-attest';
import { readFamilyUnit } from './familyUnit.ts';

/**
 * Who a member's freshly signed family envelope goes to.
 *
 * Founder (founder_id), every distinct signer key on the envelope, and
 * every named member -- minus this wallet's own key history so it never
 * sends to itself. Lowercased and de-duplicated.
 *
 * Why signers as well as founder_id: a founder who rotated decrypts on
 * their active key, which is the key on their signature, not the genesis
 * founder_id (operator field test 2026-05-31: a rotated founder never saw
 * a daughter's send-back). Why every named member: a sibling who has not
 * signed yet gets the copy with this signature on it and is prompted to
 * ratify it; one who already signed absorbs it (envelopeRoute case 3).
 * For a family amendment this is how a grandchild's phone learns that the
 * family has agreed.
 */
export function familyFanOutTargets(
  signed: Attestation,
  myKeyHistory: readonly string[],
): string[] {
  const mine = new Set(myKeyHistory.map((k) => k.trim().toLowerCase()));
  const view = readFamilyUnit(signed);
  const targets = new Set<string>();
  const add = (k: string) => {
    const key = k.trim().toLowerCase();
    if (key && !mine.has(key)) targets.add(key);
  };
  add(view.founderId);
  for (const s of signed.signatures) add(s.signer);
  for (const m of view.members) add(m.pubkey);
  return [...targets];
}
