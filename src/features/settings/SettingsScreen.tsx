import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { supabase } from '../../shared/lib/supabase.ts';
import { findOwnOrgDeclaration } from '../connections/createOrganization.ts';
import { CategoryGroup } from './CategoryGroup.tsx';
import { CloudBackupSection } from './CloudBackupSection.tsx';
import { RecoveryCohortSection } from './RecoveryCohortSection.tsx';
import { LocalBackupSection } from './LocalBackupSection.tsx';
import { AutoLockSection } from './AutoLockSection.tsx';
import { ReachabilitySection } from './ReachabilitySection.tsx';
import { AppearanceSection } from './AppearanceSection.tsx';
import { QuickShareSection } from './QuickShareSection.tsx';
import { PublicKeySection } from './PublicKeySection.tsx';
import { NostrActivitySection } from './NostrActivitySection.tsx';
import { OrgDeclarationSection } from './OrgDeclarationSection.tsx';
import { KnownLimitationsSection } from './KnownLimitationsSection.tsx';
import { CirclePhraseSection } from '../circle-phrase/CirclePhraseSection.tsx';
import { RotateKeySection } from '../wallet-core/RotateKeySection.tsx';
import { AdoptExistingKeySection } from '../wallet-core/AdoptExistingKeySection.tsx';

// SettingsScreen — pure composition. The seventeen loose sections that used to
// stack flat here are now grouped into collapsible categories (CategoryGroup),
// so the screen opens as a short list. Backup & recovery is the one group open
// by default because it's the one everyone should see. Each control lives in
// its own extracted section component; this file only arranges them.
export function SettingsScreen() {
  const {
    wallet,
    ownerId,
    holdings,
    prefs,
    identity,
    resolvedTheme,
    anchorWorker,
    updatePrefs,
    save,
    refresh,
  } = useWallet();
  const navigate = useNavigate();

  const existingOrgDeclaration = findOwnOrgDeclaration(holdings, wallet.identity);

  async function signOut() {
    await supabase().auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="w-12" aria-hidden />
      </header>

      <section className="mt-6 rounded-2xl bg-accent/[0.06] border border-accent/30 p-5">
        <div className="font-medium">Sovereignty</div>
        <p className="mt-1 text-sm text-muted">
          Every lever below moves the wallet toward sovereign — turn off cloud
          backup to keep your encrypted wallet only on this device, point
          "stay reachable" at your own servers, set up trusted helpers, and
          write down your recovery key.
        </p>
        <Link
          to="/about"
          className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
        >
          Read the full sovereignty picture in the Guide →
        </Link>
      </section>

      <CategoryGroup title="More screens" subtitle="Jump to the tabs kept off the main bar">
        <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
          <div className="flex flex-col gap-2">
            <Link
              to="/?tab=captured"
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Captured
            </Link>
            <Link
              to="/?tab=family"
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Family
            </Link>
            <Link
              to="/?tab=lattice"
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Keychain
            </Link>
            <Link
              to="/arena"
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Beat the HODL (prototype)
            </Link>
          </div>
        </section>
      </CategoryGroup>

      <CategoryGroup
        title="Backup & recovery"
        subtitle="Cloud sync, trusted helpers, and your ways back in"
        defaultOpen
      >
        <CloudBackupSection prefs={prefs} updatePrefs={updatePrefs} save={save} />
        <RecoveryCohortSection holdings={holdings} walletIdentity={wallet.identity} />
        <LocalBackupSection
          wallet={wallet}
          ownerId={ownerId}
          prefs={prefs}
          updatePrefs={updatePrefs}
        />
      </CategoryGroup>

      <CategoryGroup title="Security & access" subtitle="Auto-lock and sign out">
        <AutoLockSection prefs={prefs} updatePrefs={updatePrefs} />
        <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
          <div className="font-medium">Session</div>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            Sign out
          </button>
        </section>
      </CategoryGroup>

      <CategoryGroup title="Network" subtitle="Stay reachable, relays, and Nostr activity">
        <ReachabilitySection prefs={prefs} updatePrefs={updatePrefs} />
        <NostrActivitySection />
      </CategoryGroup>

      <CategoryGroup title="Appearance" subtitle="Theme and quick share">
        <AppearanceSection prefs={prefs} updatePrefs={updatePrefs} />
        {resolvedTheme === 'fresh' && (
          <QuickShareSection identity={identity} holdings={holdings} />
        )}
      </CategoryGroup>

      <CategoryGroup
        title="Advanced"
        subtitle="Public key, circle phrase, org mode, and key management"
      >
        <PublicKeySection publicKey={wallet.publicKey} />
        <CirclePhraseSection />
        <OrgDeclarationSection
          wallet={wallet}
          ownerId={ownerId}
          anchorWorker={anchorWorker}
          existingOrgDeclaration={existingOrgDeclaration}
          holdings={holdings}
          identity={identity}
          save={save}
          refresh={refresh}
        />
        <RotateKeySection wallet={wallet} save={save} refresh={refresh} />
        <AdoptExistingKeySection wallet={wallet} />
      </CategoryGroup>

      <CategoryGroup title="About & limits" subtitle="What the wallet does not do yet">
        <KnownLimitationsSection />
      </CategoryGroup>
    </div>
  );
}
