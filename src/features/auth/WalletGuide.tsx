import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { useSession } from './useSession.ts';

// The wallet's reference surface — same content reachable from the
// signed-out login screen AND from a "Guide" link inside the app.
// Four tabs:
//
//   - Why & Who — three audience pictures (individual, family,
//     organization) so a first-time visitor can see themselves in
//     it.
//   - What it holds — plain-English tour of the seven envelope
//     kinds (identity, relationship, credential, agreement,
//     prediction, journal, meta) plus the diary as the day-one
//     surface.
//   - Recovery — three paths back (cohort cascade, paper recovery
//     key, encrypted backup file) and what each one requires.
//   - Account — sign-in form when signed-out, sign-out + back-to-
//     wallet when signed-in. Recovery actions don't live here
//     because they only work from the locked unlock screen with a
//     stored blob — the Recovery tab points the operator there.
//
// Same component, two entry points: LoginPage renders it as the
// landing surface; /about renders it as a reference while signed
// in. The Account tab reads useSession to decide what to show.

type Tab = 'why' | 'what' | 'recovery' | 'sovereignty' | 'account';

interface TabSpec {
  id: Tab;
  label: string;
}

const TABS: TabSpec[] = [
  { id: 'why', label: 'Why & Who' },
  { id: 'what', label: 'What it holds' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'sovereignty', label: 'Sovereignty' },
  { id: 'account', label: 'Account' },
];

interface Props {
  /** Which tab to open first. Defaults to 'why'. */
  initialTab?: Tab;
}

export function WalletGuide({ initialTab = 'why' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 -top-32 h-[26rem] w-[26rem] animate-float rounded-full bg-accent/25 blur-3xl motion-reduce:animate-none"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -right-28 h-[30rem] w-[30rem] animate-float-slow rounded-full bg-amber-400/20 blur-3xl motion-reduce:animate-none"
      />
      <div className="relative mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
              Tapit Wallet
            </span>
          </div>
        </header>

        <nav
          aria-label="Guide sections"
          className="sticky top-0 z-10 -mx-4 mb-5 bg-paper/85 px-4 py-2 backdrop-blur"
        >
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.id
                    ? 'bg-ink text-paper'
                    : 'bg-white text-ink/70 border border-ink/10 hover:bg-ink/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="rounded-2xl border border-ink/10 bg-white/85 p-6 shadow-[0_24px_70px_-20px_rgba(15,20,25,0.35)] backdrop-blur-md">
          {tab === 'why' && <WhyAndWho />}
          {tab === 'what' && <WhatItHolds />}
          {tab === 'recovery' && <RecoveryPaths />}
          {tab === 'sovereignty' && <Sovereignty />}
          {tab === 'account' && <Account />}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-xl font-semibold text-ink">{children}</h2>;
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink/75">{children}</p>;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-xl border border-ink/10 bg-paper/50 p-4">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-ink/75">{children}</div>
    </div>
  );
}

// ============================================================
// Tab 1 — Why & Who
// ============================================================

function WhyAndWho() {
  return (
    <section>
      <SectionTitle>The record of your life belongs to you.</SectionTitle>
      <Lede>
        Today our names, our histories, our proofs of who we are live in other
        companies' databases. Tapit Wallet inverts that. Your keypair is
        generated on your device, never leaves unencrypted, and is the Merkle
        holder of the signed attestations that make up your verifiable life.
        One identity per person, owned by you, that every app can ask for
        signatures from. Math, not trust.
      </Lede>

      <Card title="For an individual">
        Your diary, anchored to Bitcoin. Your identity, signed by your own
        key. Selectively share one fact — your age, your address, a specific
        credential — without leaking the rest. When an app asks you to sign
        something, you see exactly what it is in plain English before you
        approve. Lost the device? Your cohort puts you back together.
      </Card>

      <Card title="For a family">
        Witness each other's moments. A grandparent's diary entries can be
        co-signed by a parent and held across the family until the
        grandchild is old enough to inherit the thread into their own
        wallet. Custody hand-offs are signed events. Memory, vouched for by
        the people who were there.
      </Card>

      <Card title="For an organization">
        A church, a bar, a town, the American Legion can declare itself an
        organization and issue signed memberships. Members hold the
        attestation in their own wallets — when they need to prove they
        belong, they show the math, not a card the organization could
        revoke arbitrarily. Officials ratify memberships; nested membership
        lets the town hold the bar hold its regulars.
      </Card>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        The wallet is one place keys live. Every other app connects to it
        over the inter-app sign pathway — they never hold keys themselves.
        That is the architectural inversion: identity stops being something
        you rent and starts being something you hold.
      </p>
    </section>
  );
}

// ============================================================
// Tab 2 — What it holds (envelope kinds)
// ============================================================

