// Step components for the FreshOnboarding state machine. Extracted
// from FreshOnboarding.tsx 2026-05-28 (PLAN.md Tier 1 item 3) so
// the orchestrator stays under the 800-line hard limit. Each step
// is presentation-only and takes its state + callbacks via props;
// the main FreshOnboarding component owns the state machine, the
// supabase auth handshake, and the volatile-bundle handoff to
// WalletProvider.

function SplashStep() {
  return (
    <div className="pt-12 text-center">
      <h1 className="text-fresh-hero font-fresh-display leading-[1.02] text-fresh-text-primary">
        What just happened
        <br />
        to you?
      </h1>
      <p className="mt-6 text-sm text-fresh-text-secondary">
        Tap to begin. We'll hold the record — you keep the key.
      </p>
    </div>
  );
}

function ComposeStep(props: {
  text: string;
  onTextChange: (v: string) => void;
  attachment: File | null;
  attachmentBusy: boolean;
  onPickAttachment: (f: File | null) => void;
  onClearAttachment: () => void;
  photoRef: React.RefObject<HTMLInputElement>;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Something to remember.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Type a sentence about today, snap a photo, or both. It isn't signed
        yet — we'll make it real together.
      </p>
      <label className="mt-6 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          What happened
        </span>
        <textarea
          rows={4}
          autoFocus
          value={props.text}
          onChange={(e) => props.onTextChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="Write it in your own words."
        />
      </label>
      <input
        ref={props.photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => props.onPickAttachment(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3">
        {!props.attachment && !props.attachmentBusy && (
          <button
            type="button"
            onClick={() => props.photoRef.current?.click()}
            className="w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm font-medium text-fresh-text-primary backdrop-blur-xl transition hover:bg-fresh-surface-raised"
          >
            📷 Add a photo (optional)
          </button>
        )}
        {props.attachmentBusy && (
          <p className="text-xs text-fresh-text-secondary">Reading photo…</p>
        )}
        {props.attachment && !props.attachmentBusy && (
          <div className="flex items-center justify-between rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-2 backdrop-blur-xl">
            <p className="truncate text-xs text-fresh-text-secondary">
              ✓ {props.attachment.name} —{' '}
              {Math.round(props.attachment.size / 1024)} KB
            </p>
            <button
              type="button"
              onClick={props.onClearAttachment}
              className="ml-2 shrink-0 text-xs text-fresh-text-tertiary hover:text-fresh-text-primary"
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <button
        type="submit"
        className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
      >
        Continue
      </button>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-fresh-text-tertiary">
        You can leave both empty — your wallet will still get set up.
      </p>
    </form>
  );
}

function NameStep(props: {
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  birthday: string;
  onBirthdayChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
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
      <label className="mt-8 block">
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
        . Drop it below — when you do, your first entry gets signed and your
        wallet is real.
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
        {props.busy ? 'Signing you in…' : 'Verify & sign my first entry'}
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
        Bring your existing Nostr identity in.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        You can import a Nostr nsec you already use somewhere else —
        Primal, Damus, Amethyst, an nsec-bunker. Your existing follows,
        profile, and post history come with you. Tapit's signed-attestation
        substrate then decorates the identity you already have rather than
        starting you fresh.
      </p>
      <div className="mt-5 rounded-2xl border border-fresh-accent-danger/40 bg-fresh-accent-danger/[0.08] px-4 py-3 text-sm text-fresh-text-primary">
        <p className="font-semibold">Read this before you continue.</p>
        <p className="mt-2 text-fresh-text-secondary">
          For a fresh Tapit identity, your private key never leaves this
          wallet unencrypted — that is rule one. For an IMPORTED identity,
          that rule becomes more nuanced because your nsec already exists
          outside Tapit (in whichever client you have been using). Tapit
          holds an encrypted local copy; the original copy lives wherever
          you have used it.
        </p>
        <p className="mt-2 text-fresh-text-secondary">
          You are making an informed tradeoff: continuity of your existing
          Nostr identity in exchange for the keys-never-leave-the-wallet
          discipline being weakened for this one key. Pick fresh-generate
          if that tradeoff is not worth it to you.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={props.onContinue}
          className="rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          I understand — import my existing identity
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Generate a fresh identity instead
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
        Paste your nsec.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Paste your nsec (nsec1…) or your 64-character hex private key. The
        pubkey we derive shows below so you can verify before continuing.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Private key
        </span>
        <input
          type="password"
          required
          autoFocus
          autoComplete="off"
          value={props.keyInput}
          onChange={(e) => props.onKeyInputChange(e.target.value)}
          placeholder="nsec1… or 64-char hex"
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 font-fresh-mono text-xs text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      {props.derivedPubkey && (
        <div className="mt-3 rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-xs text-fresh-text-primary backdrop-blur-xl">
          <div className="text-fresh-text-tertiary">Derived pubkey:</div>
          <div className="mt-1 font-fresh-mono break-all">
            {props.derivedPubkey}
          </div>
          <div className="mt-1 text-fresh-text-tertiary">
            Verify this matches the pubkey of the Nostr identity you intend
            to import.
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
  ComposeStep,
  NameStep,
  PassphraseStep,
  EmailStep,
  CodeStep,
  ImportDiscloseStep,
  ImportEnterStep,
};
