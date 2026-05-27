import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import {
  familySignatureProgress,
  readFamilyUnit,
} from '../connections/familyUnit.ts';
import { IdentityChip } from '../connections/IdentityChip.tsx';
import { useWallet } from './useWallet.ts';
import { summarizePublish } from '../transport/publishStatus.ts';

// Extracted from HomeScreen.tsx in the StartFamilyModal cut to keep
// HomeScreen under the 800-line hard limit. Renders the Identity-tab
// Family section — a card per family unit the operator is a member
// of, with each member rendered as an IdentityChip plus their role
// and optional as_of date, and a "N of M signed" chip that reflects
// how many named members have ratified the family-unit envelope so
// far. Founder-side "Send to members" button ships the envelope via
// Mycelium to every named member that has not signed yet; the
// existing inbox silent-absorb path merges each returning cosigned
// copy back into holdings, so the signature count climbs as members
// ratify. Members-side ratify UI is the next-up cut.

interface Props {
  familyUnits: readonly Attestation[];
  /** Pubkey → display-name lookup so member chips can resolve to
   *  friendly names when the operator has a handshake with them. */
  namesByPubkey: ReadonlyMap<string, string>;
  onStartFamily: () => void;
}

interface SendStatus {
  tone: 'pending' | 'ok' | 'partial' | 'fail';
  text: string;
}

export function FamilyIdentitySections({
  familyUnits,
  namesByPubkey,
  onStartFamily,
}: Props) {
  const { wallet, sendEnvelope } = useWallet();
  const myIdentity = wallet.identity.toLowerCase();
  const [statusByIndex, setStatusByIndex] = useState<Record<number, SendStatus>>({});

  async function sendToUnsignedMembers(idx: number, att: Attestation) {
    const view = readFamilyUnit(att);
    const signers = new Set(att.signatures.map((s) => s.signer.toLowerCase()));
    const targets = view.members.filter((m) => {
      const lower = m.pubkey.toLowerCase();
      return lower !== myIdentity && !signers.has(lower);
    });
    if (targets.length === 0) return;
    setStatusByIndex((prev) => ({
      ...prev,
      [idx]: { tone: 'pending', text: `Sending to ${targets.length}…` },
    }));
    let sent = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const result = await sendEnvelope(t.pubkey, att);
        const s = summarizePublish(result);
        if (s.tone === 'fail') failed += 1;
        else sent += 1;
      } catch {
        failed += 1;
      }
    }
    let tone: SendStatus['tone'] = 'ok';
    if (failed > 0 && sent === 0) tone = 'fail';
    else if (failed > 0) tone = 'partial';
    const text =
      failed === 0
        ? `Sent to ${sent} member${sent === 1 ? '' : 's'} · they will sign and the count will climb.`
        : sent === 0
          ? `Could not send to any of the ${failed} member${failed === 1 ? '' : 's'}. Is Mycelium on?`
          : `Sent to ${sent}, ${failed} failed. Try again.`;
    setStatusByIndex((prev) => ({ ...prev, [idx]: { tone, text } }));
  }

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
            const signers = new Set(
              a.signatures.map((s) => s.signer.toLowerCase()),
            );
            const isFounder = view.founderId.toLowerCase() === myIdentity;
            const unsignedNonFounder = view.members.filter((m) => {
              const lower = m.pubkey.toLowerCase();
              return lower !== myIdentity && !signers.has(lower);
            });
            const status = statusByIndex[i];
            const sendBusy = status?.tone === 'pending';
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
                        {signers.has(m.pubkey.toLowerCase()) && ' · signed'}
                      </div>
                    </li>
                  ))}
                </ul>
                {isFounder && unsignedNonFounder.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void sendToUnsignedMembers(i, a)}
                      disabled={sendBusy}
                      className="w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-60"
                    >
                      {sendBusy
                        ? 'Sending…'
                        : `Send to ${unsignedNonFounder.length} unsigned member${unsignedNonFounder.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                )}
                {status && status.tone !== 'pending' && (
                  <p
                    className={`mt-2 text-xs ${
                      status.tone === 'ok'
                        ? 'text-emerald-700'
                        : status.tone === 'partial'
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {status.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