function WhatItHolds() {
  return (
    <section>
      <SectionTitle>Seven shapes of signed truth.</SectionTitle>
      <Lede>
        Every record in the wallet is a tapit-attest envelope — one envelope
        shape carrying seven kinds of attestation across three trust tiers,
        signed by Schnorr over secp256k1 with a Merkle field tree and
        optional anchoring to Bitcoin via OpenTimestamps. The seven kinds in
        plain English:
      </Lede>

      <Card title="Identity">
        Who a public key belongs to. The first envelope every wallet signs
        about itself: display name, creation date, the key as its own
        subject. The root of your reputation.
      </Card>

      <Card title="Relationship">
        Two parties connected with a verification tier naming HOW they
        connected. Tier R (remote), Tier P (in-person handshake), Tier V
        (device-verified presence with biometric + geolocation + timestamp).
        Honest about the strength of each link.
      </Card>

      <Card title="Credential">
        Something a subject did, earned, or was authorized to do. A
        recovery-cohort declaration is a credential. An organization
        membership is a credential. The wallet's eligibility for a recovery
        share is a credential.
      </Card>

      <Card title="Agreement">
        A multi-party mutual commitment. Both wallets sign the same envelope.
        Marriages, contracts, witness sign-offs, anything that requires more
        than one consent to be real.
      </Card>

      <Card title="Prediction">
        A future outcome anchored before the event. Reality verifies it
        later — the anchored timestamp proves you committed to the call
        before you knew the answer.
      </Card>

      <Card title="Journal">
        Daily content — diary entries, photos, documents, location notes.
        Signed and time-anchored. The day-one product of the wallet:
        cryptographically signed personal record that quietly accumulates
        peer corroboration over time.
      </Card>

      <Card title="Meta">
        Control-plane events. Key-succession links, revocations,
        recovery-succession events. The chain's metadata about itself.
      </Card>

      <div className="mt-6 rounded-xl border border-ink/15 bg-paper/70 p-4">
        <div className="text-sm font-semibold text-ink">
          Anchored to Bitcoin via OpenTimestamps
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          Every signed envelope can be anchored to a public clock the wallet
          does not control. The anchoring is powered by{' '}
          <a
            href="https://opentimestamps.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            OpenTimestamps
          </a>{' '}
          — an open standard created by Peter Todd that lets the wallet
          submit just the SHA-256 hash of an envelope to free calendar
          servers, which aggregate huge numbers of these hashes into one
          Merkle tree and commit the tree's root to a Bitcoin transaction.
          A few Bitcoin blocks later the wallet downloads a small proof
          that walks from your envelope's hash up through the aggregation
          tree to a real Bitcoin block height. The envelope itself never
          touches the calendar server — only the hash does, so privacy is
          preserved — and the wallet shows the block height inline as
          "Time-verified · block N" once the proof has matured.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">
          Why this is different from an empty time claim: a wallet that
          just says "I signed this at 3:42 PM" is asking you to trust the
          wallet's clock — and the wallet's clock can lie, drift,
          backdate, or be wound forward. A server-stamped time claim is
          worse: now you're trusting the server too, and a compromised or
          coerced server can stamp anything it wants. Bitcoin's block
          chain is a public clock no single party controls. Every block
          carries a timestamp that thousands of independent nodes have to
          agree on. An OpenTimestamps proof says "this hash existed by
          block N" — and rewriting block N means rewriting the entire
          Bitcoin chain after it, which costs more energy than humans
          currently produce. The honest precision: anchoring proves the
          envelope existed at-or-before that block's time, not the exact
          moment, but at-or-before is enough to refute backdating and to
          establish before/after ordering between any two anchored
          envelopes anywhere in the world.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">
          The proof travels with the envelope. A verifier anywhere on
          earth, holding just your envelope's bytes plus the OTS proof
          plus a Bitcoin block-height oracle, can independently check
          three things at once: the wallet's signature is valid, the
          envelope's hash matches the one OpenTimestamps recorded, and
          the Bitcoin block at that height confirms the timestamp.
          That's the math-not-trust principle reaching all the way down
          to time itself. Tapit Wallet credits OpenTimestamps for making
          this layer possible — the wallet uses the protocol exactly as
          designed and forwards the same calendar servers anyone else
          using OTS does.
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Every envelope verifies against its signature alone — a third party
        with the envelope plus a tapit-attest verifier can check the math
        without trusting the wallet, the host, or any platform. That's the
        "math, not trust" principle made concrete.
      </p>
    </section>
  );
}

// ============================================================
// Tab 3 — Recovery
// ============================================================

