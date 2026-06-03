import { useState } from 'react';

// Two-step gate the operator must pass through between typing a new
// passphrase and the wallet actually getting encrypted under it. The
// first step asks whether the passphrase is personal-and-memorable
// (the protection against the "let a password manager autogenerate
// a random string and click through" failure mode the operator named
// 2026-05-27 — a password manager backup is fine but the passphrase
// must live in the user's head first). The second step states the
// irrecoverable consequence (no reset, no support, no recovery — the
// passphrase IS the encryption key per CLAUDE_ROOT.md rule one).
//
// Used by both PassphrasePrompt (Classic first-login) and
// FreshOnboarding's PassphraseStep so neither surface lets the
// operator commit a passphrase without two distinct moments of
// pause and acknowledgment.

interface Props {
  variant: 'classic' | 'fresh';
  onConfirm: () => void | Promise<void>;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
}

type WarnStep = 'personal' | 'irrecoverable';

export function PassphraseCommitWarnings({
  variant,
  onConfirm,
  onBack,
  busy = false,
  error = null,
}: Props) {
  const [step, setStep] = useState<WarnStep>('personal');

  function onPersonalAffirm() {
    setStep('irrecoverable');
  }

  function onIrrecoverableBack() {
    setStep('personal');
  }

  if (variant === 'classic') {
    return (
      <div className="w-full max-w-sm">
        {step === 'personal' ? (
          <>
            <h1 className="text-xl font-semibold">
              Could you remember this without your password manager?
            </h1>
            <p className="mt-3 text-sm text-muted">
              Your passphrase needs to be something personal to you — a phrase
              you would remember on your own. A line from a song. A memory in
              words. A phrase that means something only to you. Saving it in a
              password manager too is smart, but the passphrase needs to live
              in your head first, not just in an autofill box.
            </p>
            <button
              type="button"
              onClick={onPersonalAffirm}
              className="mt-6 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              Yes — this is personal and I will remember it
            </button>
            <button
              type="button"
              onClick={onBack}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              Let me pick something more personal
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              Last check: your passphrase is the everyday way in.
            </h1>
            <p className="mt-3 text-sm text-muted">
              Your keys are encrypted under this passphrase — no reset, no
              support team, no email recovery can undo a forgotten one. The
              wallet gives you two safety nets for exactly that day: a written
              recovery key and a circle of trusted helpers. Right after this,
              the wallet will help you set one up. If you forget the passphrase
              and never set up either, the wallet is gone for good.
            </p>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="mt-6 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
            >
              {busy ? 'Generating wallet…' : 'I understand — create my wallet'}
            </button>
            <button
              type="button"
              onClick={onIrrecoverableBack}
              disabled={busy}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium disabled:opacity-40"
            >
              Back
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Fresh variant — aurora-glass palette, fresh-display fonts.
  return (
    <div>
      {step === 'personal' ? (
        <>
          <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
            Could you remember this without your password manager?
          </h1>
          <p className="mt-3 text-sm text-fresh-text-secondary">
            Your passphrase needs to be something personal to you — a phrase
            you would remember on your own. A line from a song. A memory in
            words. A phrase that means something only to you. Saving it in a
            password manager too is smart, but the passphrase needs to live
            in your head first, not just in an autofill box.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={onPersonalAffirm}
              className="rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
            >
              Yes — this is personal and I will remember it
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm text-fresh-text-primary backdrop-blur-xl"
            >
              Let me pick something more personal
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
            Last check: your passphrase is the everyday way in.
          </h1>
          <p className="mt-3 text-sm text-fresh-text-secondary">
            Your keys are encrypted under this passphrase — no reset, no
            support team, no email recovery can undo a forgotten one. The
            wallet gives you two safety nets for exactly that day: a written
            recovery key and a circle of trusted helpers. Right after this,
            the wallet will help you set one up. If you forget the passphrase
            and never set up either, the wallet is gone for good.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-40"
            >
              {busy ? 'Generating wallet…' : 'I understand — continue'}
            </button>
            <button
              type="button"
              onClick={onIrrecoverableBack}
              disabled={busy}
              className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm text-fresh-text-primary backdrop-blur-xl disabled:opacity-40"
            >
              Back
            </button>
            {error && (
              <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
