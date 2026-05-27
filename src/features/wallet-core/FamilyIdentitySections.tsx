import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import {
  familySignatureProgress,
  memberHasSigned,
  readFamilyUnit,
} from '../connections/familyUnit.ts';
import { IdentityChip } from '../connections/IdentityChip.tsx';
import { useWallet } from './useWallet.ts';
import { summarizePublish } from '../transport/publishStatus.ts';

// Extracted from HomeScreen.tsx in the StartFamilyModal cut to keep
// HomeScreen under the 800-line hard limit. Renders the Identity-tab
// Family section — a card per family unit the operator is a member
// of, with each member rendered as an IdentityChip plus their role,
// optional as_of date, and a persistent per-member signature state
// label (signed / awaiting signature). The "N of M signed" chip
// reflects the same state in aggregate. Founder-side "Send to
// members" button ships the envelope via Mycelium to every named
// member that has not signed yet; the inbox silent-absorb path
// merges each returning cosigned copy back into holdings as members
// ratify. Members-side ratify UI is the next-up cut.
//
// Bridge note: rotated wallets sign with their active key, which
// differs from the genesis identity pubkey the family-unit member
// list stores. familyUnit.ts's memberHasSigned + familySignatureProgress
// both accept an optional keyAliases map; this component passes a
// {wallet.identity → wallet.keyHistory} entry so the operator's own
// signature is detected regardless of whether they have rotated.

interface Props {
  familyUnits: readonly Attestation[];
  /** Pubkey → display-name lookup so member chips can resolve to
   *  friendly names when the operator has a handshake with them. */
  namesByPubkey: ReadonlyMap<string, string>;
  onStartFamily: () => void;
}

// Failure-only status. Success and pending are surfaced by the
// derived-from-envelope per-member labels and the N-of-M chip,
// which persist across navigation because they're derived from
// holdings. The earlier transient success message disappeared on
// tab-switch and read as a lie; only failures surface here now,
// because a failure means the operator needs to act again.
interface SendError {
  text: string;
}

export function FamilyIdentitySections({
  familyUnits,
  namesByPubkey,
  onStartFamily,
}: Props) {
  const { wallet, sendEnvelope } = useWallet();
  const myIdentity = wallet.identity.toLowerCase();
  // keyAliases[wallet.identity] = every key in the operator's history.
  // This is the bridge that fixes the "founder shows unsigned after
  // rotation" bug — the signature's signer is the active key, which
  // for a rotated wallet differs from the genesis identity pubkey
  // stored in the family-unit member list.
  const keyAliases = useMemo<ReadonlyMap<string, readonly string[]>>(() => {
    const m = new Map<string, readonly string[]>();
    m.set(myIdentity, wallet.keyHistory.map((k) => k.toLowerCase()));
    return m;
  }, [myIdentity, wallet.keyHistory]);
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [errorByIndex, setErrorByIndex] = useState<Record<number, SendError>>({});

  async function sendToUnsignedMembers(
    idx: number,
    att: Attestation,
    targets: readonly { pubkey: string }[],
  ) {
    if (targets.length === 0) return;
    setSending((prev) => ({ ...prev, [idx]: true }));
    setErrorByIndex((prev) => {
      const { [idx]: _gone, ...rest } = prev;
      return rest;
    });
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
    setSending((prev) => {
      const { [idx]: _gone, ...rest } = prev;
      return rest;
    });
    if (failed > 0) {
      const text =
        sent === 0
          ? `Could not send to any of the ${failed} member${failed === 1 ? '' : 's'}. Is Mycelium on?`
          : `Sent to ${sent}, ${failed} failed. Try again.`;
      setErrorByIndex((prev) => ({ ...prev, [idx]: { text } }));
    }
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
            const progress = familySignatureProgress(a, keyAliases);
            const signers = new Set(
              a.signatures.map((s) => s.signer.toLowerCase()),
            );
            const isFounder = view.founderId.toLowerCase() === myIdentity;
            const unsignedNonFounder = view.members.filter((m) => {
              const lower = m.pubkey.toLowerCase();
              if (lower === myIdentity) return false;
              return !memberHasSigned(m.pubkey, signers, keyAliases);
            });
            const sendBusy = !!sending[i];
            const error = errorByIndex[i];
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
                  {view.members.map((m) => {
                    const signed = memberHasSigned(m.pubkey, signers, keyAliases);
                    return (
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
                          {signed ? (
                            <span className="text-emerald-700"> · signed</span>
                          ) : (
                            <span className="text-amber-700"> · awaiting signature</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {isFounder && unsignedNonFounder.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        void sendToUnsignedMembers(i, a, unsignedNonFounder)
                      }
                      disabled={sendBusy}
                      className="w-full rounded-md border border-ink/15 bg-white py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-60"
                    >
                      {sendBusy
                        ? 'Sending…'
                        : `Send to ${unsignedNonFounder.length} awaiting member${unsignedNonFounder.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                )}
                {error && (
                  <p className="mt-2 text-xs text-red-700" role="alert">
                    {error.text}
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
