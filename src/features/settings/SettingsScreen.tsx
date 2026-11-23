import { lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Loaded on demand so the Settings chunk stays under its bundle budget.
const PublicProfileSection = lazy(() =>
  import('./PublicProfileSection.tsx').then((m) => ({ default: m.PublicProfileSection })),
);
const FaceUnlockSection = lazy(() =>
  import('../face-unlock/FaceUnlockSection.tsx').then((m) => ({ default: m.FaceUnlockSection })),
);
import { useWallet } from '../wallet-core/useWallet.ts';
import { supabase } from '../../shared/lib/supabase.ts';
import { isSovereign } from '../../shared/lib/sovereign.ts';
import { findOwnOrgDeclaration } from '../connections/createOrganization.ts';
import { CategoryAccordion, CategoryGroup, SettingsItem } from './CategoryGroup.tsx';
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

      {/* One line instead of a card: the Guide carries the full picture. */}
      <p className="mt-4 text-sm text-muted">
        {isSovereign()
          ? 'Your wallet lives on this device and nowhere else.'
          : 'Your wallet is encrypted on this device before anything leaves it.'}{' '}
        <Link to="/about" className="font-medium text-accent hover:underline">
          How it works →
        </Link>
      </p>

      {/* Load-bearing first. Each category opens to short items; each item
          opens to its controls, so the page stays a short list. */}
      <CategoryAccordion>
      <CategoryGroup title="Backup & recovery" subtitle="Your ways back in if you lose this device or forget the passphrase">
        {!isSovereign() && <CloudBackupSection prefs={prefs} updatePrefs={updatePrefs} save={save} />}
        <SettingsItem title="Backup file" description="Download one file with everything, and test that it opens">
          <LocalBackupSection wallet={wallet} ownerId={ownerId} prefs={prefs} updatePrefs={updatePrefs} part="file" />
        </SettingsItem>
        <SettingsItem title="Recovery key" description="A key you write down that opens the wallet without the passphrase">
          <LocalBackupSection wallet={wallet} ownerId={ownerId} prefs={prefs} updatePrefs={updatePrefs} part="key" />
        </SettingsItem>
        <SettingsItem title="Trusted helpers" description="People who together can help you back in">
          <RecoveryCohortSection holdings={holdings} walletIdentity={wallet.identity} />
        </SettingsItem>
      </CategoryGroup>

      <CategoryGroup title="Security" subtitle="Face ID and when the wallet locks itself">
        <SettingsItem title="Face ID" description="Unlock and confirm every signature with your face">
          <Suspense fallback={null}>
            <FaceUnlockSection />
          </Suspense>
        </SettingsItem>
        <SettingsItem title="Auto-lock" description="How long before the wallet locks when you set it down">
          <AutoLockSection prefs={prefs} updatePrefs={updatePrefs} />
        </SettingsItem>
        {!isSovereign() && (
          <SettingsItem title="Sign out" description="Leave this account on this device">
            <button type="button" onClick={signOut} className="m-3 text-sm text-red-600 hover:underline">
              Sign out
            </button>
          </SettingsItem>
        )}
      </CategoryGroup>

      <CategoryGroup title="Connections & signing" subtitle="How people and apps like DynastyTrust reach you">
        <SettingsItem title="Stay reachable" description="Receive messages and signing requests when you're apart, and which relays carry them">
          <ReachabilitySection prefs={prefs} updatePrefs={updatePrefs} />
        </SettingsItem>
        <SettingsItem title="Public profile" description={prefs.publicProfile ? 'On: your name is visible to anyone on Nostr' : 'Off: other Nostr apps see only your key'}>
          <Suspense fallback={null}>
            <PublicProfileSection />
          </Suspense>
        </SettingsItem>
        <SettingsItem title="Your public key" description="Give an app your key so it can ask you to sign">
          <PublicKeySection publicKey={wallet.publicKey} />
        </SettingsItem>
        <SettingsItem title="Circle safety phrases" description="Which vaults have a phrase set up for checking a callout">
          <CirclePhraseSection />
        </SettingsItem>
        <SettingsItem title="Activity log" description="What has arrived, for checking that delivery works">
          <NostrActivitySection />
        </SettingsItem>
      </CategoryGroup>

      <CategoryGroup title="Look & sharing" subtitle="Home screen extras and share cards">
        <SettingsItem title="Home extras" description="Memories and streaks on the home screen">
          <AppearanceSection prefs={prefs} updatePrefs={updatePrefs} />
        </SettingsItem>
        {resolvedTheme === 'fresh' && (
          <SettingsItem title="Quick share" description="Ready-made cards that prove one thing about you">
            <QuickShareSection identity={identity} holdings={holdings} />
          </SettingsItem>
        )}
      </CategoryGroup>

      <CategoryGroup title="Organization" subtitle="Run a church, club or town from this wallet">
        <SettingsItem title="Organization mode" description="Declare an organization and issue memberships">
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
        </SettingsItem>
      </CategoryGroup>

      <CategoryGroup title="Key tools" subtitle="Rarely needed. Change the key this wallet signs with">
        <SettingsItem title="Rotate wallet key" description="Move to a new signing key; your identity stays the same">
          <RotateKeySection wallet={wallet} save={save} refresh={refresh} />
        </SettingsItem>
        <SettingsItem title="Use my existing Nostr key" description="Sign with the key from another Nostr app">
          <AdoptExistingKeySection wallet={wallet} />
        </SettingsItem>
      </CategoryGroup>

      <CategoryGroup title="Help" subtitle="Other screens, and what the wallet can't do yet">
        <SettingsItem title="Other screens" description="Captured, Family and Keychain, kept off the main bar">
          <div className="m-2 flex flex-col gap-2">
            <Link to="/?tab=captured" className="rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5">Captured</Link>
            <Link to="/?tab=family" className="rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5">Family</Link>
            <Link to="/?tab=lattice" className="rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5">Keychain</Link>
          </div>
        </SettingsItem>
        <SettingsItem title="Known limitations" description="Honest notes on what isn't built yet">
          <KnownLimitationsSection />
        </SettingsItem>
      </CategoryGroup>
      </CategoryAccordion>
    </div>
  );
}
