import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { supabase } from '../../shared/lib/supabase.ts';
import { downloadEncryptedBackup } from './localExport.ts';
import { KnownLimitationsSection } from './KnownLimitationsSection.tsx';
import { RotateKeySection } from '../wallet-core/RotateKeySection.tsx';
import { AdoptExistingKeySection } from '../wallet-core/AdoptExistingKeySection.tsx';
import { unwrapKData, type RecoverableEncryptedBlob } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';
import { DEFAULT_RELAYS } from '../transport/defaultRelays.ts';
import { lazy, Suspense } from 'react';
import { findLatestCohort, readCohort } from '../recovery/createCohort.ts';
const CohortEditorModal = lazy(() =>
  import('../recovery/CohortEditorModal.tsx').then((m) => ({
    default: m.CohortEditorModal,
  })),
);
import { findOwnOrgDeclaration } from '../connections/createOrganization.ts';
import { OrgDeclarationSection } from './OrgDeclarationSection.tsx';
import { AppearanceSection } from './AppearanceSection.tsx';
import { QuickShareSection } from './QuickShareSection.tsx';

function parseRelayLines(text: string): { ok: string[]; bad: string[] } {
  const ok: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const url = raw.trim();
    if (url.length === 0) continue;
    if (/^wss?:\/\/[^\s]+$/i.test(url)) ok.push(url);
    else bad.push(url);
  }
  return { ok, bad };
}

