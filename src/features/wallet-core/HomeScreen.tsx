import { useWallet } from './useWallet.ts';
import { IdentityCard } from './IdentityCard.tsx';
import { supabase } from '../../shared/lib/supabase.ts';

export function HomeScreen() {
  const { wallet } = useWallet();

  async function signOut() {
    await supabase().auth.signOut();
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-lg font-semibold">Tapit Wallet</h1>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-muted hover:text-ink"
        >
          Sign out
        </button>
      </header>
      <section className="mt-4">
        <IdentityCard publicKey={wallet.publicKey} />
      </section>
      <p className="mt-6 text-xs text-muted">
        Your keypair lives on this device, encrypted. The host stores only
        ciphertext. Phase 2 adds your first signed identity attestation and
        backup posture.
      </p>
    </div>
  );
}
