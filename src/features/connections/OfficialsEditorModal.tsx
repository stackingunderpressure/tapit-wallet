import { useMemo, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  publishOfficialsRoster,
  readOfficials,
  findLatestOfficialsRoster,
  type Official,
} from './officialsRoster.ts';
import { isHandshake, readHandshake } from './createHandshake.ts';
import { IdentityChip } from './IdentityChip.tsx';

interface Props {
  onClose: () => void;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

interface ContactOption {
  pubkey: string;
  name: string;
}

// 5b-org-ii — officials editor. Start from the current published
// roster (latest by issued_at), let the operator add or remove
// officials inline, save publishes a NEW roster envelope. The full
// history of rosters stays held + anchored; readers use the newest.
// Inline editing keeps the operator's mental model simple — they see
// what is in effect and what they are changing it to.
export function OfficialsEditorModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, anchorWorker, save, refresh } = useWallet();
  const currentRoster = findLatestOfficialsRoster(holdings, wallet.identity);
  const initial: Official[] = currentRoster ? readOfficials(currentRoster) : [];
  const [officials, setOfficials] = useState<Official[]>(initial);
  const [addPubkey, setAddPubkey] = useState('');
  const [addName, setAddName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPubkeyNormalized = addPubkey.trim().toLowerCase();
  const addPubkeyValid = HEX_64.test(addPubkeyNormalized);
  const addPubkeyDup = officials.some((o) => o.pubkey === addPubkeyNormalized);

  // Walk handshakes once to surface the operator's existing contacts as
  // one-tap picker rows above the paste input. The operator's complaint
  // was direct: making someone an officer should not require pasting a
  // 64-character hex string when the person is already in their
  // contacts. Tapping a contact row fills both the pubkey field and
  // the name field — the same effect as pasting hex and typing a name,
  // but in one tap and rendered as a friendly identicon + name row
  // instead of a wall of opaque hex.
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

  function addOfficial() {
    if (!addPubkeyValid || addPubkeyDup) return;
    setOfficials((prev) => [
      ...prev,
      { pubkey: addPubkeyNormalized, name: addName.trim() },
    ]);
    setAddPubkey('');
    setAddName('');
  }

  function addContact(contact: ContactOption) {
    const lower = contact.pubkey.toLowerCase();
    if (officials.some((o) => o.pubkey === lower)) return;
    setOfficials((prev) => [...prev, { pubkey: lower, name: contact.name }]);
    setAddPubkey('');
    setAddName('');
  }

  function removeOfficial(pubkey: string) {
    setOfficials((prev) => prev.filter((o) => o.pubkey !== pubkey));
  }

  async function publish() {
    setError(null);
    setBusy(true);
    try {
      await publishOfficialsRoster(wallet, ownerId, anchorWorker, officials);
      await save();
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'publish failed');
    } finally {
      setBusy(false);
    }
  }

  // Detect whether the draft differs from the current roster.
  const sortedDraft = [...officials]
    .map((o) => `${o.pubkey}|${o.name}`)
    .sort()
    .join('\n');
  const sortedCurrent = initial
    .map((o) => `${o.pubkey}|${o.name}`)
    .sort()
    .join('\n');
  const dirty = sortedDraft !== sortedCurrent;

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Officials</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Officials are the people whose signatures count as ratification
          of memberships the organization issues. Saving publishes a new
          signed roster — the latest one in effect; the older rosters
          stay in the history.
        </p>

        <div className="mt-4">
          <div className="text-sm font-medium">
            Current ({officials.length})
          </div>
          {officials.length === 0 ? (
            <p className="mt-1 text-xs text-muted">
              No officials yet. Add at least one to begin.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {officials.map((o) => (
                <li
                  key={o.pubkey}
                  className="flex items-center justify-between gap-2 rounded-md border border-ink/15 bg-white px-3 py-2"
                >
                  <IdentityChip
                    pubkey={o.pubkey}
                    name={o.name}
                    size="md"
                    className="min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeOfficial(o.pubkey)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-md border border-ink/15 bg-white p-3">
          <div className="text-xs font-medium">Add an official</div>
          {contacts.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted">
                From your connections
              </div>
              <ul className="mt-1.5 space-y-1">
                {contacts.map((c) => {
                  const already = officials.some((o) => o.pubkey === c.pubkey);
                  return (
                    <li key={c.pubkey}>
                      <button
                        type="button"
                        onClick={() => addContact(c)}
                        disabled={already}
                        className={`w-full text-left rounded-md border px-3 py-2 transition ${
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
              <div className="mt-3 text-[10px] uppercase tracking-wide text-muted">
                Or paste a public key
              </div>
            </div>
          )}
          <input
            type="text"
            value={addPubkey}
            onChange={(e) => setAddPubkey(e.target.value)}
            placeholder="64-character hex public key"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Display name (optional)"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          />
          {addPubkey.length > 0 && !addPubkeyValid && (
            <p className="mt-1 text-xs text-red-600">Needs 64 hex characters.</p>
          )}
          {addPubkeyValid && addPubkeyDup && (
            <p className="mt-1 text-xs text-amber-700">Already on the list.</p>
          )}
          <button
            type="button"
            onClick={addOfficial}
            disabled={!addPubkeyValid || addPubkeyDup}
            className="mt-2 w-full rounded-md border border-ink/15 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Add to list
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={busy || !dirty}
            className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
          >
            {busy ? 'Publishing…' : 'Publish new roster'}
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
