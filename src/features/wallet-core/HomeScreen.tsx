import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { AttestationCard } from './AttestationCard.tsx';
import { JournalComposer } from '../journal/JournalComposer.tsx';
import { JournalTabs } from '../journal/JournalTabs.tsx';

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
  const [composerOpen, setComposerOpen] = useState(false);
  const banner = backupBanner(prefs);

  const journalEntries = useMemo(
    () =>
      holdings
        .filter((a) => a.kind === 'journal')
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
        ),
    [holdings],
  );

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-24">
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

      <section className="mt-4 space-y-3">
        <IdentityCard publicKey={wallet.publicKey} />
        {identity && <AttestationCard attestation={identity} />}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Your diary</h2>
        <div className="mt-2">
          <JournalTabs entries={journalEntries} />
        </div>
      </section>

      {composerOpen ? (
        <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
          <h2 className="text-base font-semibold">New entry</h2>
          <div className="mt-3">
            <JournalComposer
              onCreated={() => setComposerOpen(false)}
              onCancel={() => setComposerOpen(false)}
            />
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink text-paper px-5 py-3 font-medium shadow-lg"
        >
          + New entry
        </button>
      )}
    </div>
  );
}
