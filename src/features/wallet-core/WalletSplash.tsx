// The two pre-unlock full-screen splash states the WalletProvider shows
// while it figures out which phase to render: a plain "loading" while it
// reads the stored blob, and the Fresh aurora "signing your first entry"
// while the onboarding-setup effect mints the wallet. Extracted from
// WalletProvider purely to keep that file under the 800-line hard limit;
// these are static presentational screens with no provider state.

export function WalletLoadingSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
      Loading your wallet…
    </div>
  );
}

export function WalletOnboardingSplash() {
  return (
    <div className="relative min-h-screen overflow-hidden fresh-aurora-bg flex items-center justify-center px-6">
      <div className="text-center animate-fresh-rise motion-reduce:animate-none">
        <p className="text-fresh-title font-fresh-display text-fresh-text-primary">
          Signing your first entry…
        </p>
        <p className="mt-3 text-sm text-fresh-text-secondary">
          Generating your keypair, signing your founding declaration, and
          anchoring your first moment to Bitcoin.
        </p>
      </div>
    </div>
  );
}