function RecoveryPaths() {
  return (
    <section>
      <SectionTitle>Three paths back.</SectionTitle>
      <Lede>
        Lost the device, forgot the passphrase, or both — the wallet ships
        three independent recovery paths. They stack: any one of them brings
        the wallet back. Each requires preparation before the loss, so the
        first time you set up the wallet, set up at least one.
      </Lede>

      <Card title="Cohort cascade (the woven web)">
        At setup you declare a cohort — the M-of-N peers you trust to help
        you recover. The wallet splits the symmetric backup key (NEVER the
        signing key) via Shamir Secret Sharing and ships one piece to each
        peer, encrypted to them, either over the Mycelium network or in
        person via QR. On recovery, M peers verify it's really you
        out-of-band, release their shares, and your wallet rebuilds on a
        new device. The signing keypair is never split — peer collusion
        can decrypt one snapshot but cannot become you.
      </Card>

      <Card title="Paper recovery key">
        Settings → Local backup exposes the symmetric backup key as a 64-
        character hex string you write down once and store somewhere
        physical. If you ever lose the passphrase AND the cohort can't be
        reached, type the key back in on the lock screen and the wallet
        restores under a new passphrase. The cohort's existing shares stay
        valid — both paths coexist forever.
      </Card>

      <Card title="Encrypted backup file">
        Settings → Local backup also offers a download of the wallet
        encrypted under your passphrase. Useful when you've still got the
        passphrase but the device died — copy the file to the new device,
        install the wallet, restore. Less powerful than the other two
        because it still requires the passphrase to decrypt.
      </Card>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="text-sm font-semibold text-ink">A floor everyone hits</div>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          All three recovery paths assume your cloud backup is on the new
          device — that only happens if cloud sync was on. If you kept
          everything local and the device is gone, the encrypted backup
          file is the only path back, and you still need the passphrase
          to decrypt it. The cohort cascade and paper key both decrypt
          the cloud blob; without that blob there is nothing to restore
          into.
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Recovery actions appear on the lock screen when there's a stored
        wallet to recover into — sign in first, then "Lost your passphrase?"
        plus "Or use your written-down recovery key" both appear below the
        passphrase prompt.
      </p>
    </section>
  );
}

// ============================================================
// Tab 4 — Sovereignty
// ============================================================

function Sovereignty() {
  return (
    <section>
      <SectionTitle>A spectrum, not a switch.</SectionTitle>
      <Lede>
        The wallet is built so you can run it as lazy or as sovereign as you
        want. Every cryptographic primitive already runs on your device —
        signing, encryption, OpenTimestamps anchoring, Mycelium peer
        connections — and the pieces that touch outside infrastructure are
        either optional today or on the roadmap. Four gradations are useful
        to name.
      </Lede>

      <Card title="Connected (today's default)">
        Email + 6-digit code login. Encrypted blob mirrored to Tapit's
        cloud backup so a new phone can pick up where the old one left off.
        Mycelium uses the default relay set. The cohort cascade and the
        paper recovery key both work. Easiest UX, least work for you.
      </Card>

      <Card title="Connected but private">
        Same login as above, but flip Settings → Cloud backup OFF. Your
        encrypted blob lives only in IndexedDB on this device. The host
        sees only that you have an account — no ciphertext, no holdings,
        no metadata. Continuity now depends on the paper recovery key or
        a downloaded encrypted-file backup. Already toggleable today.
      </Card>

      <Card title="Sovereign with cohort (roadmap)">
        No central server in the data path. Your N cohort peers each hold
        an encrypted shard of your full backup blob — same Shamir
        machinery the wallet uses today for the K_data key, scaled up to
        the whole blob. Recovery on a new device pulls M shards from M
        peers via Mycelium and reassembles. Heavier per-save (every save
        re-distributes to the cohort), but zero third-party storage.
        Custom Nostr relay support already exists in Settings; the
        peer-shard storage layer ships in a future cut.
      </Card>

      <Card title="Sovereign solo (roadmap)">
        No login, no peers, no cloud. First run picks a passphrase, the
        wallet generates and lives entirely on this phone, ownerId is a
        device-local UUID. Continuity is your paper recovery key and your
        encrypted-file backup, full stop. Strongest sovereignty, hardest
        UX — losing the device with no backup means the wallet is gone.
        For the operator who wants the strictest version of "no
        third-party dependencies."
      </Card>

      <div className="mt-6 rounded-xl border border-ink/15 bg-paper/70 p-4">
        <div className="text-sm font-semibold text-ink">
          What you can already do
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink/75">
          Settings exposes the levers that already shift the wallet
          toward sovereign today: turn off cloud backup, point Mycelium
          at your own Nostr relays, declare a recovery cohort of people
          you trust, reveal your recovery key and write it down. Each of
          those independently reduces your dependence on outside
          infrastructure. The OpenTimestamps anchoring layer already
          runs against free public calendars no one controls — that's
          Bitcoin doing the timestamp work, not us.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">
          What's coming: a no-login first-run picker, an opt-in
          peer-shard storage layer so cohort recovery works without any
          cloud blob, custom OpenTimestamps calendar server URLs so you
          can use your own bitcoind plus your own calendar instance for
          the full sovereign-anchor loop, and a custom remote-backup
          endpoint so an operator running their own server (an
          increasingly common shape — many sovereign users already run
          their own Bitcoin node and could run a tiny blob-storage
          endpoint alongside) can point the wallet at it. None of these
          require new cryptography; they're transport choices over the
          primitives already shipped.
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted">
        The lazy and the sovereign are the same wallet at different
        settings. You can start lazy and move sovereign one toggle at a
        time, or first-run straight into sovereign once that picker
        ships. The cryptographic core never changes — only what
        infrastructure the wallet asks of anyone else.
      </p>
    </section>
  );
}

