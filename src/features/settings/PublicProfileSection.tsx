import { useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { buildProfileEventForOwner, profileFromIdentity } from '../transport/nostrProfile.ts';

// Settings: public Nostr profile, off by default (operator, 2026-11-23). Shows
// exactly what anyone on Nostr would see before it is switched on. Off
// publishes an empty profile, replacing any earlier one.
export function PublicProfileSection() {
  const { wallet, ownerId, identity, prefs, updatePrefs, transport } = useWallet();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const preview = identity ? profileFromIdentity(identity) : null;

  async function set(on: boolean) {
    setBusy(true);
    setNote(null);
    try {
      await updatePrefs({ publicProfile: on });
      // Publish the change now rather than waiting for the next connect.
      if (transport && identity) {
        const event = await buildProfileEventForOwner(wallet, identity, ownerId);
        if (event) await transport.publish(event);
      }
      setNote(on ? 'Your profile is public now.' : 'Your public profile was replaced with an empty one.');
    } catch {
      setNote('Saved. It will go out the next time the wallet connects.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-2 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <p className="text-sm text-muted">
        Off: other Nostr apps see only your key, no name. On: anyone on Nostr can read the
        details below, which also makes you easier for strangers and spammers to find.
      </p>
      <div className="mt-3 rounded-md border border-ink/10 p-3 text-xs">
        <div className="font-medium">What would be public</div>
        {preview ? (
          <ul className="mt-1 space-y-0.5 text-muted">
            <li>Name: {preview.display_name}</li>
            {preview.about && <li>About: {preview.about}</li>}
          </ul>
        ) : (
          <p className="mt-1 text-muted">Nothing yet: your identity has no display name.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void set(!prefs.publicProfile)}
        disabled={busy || (!prefs.publicProfile && !preview)}
        className="mt-3 min-h-[44px] rounded-md border border-ink/15 px-4 text-sm font-medium disabled:opacity-40"
      >
        {prefs.publicProfile ? 'Turn off public profile' : 'Make my profile public'}
      </button>
      <p className="mt-2 text-xs text-muted">
        Turning it off replaces your profile with an empty one. Relays that kept an older copy
        may still have it; Nostr has no way to force them to delete it.
      </p>
      {note && <p className="mt-2 text-xs" role="status">{note}</p>}
    </section>
  );
}
