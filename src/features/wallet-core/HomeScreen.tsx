import { Link } from 'react-router-dom';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';

// Show "stale" if a cloud-backed snapshot is more than this old.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function backupBanner(prefs: {
  cloudSync: boolean;
  lastRemoteSync: string | null;
}): { tone: 'ok' | 'warn'; text: string } | null {
  if (!prefs.cloudSync) {
    return { tone: 'warn', text: 'Cloud backup is off. Your wallet lives only on this device.' };
  }
  if (!prefs.lastRemoteSync) {
    return { tone: 'warn', text: 'Cloud backup pending — first sync has not completed yet.' };
  }
  const age = Date.now() - new Date(prefs.lastRemoteSync).getTime();
  if (age > STALE_AFTER_MS) {
    return { tone: 'warn', text: 'Cloud backup is more than a day old.' };
  }
  return null;
}

export function HomeScreen() {
  const { wallet, holdings, identity, prefs } = useWallet();
  const banner = backupBanner(prefs);

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-lg font-semibold">Tapit Wallet</h1>
        <Link
          to="/settings"
          className="text-sm text-muted hover:text-ink"
          aria-label="Settings"
        >
          Settings
        </Link>
      </header>

      {banner && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            banner.tone === 'warn'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
          }`}
          role="status"
        >
          {banner.text}
        </div>
      )}

      <section className="mt-4">
        <IdentityCard publicKey={wallet.publicKey} />
      </section>

      {identity && (
        <section className="mt-3">
          <AttestationCard attestation={identity} />
        </section>
      )}

      {holdings.length > 1 && (
        <section className="mt-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Held attestations
          </div>
          {holdings
            .filter((a) => a !== identity)
            .map((a, i) => (
              <AttestationCard key={i} attestation={a} />
            ))}
        </section>
      )}

      <p className="mt-6 text-xs text-muted">
        Your keypair lives on this device, encrypted. The host stores only
        ciphertext.
      </p>
    </div>
  );
}