// ============================================================
// Tab 5 — Account
// ============================================================

type AuthStep = 'email' | 'code';
type AuthStatus = 'idle' | 'busy' | 'error';

function Account() {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <section className="py-6 text-center text-sm text-muted">
        Checking your session…
      </section>
    );
  }

  if (session.status === 'signed-in') {
    return <SignedInAccount email={session.session?.user.email ?? null} />;
  }

  return <SignInForm />;
}

function SignedInAccount({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function doSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    const { error } = await supabase().auth.signOut();
    if (error) {
      setSignOutError(error.message);
      setSigningOut(false);
    }
    // On success the session change fires onAuthStateChange and the
    // surface re-renders into the signed-out form.
  }

  return (
    <section>
      <SectionTitle>You're signed in.</SectionTitle>
      <Lede>
        {email
          ? `Signed in as ${email}. Your wallet's keypair and attestations live on this device, encrypted under your passphrase.`
          : "Your wallet's keypair and attestations live on this device, encrypted under your passphrase."}
      </Lede>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          to="/"
          className="rounded-xl bg-gradient-to-b from-accent to-[#22503b] py-3 text-center font-medium text-paper shadow-lg shadow-accent/30 transition active:scale-[0.99]"
        >
          Back to wallet
        </Link>
        <button
          type="button"
          onClick={() => void doSignOut()}
          disabled={signingOut}
          className="rounded-xl border border-ink/15 bg-white py-3 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-40"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
      {signOutError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {signOutError}
        </p>
      )}

      <p className="mt-5 text-xs leading-relaxed text-muted">
        Signing out clears the Supabase session on this device. Your
        wallet's encrypted snapshot stays in IndexedDB and in cloud backup
        — signing back in restores everything and the wallet asks for your
        passphrase to unlock.
      </p>
    </section>
  );
}

function SignInForm() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function sendCode(targetEmail: string) {
    setStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setStatus('error');
      setError(err.message);
      return false;
    }
    setStatus('idle');
    return true;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const ok = await sendCode(email.trim());
    if (ok) setStep('code');
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setStatus('error');
      setError(err.message);
      return;
    }
  }

  async function resend() {
    const ok = await sendCode(email.trim());
    if (ok) {
      setResent(true);
      setTimeout(() => setResent(false), 2500);
    }
  }

  if (step === 'code') {
    return (
      <section>
        <SectionTitle>Enter your code.</SectionTitle>
        <Lede>
          We emailed a 6-digit code to{' '}
          <span className="font-medium text-ink">{email}</span>. Type it here
          to finish signing in.
        </Lede>
        <form onSubmit={submitCode} className="mt-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">6-digit code</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper/70 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-ink focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/15"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'busy' || code.trim().length === 0}
            className="mt-5 w-full rounded-xl bg-gradient-to-b from-accent to-[#22503b] py-3.5 font-medium text-paper shadow-lg shadow-accent/30 transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
          >
            {status === 'busy' ? 'Verifying…' : 'Verify & sign in'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className="my-6 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="text-muted transition hover:text-ink"
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={status === 'busy'}
            className="font-medium text-accent transition hover:underline disabled:opacity-40"
          >
            {resent ? 'Code resent' : 'Resend code'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>Sign in.</SectionTitle>
      <Lede>
        We email you a 6-digit code to sign in. Your keypair is generated
        and held only on this device — never on the host.
      </Lede>
      <form onSubmit={submitEmail} className="mt-5">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper/70 px-3.5 py-2.5 text-base text-ink focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/15"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'busy' || email.trim().length === 0}
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-accent to-[#22503b] py-3.5 font-medium text-paper shadow-lg shadow-accent/30 transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
        >
          {status === 'busy' ? 'Sending…' : 'Send my code'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
