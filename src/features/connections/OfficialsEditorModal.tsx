import { useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  publishOfficialsRoster,
  readOfficials,
  findLatestOfficialsRoster,
  type Official,
} from './createOrganization.ts';

interface Props {
  onClose: () => void;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
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

  function addOfficial() {
    if (!addPubkeyValid || addPubkeyDup) return;
    setOfficials((prev) => [
      ...prev,
      { pubkey: addPubkeyNormalized, name: addName.trim() },
    ]);
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
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {o.name || '(no name)'}
                    </div>
                    <div className="text-xs text-muted font-mono">
                      {shortKey(o.pubkey)}
                    </div>
                  </div>
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