export function SettingsScreen() {
  const { wallet, ownerId, holdings, prefs, identity, resolvedTheme, anchorWorker, updatePrefs, save, refresh } = useWallet();
  const [cohortOpen, setCohortOpen] = useState(false);
  const cohortAtt = findLatestCohort(holdings, wallet.identity);
  const cohortView = cohortAtt ? readCohort(cohortAtt) : null;
  const navigate = useNavigate();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [passphraseForExport, setPassphraseForExport] = useState('');
  const [showExportForm, setShowExportForm] = useState(false);
  // Inline confirmation when the operator turns cloud backup OFF.
  // Flipping it OFF has irreversible recovery implications (cohort
  // cascade cannot restore without a cloud blob; only paper key +
  // encrypted-file backup remain), so the OFF direction requires
  // explicit acknowledgment. ON direction stays one-tap.
  const [showSovereignConfirm, setShowSovereignConfirm] = useState(false);
  const [sovereignAcknowledged, setSovereignAcknowledged] = useState(false);
  // Paper-K_data export state. The recovery key is the symmetric data-
  // encryption key wrapping the v2 backup blob — 32 random bytes the
  // operator writes down once. Anyone holding it plus the cloud blob
  // can reconstitute the wallet under a new passphrase. Treated like
  // the passphrase itself: revealed only after the operator confirms
  // they understand, hidden again on demand, never persisted in
  // component state beyond the explicit reveal flow.
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [passphraseForKey, setPassphraseForKey] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function onRevealKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError(null);
    setKeyBusy(true);
    try {
      const stored = await walletStore.load(ownerId);
      if (!stored) {
        throw new Error('No stored wallet — sign out and back in to refresh.');
      }
      if (stored.blob.v !== 2) {
        throw new Error(
          'This wallet uses the legacy backup format and has no recovery key. Save once to upgrade.',
        );
      }
      const kData = unwrapKData(stored.blob as RecoverableEncryptedBlob, passphraseForKey);
      let hex = '';
      for (const b of kData) hex += b.toString(16).padStart(2, '0');
      setRevealedKey(hex);
      setPassphraseForKey('');
      // Mark that the operator has seen their recovery key so the
      // home-screen "set up a way back in" nudge retires. Revealing it
      // is the act of establishing this recovery path.
      if (!prefs.recoveryKeySeen) {
        void updatePrefs({ recoveryKeySeen: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'reveal failed';
      const friendly = /wrong passphrase/i.test(message)
        ? 'That passphrase did not unlock the recovery key.'
        : message;
      setKeyError(friendly);
    } finally {
      setKeyBusy(false);
    }
  }

  function hideKey() {
    setRevealedKey(null);
    setShowKeyForm(false);
    setPassphraseForKey('');
    setKeyError(null);
  }

  // Format the 64-char hex key into readable groups for transcription:
  // 8 chars per group × 4 groups per line × 2 lines = 64 chars.
  function formatKeyForReading(hex: string): string[] {
    const groups: string[] = [];
    for (let i = 0; i < hex.length; i += 8) {
      groups.push(hex.substring(i, i + 8));
    }
    return groups;
  }
  const [relaysText, setRelaysText] = useState(() => prefs.nostrRelays.join('\n'));
  const [relayStatus, setRelayStatus] = useState<string | null>(null);
  const relayParse = parseRelayLines(relaysText);
  const relaysChanged =
    relayParse.ok.length !== prefs.nostrRelays.length ||
    relayParse.ok.some((url, i) => url !== prefs.nostrRelays[i]);

  // Org-mode declaration. Findable via findOwnOrgDeclaration on this
  // wallet's holdings; once present, the wallet has flipped to org-mode
  // and the OrgDeclarationSection renders the post-declaration summary.
  // The form + state machine for the unconfirmed path lives inside that
  // sibling component so SettingsScreen stays under the 800-line hard
  // limit.
  const existingOrgDeclaration = findOwnOrgDeclaration(holdings, wallet.identity);

  // Re-sync the editor when prefs.nostrRelays changes outside the form
  // (e.g. first load after a fresh sign-in).
  useEffect(() => {
    setRelaysText(prefs.nostrRelays.join('\n'));
  }, [prefs.nostrRelays]);

  async function saveRelays() {
    if (relayParse.ok.length === 0) {
      setRelayStatus('Need at least one wss:// relay.');
      return;
    }
    await updatePrefs({ nostrRelays: relayParse.ok });
    setRelayStatus(
      relayParse.bad.length > 0
        ? `Saved. Skipped ${relayParse.bad.length} invalid line(s).`
        : 'Saved.',
    );
    setTimeout(() => setRelayStatus(null), 2500);
  }

  function restoreDefaults() {
    setRelaysText(DEFAULT_RELAYS.join('\n'));
    setRelayStatus(null);
  }

  async function toggleCloudSync() {
    const next = !prefs.cloudSync;
    // Turning OFF is the dangerous direction — show the inline
    // sovereign-confirm panel and let the operator acknowledge what
    // they're taking responsibility for before the pref actually
    // flips. Turning ON is the safer direction and stays one-tap.
    if (!next) {
      setSovereignAcknowledged(false);
      setShowSovereignConfirm(true);
      return;
    }
    await updatePrefs({ cloudSync: true });
    try {
      await save();
    } catch {
      // The save outcome is reflected in prefs.lastRemoteSync.
    }
  }

  async function confirmSovereign() {
    await updatePrefs({ cloudSync: false });
    setShowSovereignConfirm(false);
    setSovereignAcknowledged(false);
  }

  function cancelSovereign() {
    setShowSovereignConfirm(false);
    setSovereignAcknowledged(false);
  }

  async function onExport(e: React.FormEvent) {
    e.preventDefault();
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadEncryptedBackup(wallet, passphraseForExport);
      setPassphraseForExport('');
      setShowExportForm(false);
      // Record that an encrypted-file backup exists so the home-screen
      // nudge retires — this is one of the recovery paths it asks for.
      if (!prefs.localBackupDownloaded) {
        void updatePrefs({ localBackupDownloaded: true });
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    navigate('/login', { replace: true });
  }

  const lastSync = prefs.lastRemoteSync
    ? new Date(prefs.lastRemoteSync).toLocaleString()
    : 'never';

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
          Every lever below moves the wallet toward sovereign. Turn off cloud
          backup to keep your encrypted wallet only on this device. Turn on
          staying reachable and point it at your own servers in the editor
          below. Set up trusted helpers and reveal your recovery key — both close the gap
          between "I trust the cloud" and "I trust myself and my people." A
          first-run sovereign-mode picker, opt-in peer-shard backup storage,
          custom OpenTimestamps calendar URLs, and a custom remote-backup
          endpoint are the next moves on the roadmap.
        </p>
        <Link
          to="/about"
          className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
        >
          Read the full sovereignty picture in the Guide →
        </Link>
      </section>

      <AppearanceSection prefs={prefs} updatePrefs={updatePrefs} />

      {resolvedTheme === 'fresh' && (
        <QuickShareSection identity={identity} holdings={holdings} />
      )}

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Cloud backup</div>
            <p className="mt-1 text-sm text-muted">
              Encrypted snapshot synced to the host. The host stores ciphertext
              only.
            </p>
            <p className="mt-2 text-xs text-muted">Last sync: {lastSync}</p>
          </div>
          <button
            type="button"
            onClick={toggleCloudSync}
            aria-pressed={prefs.cloudSync}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors ${
              prefs.cloudSync ? 'bg-accent' : 'bg-ink/15'
            }`}
          >
            <span
              className={`block h-6 w-6 bg-white rounded-full shadow transform transition-transform ${
                prefs.cloudSync ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {showSovereignConfirm && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-ink">
              Going sovereign — accept responsibility
            </div>
            <p className="mt-2 text-sm text-ink/80">
              Turning cloud backup OFF means your wallet's encrypted snapshot
              lives only on this device. The host keeps nothing for you.
              That's the strongest form of sovereignty the wallet offers
              today, and it comes with a real cost you need to accept
              before you flip it.
            </p>
            <ul className="mt-3 list-disc pl-5 text-sm text-ink/80 space-y-1">
              <li>
                If this device is lost or wiped and you have not written
                down your recovery key and have not downloaded an
                encrypted-file backup, the wallet is gone. There is no math
                path back.
              </li>
              <li>
                Your trusted-helper recovery works by decrypting the cloud
                blob on a new device. With cloud backup off there is no
                cloud blob, so even helpers who hold their shares have
                nothing to decrypt — the recovery key on its own has the
                same limit. Keep cloud backup on, or keep a downloaded
                encrypted-file backup, so there is something to restore into.
              </li>
              <li>
                Clearing browser data while in this mode wipes the wallet
                from the device permanently if you have no other backup.
              </li>
            </ul>
            <p className="mt-3 text-sm text-ink/80">
              Before flipping the switch, the wallet recommends you reveal
              your recovery key (below in this same panel) and write it
              down, OR download a local encrypted-file backup. Either one
              gives you a math path back.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sovereignAcknowledged}
                onChange={(e) => setSovereignAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand. I am responsible for my own backup from
                this point forward.
              </span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void confirmSovereign()}
                disabled={!sovereignAcknowledged}
                className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
              >
                Turn off cloud backup
              </button>
              <button
                type="button"
                onClick={cancelSovereign}
                className="rounded-md border border-ink/15 bg-white py-2 text-sm"
              >
                Keep cloud backup on
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Auto-lock</div>
        <p className="mt-1 text-sm text-muted">
          Re-prompt for your passphrase after this much inactivity. Lower is
          safer if you set the phone down; higher means fewer interruptions.
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Idle timeout</span>
          <select
            value={prefs.idleTimeoutMs}
            onChange={(e) => updatePrefs({ idleTimeoutMs: Number(e.target.value) })}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value={5 * 60 * 1000}>5 minutes</option>
            <option value={15 * 60 * 1000}>15 minutes</option>
            <option value={30 * 60 * 1000}>30 minutes (default)</option>
            <option value={60 * 60 * 1000}>1 hour</option>
            <option value={4 * 60 * 60 * 1000}>4 hours</option>
            <option value={0}>Never (until you sign out)</option>
          </select>
        </label>
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Stay reachable</div>
            <p className="mt-1 text-sm text-muted">
              Let people reach you when you're not in the same room — so a
              connection, a family invite, or a signing request can find
              you. Everything stays encrypted to you; the servers that
              carry it only ever see scrambled data.
            </p>
            <p className="mt-2 text-xs text-muted">
              Privacy note: turning this on lets the network know you're
              online and reachable. Keep it off until you want to be
              reached.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updatePrefs({ nostrTransportEnabled: !prefs.nostrTransportEnabled })}
            aria-pressed={prefs.nostrTransportEnabled}
            aria-label="Toggle staying reachable"
            className={`shrink-0 w-12 h-7 rounded-full transition-colors ${
              prefs.nostrTransportEnabled ? 'bg-accent' : 'bg-ink/15'
            }`}
          >
            <span
              className={`block h-6 w-6 bg-white rounded-full shadow transform transition-transform ${
                prefs.nostrTransportEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          <div className="text-sm font-medium">Relays</div>
          <p className="mt-1 text-xs text-muted">
            One wss:// URL per line. Edits take effect immediately
            when the network is on. Default-issued, replaceable —
            keep your own relays if you trust them more.
          </p>
          <textarea
            value={relaysText}
            onChange={(e) => setRelaysText(e.target.value)}
            rows={Math.max(5, relaysText.split('\n').length)}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
          />
          {relayParse.bad.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {relayParse.bad.length} line(s) do not look like wss:// URLs and will be skipped.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveRelays}
              disabled={!relaysChanged || relayParse.ok.length === 0}
              className="rounded-md bg-ink py-2 px-4 text-paper text-sm font-medium disabled:opacity-40"
            >
              Save relays
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Restore defaults
            </button>
          </div>
          {relayStatus && (
            <p className="mt-2 text-xs text-muted" role="status">
              {relayStatus}
            </p>
          )}
        </div>
      </section>

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

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Recovery cohort</div>
        {cohortView && cohortView.members.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-muted">
              {cohortView.threshold} of {cohortView.totalShares} peers
              declared to help if you ever need to recover this wallet on
              a new device. Use "Send each helper their piece" to actually
              hand out the encrypted shares — until you do, the cohort is
              declared but cannot yet bring you back.
            </p>
            <ul className="mt-3 space-y-1">
              {cohortView.members.map((m) => (
                <li key={m.pubkey} className="text-xs">
                  <span className="font-medium">{m.name || '(no name)'}</span>{' '}
                  <span className="text-muted font-mono">
                    {m.pubkey.slice(0, 8)}…{m.pubkey.slice(-4)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Declare which peers from your handshakes would help you
            recover this wallet on a new device. Pick at least two; any M
            of N of them together can put you back. Each individual peer
            sees nothing of yours on their own — only combined.
          </p>
        )}
        <button
          type="button"
          onClick={() => setCohortOpen(true)}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          {cohortView && cohortView.members.length > 0 ? 'Edit cohort' : 'Declare cohort'}
        </button>
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Local backup</div>
        <p className="mt-1 text-sm text-muted">
          Two offline fallbacks for the day you cannot get back in. The
          download is the wallet itself encrypted under your passphrase. The
          recovery key bypasses the passphrase entirely — write it down once
          and store it somewhere physically safe.
        </p>

        <div className="mt-4 text-sm font-medium">Encrypted file</div>
        <p className="mt-1 text-xs text-muted">
          You still need your passphrase to open this file on a new device —
          it protects against a lost device, not a forgotten passphrase. For
          a forgotten passphrase, use the recovery key or your trusted helpers.
        </p>
        {!showExportForm ? (
          <button
            type="button"
            onClick={() => setShowExportForm(true)}
            className="mt-2 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
          >
            Download local backup
          </button>
        ) : (
          <form onSubmit={onExport} className="mt-3">
            <label className="block text-sm">
              Confirm your passphrase
              <input
                type="password"
                required
                autoFocus
                value={passphraseForExport}
                onChange={(e) => setPassphraseForExport(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={exportBusy || passphraseForExport.length === 0}
                className="flex-1 rounded-md bg-ink py-2 text-paper font-medium disabled:opacity-40"
              >
                {exportBusy ? 'Encrypting…' : 'Download'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExportForm(false);
                  setPassphraseForExport('');
                  setExportError(null);
                }}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
            {exportError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {exportError}
              </p>
            )}
          </form>
        )}

        <div className="mt-5 border-t border-ink/10 pt-4">
          <div className="text-sm font-medium">Recovery key</div>
          <p className="mt-1 text-sm text-muted">
            A 64-character key that unlocks your wallet without the
            passphrase. Write it down on paper and keep it somewhere
            physically safe. Anyone holding it plus your cloud backup can
            recover your wallet — treat it like a house key.
          </p>

          {!showKeyForm && !revealedKey && (
            <button
              type="button"
              onClick={() => setShowKeyForm(true)}
              className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
            >
              Show my recovery key
            </button>
          )}

          {showKeyForm && !revealedKey && (
            <form onSubmit={onRevealKey} className="mt-3">
              <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                The key will appear on screen. Make sure you can write it
                down without anyone looking over your shoulder. Once written,
                tap Hide and store the paper somewhere only you can reach.
              </div>
              <label className="mt-3 block text-sm">
                Confirm your passphrase
                <input
                  type="password"
                  required
                  autoFocus
                  value={passphraseForKey}
                  onChange={(e) => setPassphraseForKey(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={keyBusy || passphraseForKey.length === 0}
                  className="flex-1 rounded-md bg-ink py-2 text-paper font-medium disabled:opacity-40"
                >
                  {keyBusy ? 'Unwrapping…' : 'Reveal key'}
                </button>
                <button
                  type="button"
                  onClick={hideKey}
                  className="rounded-md border border-ink/15 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
              {keyError && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {keyError}
                </p>
              )}
            </form>
          )}

          {revealedKey && (
            <div className="mt-3">
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-sm tracking-wide">
                  {formatKeyForReading(revealedKey).map((group, i) => (
                    <div key={i} className="text-center">
                      {group}
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Spaces and dashes are ignored when you type it back in. Read
                it twice, write it twice — small transcription errors mean
                the key will not work.
              </p>
              <button
                type="button"
                onClick={hideKey}
                className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
              >
                Hide
              </button>
            </div>
          )}
        </div>
      </section>

      <RotateKeySection wallet={wallet} save={save} refresh={refresh} />

      <AdoptExistingKeySection wallet={wallet} />

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

      <KnownLimitationsSection />

      {cohortOpen && (
        <Suspense fallback={null}>
          <CohortEditorModal onClose={() => setCohortOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
