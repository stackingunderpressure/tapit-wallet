// One honest screen the operator passes through between typing a new
// passphrase and the wallet getting encrypted under it. It says the two
// things that actually matter, plainly: make the passphrase personal and
// memorable (not a random string an autofill box holds for you — the
// failure mode the operator named 2026-05-27), and there is no reset — a
// forgotten passphrase can't be recovered by support or email, because
// the passphrase IS the encryption key (CLAUDE.md non-negotiable #1). It
// also tells them the recovery key comes right after as their backup way
// in. Merged from a two-screen gate into one on 2026-09-04 (operator: cut
// the corny over-the-top onboarding down to what's useful).
//
// Used by both PassphrasePrompt (Classic first-login) and
// FreshOnboarding's PassphraseStep.

interface Props {
  variant: 'classic' | 'fresh';
  onConfirm: () => void | Promise<void>;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
}

export function PassphraseCommitWarnings({
  variant,
  onConfirm,
  onBack,
  busy = false,
  error = null,
}: Props) {
  if (variant === 'classic') {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">
          Your passphrase is the only way in.
        </h1>
        <p className="mt-3 text-sm text-muted">
          It encrypts your wallet, so pick something personal you'll actually
          remember — not a random string an autofill box holds for you. There
          is no reset: no support team and no email can recover a forgotten
          passphrase. Right after this you'll write down a recovery key as your
          backup way in.
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
          onClick={onBack}
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
      </div>
    );
  }

  // Fresh variant — aurora-glass palette, fresh-display fonts.
  return (
    <div>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Your passphrase is the only way in.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        It encrypts your wallet, so pick something personal you'll actually
        remember — not a random string an autofill box holds for you. There is
        no reset: no support team and no email can recover a forgotten
        passphrase. Right after this you'll write down a recovery key as your
        backup way in.
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
          onClick={onBack}
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
    </div>
  );
}
