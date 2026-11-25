import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { findVaultTrail } from './vaultTrail.ts';
import {
  acceptCircleNotice, clearHeld, fetchHold, heldVaults, makeNotice, markHeld, postNotice, subscribeVaultDuress,
  type HeldRecord, type HoldStatus,
} from './vaultDuress.ts';

// "A duress phrase was used for this vault" -- shown on every other
// checker's phone the moment one of them hears it (DynastyTrust
// docs/wellness-group-build-note.md, slice 2; operator: "Yes, notify
// them"). Believed only from someone on the same wellness path, per this
// wallet's own signed membership. Lifting needs the owner AND the circle's
// quorum; each checker confirms here.
export function VaultDuressBanner() {
  const ctx = useContext(WalletContext);
  const wallet = ctx?.wallet ?? null;
  const transport = ctx?.transport ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const holdings = ctx?.holdings ?? [];
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const [held, setHeld] = useState<Record<string, HeldRecord>>({});
  const [status, setStatus] = useState<Record<string, HoldStatus | string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet || !ownerId) return;
    let live = true;
    void heldVaults(ownerId).then((h) => { if (live) setHeld(h); });
    if (!transport) return () => { live = false; };
    const sub = subscribeVaultDuress(transport, wallet, (n) => {
      const trail = acceptCircleNotice(n.notice, (d) => findVaultTrail(holdingsRef.current, d, wallet.keyHistory));
      if (!trail) return;
      const rec = { vaultName: n.vaultName || 'A vault', at: n.notice.signed_at, by: n.notice.pubkey };
      void markHeld(ownerId, n.notice.descriptor, rec).then(() => { if (live) setHeld((h) => ({ ...h, [n.notice.descriptor]: rec })); });
    });
    return () => { live = false; sub.close(); };
  }, [wallet, transport, ownerId]);

  if (!wallet || !ownerId) return null;
  const entries = Object.entries(held);
  if (!entries.length) return null;

  async function check(descriptor: string) {
    setBusy(descriptor);
    try {
      const s = await fetchHold(descriptor);
      if (!s.held) {
        await clearHeld(ownerId!, descriptor);
        setHeld((h) => { const n = { ...h }; delete n[descriptor]; return n; });
      } else setStatus((x) => ({ ...x, [descriptor]: s }));
    } catch (e) {
      setStatus((x) => ({ ...x, [descriptor]: e instanceof Error ? e.message : 'Could not check' }));
    } finally {
      setBusy(null);
    }
  }

  async function confirmSafe(descriptor: string) {
    const trail = findVaultTrail(holdings, descriptor, wallet!.keyHistory);
    if (!trail) return;
    if (!window.confirm('Only confirm if you have spoken with them yourself, on a number you know is really theirs, and they are safe. Confirm lifting the hold?')) return;
    setBusy(descriptor);
    try {
      const s = await postNotice(makeNotice(wallet!, trail, 'clear'));
      if (!s.held) {
        await clearHeld(ownerId!, descriptor);
        setHeld((h) => { const n = { ...h }; delete n[descriptor]; return n; });
      } else setStatus((x) => ({ ...x, [descriptor]: s }));
    } catch (e) {
      setStatus((x) => ({ ...x, [descriptor]: e instanceof Error ? e.message : 'Failed' }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {entries.map(([descriptor, rec]) => {
        const s = status[descriptor];
        return (
          <div key={descriptor} className="rounded-md border-2 border-red-400 bg-red-50 p-4 text-red-900">
            <p className="text-sm font-bold">A duress phrase was used for "{rec.vaultName}".</p>
            <p className="mt-1 text-xs">
              Do not sign anything for this vault. Call the others in the circle on numbers you know are really
              theirs. This wallet will refuse every request for it until the owner and the circle clear it.
            </p>
            {typeof s === 'string' && <p className="mt-2 text-xs">{s}</p>}
            {s && typeof s !== 'string' && (
              <p className="mt-2 text-xs">
                {s.clears} of {s.needed} in the circle have confirmed it is safe{s.owner_cleared ? '; the owner has asked to lift it.' : '; the owner has not asked yet.'}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy === descriptor} onClick={() => void check(descriptor)} className="min-h-[44px] rounded-md border border-red-300 px-3 text-sm">
                Check status
              </button>
              <button type="button" disabled={busy === descriptor} onClick={() => void confirmSafe(descriptor)} className="min-h-[44px] rounded-md border border-red-300 px-3 text-sm">
                They are safe -- confirm
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
