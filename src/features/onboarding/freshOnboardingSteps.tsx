// Step components for the FreshOnboarding state machine. Extracted
// from FreshOnboarding.tsx 2026-05-28 (PLAN.md Tier 1 item 3) so
// the orchestrator stays under the 800-line hard limit. Each step
// is presentation-only and takes its state + callbacks via props;
// the main FreshOnboarding component owns the state machine, the
// supabase auth handshake, and the volatile-bundle handoff to
// WalletProvider.

import { OAuthButtons } from '../auth/OAuthButtons.tsx';
import { PasswordSignIn } from '../auth/PasswordSignIn.tsx';

function SplashStep() {
  return (
    <div className="pt-12 text-center">
      <h1 className="text-fresh-hero font-fresh-display leading-[1.02] text-fresh-text-primary">
        Your identity,
        <br />
        held by you.
      </h1>
      <p className="mt-6 text-sm text-fresh-text-secondary">
        A wallet that holds your own keys and the signed records of your life.
        Tap to set it up.
      </p>
    </div>
  );
}

function NameStep(props: {
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  birthday: string;
  onBirthdayChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack?: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Your name on the record.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Whatever you want to be called. You can change how you share it later;
        the wallet keeps the full record either way.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          What people call you
        </span>
        <input
          type="text"
          required
          autoFocus
          autoComplete="name"
          maxLength={64}
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="Ada"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Birthday <span className="lowercase text-fresh-text-tertiary/70">(optional · enables one-tap age proofs)</span>
        </span>
        <input
          type="date"
          autoComplete="bday"
          value={props.birthday}
          onChange={(e) => props.onBirthdayChange(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Continue
        </button>
        {props.onBack && (
          <button
            type="button"
            onClick={props.onBack}
            className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
          >
            Back
          </button>
        )}
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

function PassphraseStep(props: {
  passphrase: string;
  confirmPassphrase: string;
  onPassphraseChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Pick a passphrase only you would know.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        This is the only secret only you know. We never see it. Pick something
        personal to you — a phrase you would remember on your own. Password
        managers are fine for backup, but the passphrase needs to live in your
        head first, not just in an autofill box.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Passphrase
        </span>
        <input
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          value={props.passphrase}
          onChange={(e) => props.onPassphraseChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Confirm
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={props.confirmPassphrase}
          onChange={(e) => props.onConfirmChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      {/* Live match feedback so a mismatched autofill is caught BEFORE
          submit — a passphrase you can't reproduce locks the wallet
          forever, so the confirm field earns an immediate signal. */}
      {props.confirmPassphrase.length > 0 && (
        <p
          className={`mt-2 text-xs ${
            props.passphrase === props.confirmPassphrase
              ? 'text-fresh-accent-primary'
              : 'text-fresh-accent-danger'
          }`}
          role="status"
        >
          {props.passphrase === props.confirmPassphrase
            ? '✓ Passphrases match'
            : "Passphrases don't match yet"}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

function EmailStep(props: {
  email: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  /** Returning-user re-authentication rather than new-user onboarding.
   *  Changes the heading + copy so it reads as "welcome back" and not
   *  "last step" of an onboarding the operator is not doing. */
  signInMode?: boolean;
  busy: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        {props.signInMode ? 'Welcome back.' : 'Last step.'}
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        {props.signInMode
          ? 'Enter the email you signed up with. We mail you a code — then your wallet asks for your passphrase to unlock.'
          : 'Your email keeps the wallet linked to you across devices. We mail you a code — no password, nothing to remember besides your passphrase.'}
      </p>
      <div className="mt-8">
        <OAuthButtons fresh />
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-fresh-text-tertiary">
        <span className="h-px flex-1 bg-fresh-surface-edge" />
        or use email
        <span className="h-px flex-1 bg-fresh-surface-edge" />
      </div>
      <label className="block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Email
        </span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          value={props.email}
          onChange={(e) => props.onEmailChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="you@example.com"
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={props.busy || props.email.trim().length === 0}
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:active:animate-none"
        >
          {props.busy ? 'Sending…' : 'Send my code'}
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
      <div className="my-5 flex items-center gap-3 text-xs text-fresh-text-tertiary">
        <span className="h-px flex-1 bg-fresh-surface-edge" />
        or with a password
        <span className="h-px flex-1 bg-fresh-surface-edge" />
      </div>
      <PasswordSignIn fresh />
    </form>
  );
}

function CodeStep(props: {
  email: string;
  code: string;
  onCodeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  busy: boolean;
  resent: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Check your email.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        A six-digit code is on its way to{' '}
        <span className="font-medium text-fresh-text-primary">
          {props.email}
        </span>
        . Drop it below — when you do, your wallet is created.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          6-digit code
        </span>
        <input
          type="text"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          value={props.code}
          onChange={(e) => props.onCodeChange(e.target.value.replace(/\s/g, ''))}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-center font-fresh-mono text-xl tracking-[0.4em] text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="123456"
        />
      </label>
      <button
        type="submit"
        disabled={props.busy || props.code.trim().length === 0}
        className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:active:animate-none"
      >
        {props.busy ? 'Signing you in…' : 'Verify & create my wallet'}
      </button>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
      <div className="mt-8 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={props.onChangeEmail}
          className="text-fresh-text-tertiary transition hover:text-fresh-text-primary"
        >
          ← Use a different email
        </button>
        <button
          type="button"
          onClick={props.onResend}
          disabled={props.busy}
          className="font-medium text-fresh-accent-primary transition hover:underline disabled:opacity-40"
        >
          {props.resent ? 'Code resent' : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

// Import-existing-Nostr-identity steps (PLAN.md Tier 1 item 9,
// 2026-05-29). For operators bringing an existing Nostr nsec
// (Primal users, Damus users, etc.) into Tapit. Two sub-steps:
// disclose the keys-discipline tradeoff plainly, then capture the
// nsec and confirm the derived pubkey before routing back to the
// passphrase step in the parent state machine. The disclose +
// enter shapes mirror the Classic ImportNostrIdentityPrompt
// (variant=classic) under the Fresh aurora-glass palette.

function ImportDiscloseStep(props: {
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Bring your existing account in.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        If you already use an app like Primal, Damus, or Amethyst, you can
        bring that account here with its private key. Your profile,
        follows, and history come with you, and Tapit builds your signed
        records on top of who you already are instead of starting over.
      </p>
      <div className="mt-5 rounded-2xl border border-fresh-accent-danger/40 bg-fresh-accent-danger/[0.08] px-4 py-3 text-sm text-fresh-text-primary">
        <p className="font-semibold">Read this before you continue.</p>
        <p className="mt-2 text-fresh-text-secondary">
          When Tapit makes you a brand-new account, your secret key never
          leaves this device unprotected — that's the core rule. When you
          import a key from another app, that key already exists in that app
          too, so now there are two copies: an encrypted one here, and the
          original wherever you've been using it.
        </p>
        <p className="mt-2 text-fresh-text-secondary">
          That's a fair trade if keeping your existing account matters to
          you — but it's a little less private than a fresh key made only
          here. Choose "start fresh" if that trade isn't worth it.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={props.onContinue}
          className="rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          I understand — bring my account in
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Start fresh instead
        </button>
      </div>
    </div>
  );
}

function ImportEnterStep(props: {
  keyInput: string;
  onKeyInputChange: (v: string) => void;
  derivedPubkey: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Paste your account key.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Paste the private key from your other app. It usually starts with
        "nsec1…", or it may be a long string of letters and numbers. We'll
        show your public ID below so you can check it before continuing.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Account key
        </span>
        <input
          type="text"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={props.keyInput}
          onChange={(e) => props.onKeyInputChange(e.target.value)}
          placeholder="nsec1… or a long string of letters and numbers"
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 font-fresh-mono text-xs text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      {props.derivedPubkey && (
        <div className="mt-3 rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-xs text-fresh-text-primary backdrop-blur-xl">
          <div className="text-fresh-text-tertiary">Your public ID:</div>
          <div className="mt-1 font-fresh-mono break-all">
            {props.derivedPubkey}
          </div>
          <div className="mt-1 text-fresh-text-tertiary">
            Check this matches the account you meant to bring in.
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={!props.derivedPubkey}
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:active:animate-none"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

export {
  SplashStep,
  NameStep,
  PassphraseStep,
  EmailStep,
  CodeStep,
  ImportDiscloseStep,
  ImportEnterStep,
};
