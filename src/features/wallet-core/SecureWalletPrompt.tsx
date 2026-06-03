import { useState } from 'react';
import { unwrapKData, type RecoverableEncryptedBlob } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// Post-setup "secure your wallet" step (recovery-hardening arc, part 3,
// 2026-06-03). The audit's #1 gap: nothing ever proactively tells a
// nontechnical user to back up, so they sail past Settings and end up
// with cloud backup ONLY — useless if they forget the passphrase. This
// is the one moment we can be sure they're paying attention: right after
// they finished the identity ceremony. We reveal their recovery key,
// explain it in plain language, and have them confirm they wrote it down
// before continuing to the wallet.
//
// The recovery key is the K_data (the symmetric backup-encryption key),
// unwrapped from the v2 blob with the passphrase that's already in
// memory this session. Same value Settings → Recovery key reveals; this
// just surfaces it at the moment it matters most instead of burying it.
//
// Skippable — sovereignty means the operator can decline — but the skip
// is deliberately softer than the confirm, and declining leaves the
// home-screen nudge active so they're reminded until they secure a path.

interface Props {
  ownerId: string;
  passphrase: string;
  /** Called when the operator has written the key down (or skipped).
   *  `secured` is true only when they confirmed writing it down. */
  onDone: (secured: boolean) => void;
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'revealing' }
  | { kind: 'revealed'; hex: string }
  | { kind: 'error'; message: string };

// 8-char groups, two columns — matches the Settings reveal layout so the
// operator learns one transcription format.
function groups(hex: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += 8) out.push(hex.substring(i, i + 8));
  return out;
}

export function SecureWalletPrompt({ ownerId, passphrase, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [wroteItDown, setWroteItDown] = useState(false);

  async function reveal() {
    setPhase({ kind: 'revealing' });
    try {
      const stored = await walletStore.load(ownerId);
      if (!stored || stored.blob.v !== 2) {
        throw new Error(
          'This wallet has no recovery key yet — you can set one up later from Settings.',
        );
      }
      const kData = unwrapKData(stored.blob as RecoverableEncryptedBlob, passphrase);
      let hex = '';
      for (const b of kData) hex += b.toString(16).padStart(2, '0');
      setPhase({ kind: 'revealed', hex });
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not reveal the key.',
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">One thing before you start</h1>

        {phase.kind === 'intro' && (
          <>
            <p className="mt-3 text-sm text-muted">
              Your wallet has no company behind it — no password reset, no
              support line. That is the point, and it means the way back in is
              yours to keep. Your <strong>recovery key</strong> is a
              64-character code that can restore this wallet even if you forget
              your passphrase. Write it on paper and store it somewhere only
              you can reach. Take the minute now — it is the difference between
              a lost passphrase being an inconvenience and being permanent.
            </p>
            <button
              type="button"
              onClick={() => void reveal()}
              className="mt-6 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              Show my recovery key
            </button>
            <button
              type="button"
              onClick={() => onDone(false)}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              I'll do this later
            </button>
            <p className="mt-3 text-xs text-muted">
              If you skip, the wallet will keep reminding you on the home
              screen until you set up a way back in.
            </p>
          </>
        )}

        {phase.kind === 'revealing' && (
          <p className="mt-6 text-sm text-muted">Unwrapping your recovery key…</p>
        )}

        {phase.kind === 'error' && (
          <>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {phase.message}
            </div>
            <button
              type="button"
              onClick={() => onDone(false)}
              className="mt-5 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              Continue to my wallet
            </button>
          </>
        )}

        {phase.kind === 'revealed' && (
          <>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              Make sure no one is looking over your shoulder. Write it down on
              paper — not a screenshot, not a note that syncs to the cloud.
            </div>
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-sm tracking-wide">
                {groups(phase.hex).map((g, i) => (
                  <div key={i} className="text-center">
                    {g}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Spaces and dashes are ignored when you type it back in. Read it
              twice, write it twice — a single wrong character means it will
              not work. You can see it again any time in Settings.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={wroteItDown}
                onChange={(e) => setWroteItDown(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I've written it down and stored it somewhere safe.
              </span>
            </label>
            <button
              type="button"
              onClick={() => onDone(true)}
              disabled={!wroteItDown}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
            >
              Done — continue to my wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
