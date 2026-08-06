import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { parseSignRequest, SignRequestError } from './parseSignRequest.ts';
import { RenderRequest } from './renderRequest.tsx';
import { approveSignRequest } from './approveRequest.ts';
import { declineSignRequest } from './declineRequest.ts';
import { findVaultTrail, requiresCallbackConfirmation } from './vaultTrail.ts';
import type { SignRequest } from './types.ts';

type State =
  | { kind: 'ready'; request: SignRequest; callbackHost: string }
  | { kind: 'invalid'; code: string; detail: string; callback?: string }
  | { kind: 'busy' };

// The screen IS the product (DESIGN.md §9). Render the requesting
// origin (claimed) and the callback URL's host (actual destination)
// so the operator can sanity-check that the request is going where
// they expect. Approve / Decline — no third option, no "advanced"
// toggle, no JSON dump.
export function SignApprovalScreen() {
  const [params] = useSearchParams();
  const { wallet, ownerId, save, holdings } = useWallet();
  const worker = useAnchorWorker();
  const [state, setState] = useState<State>(() => {
    try {
      const request = parseSignRequest(params.get('req'));
      let callbackHost = '';
      try {
        callbackHost = new URL(request.callback).host;
      } catch {
        callbackHost = request.callback;
      }
      return { kind: 'ready', request, callbackHost };
    } catch (err) {
      if (err instanceof SignRequestError) {
        // No callback known if the parse failed before reading it.
        let callback: string | undefined;
        try {
          const raw = params.get('req');
          if (raw) {
            const decoded = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
            if (decoded && typeof decoded === 'object' && typeof decoded.callback === 'string') {
              callback = decoded.callback;
            }
          }
        } catch {
          // ignore — already an error path
        }
        return { kind: 'invalid', code: err.code, detail: err.message, callback };
      }
      throw err;
    }
  });
  const [error, setError] = useState<string | null>(null);
  // Only meaningful for intent 'psbt-cosign'. Set true only after the
  // operator affirms the out-of-band callback ritual actually happened —
  // approveSignRequest re-checks this is true whenever the spend requires
  // it, so this checkbox is a real gate, not decoration.
  const [calloutConfirmed, setCalloutConfirmed] = useState(false);

  // psbt-cosign gating (risk register: "no rogue signing" + the amount-
  // tiered callback ritual). Computed on every render from `holdings` so
  // it reflects the trail the wallet actually has right now, not a stale
  // snapshot from when the screen first mounted.
  let psbtCosignGate:
    | { kind: 'no-trail' }
    | { kind: 'ok'; requiresCallback: boolean; totalOutSats: bigint }
    | null = null;
  if (state.kind === 'ready' && state.request.intent === 'psbt-cosign') {
    const req = state.request;
    const trail = findVaultTrail(holdings, req.vault_context.vault_descriptor, wallet.publicKey);
    if (!trail) {
      psbtCosignGate = { kind: 'no-trail' };
    } else {
      const parsed = parsePsbt(req.psbt_hex);
      const totalOutSats = parsed.tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
      psbtCosignGate = {
        kind: 'ok',
        requiresCallback: requiresCallbackConfirmation(trail, totalOutSats),
        totalOutSats,
      };
    }
  }

  if (state.kind === 'invalid') {
    return (
      <div className="min-h-screen p-5 max-w-md mx-auto">
        <header className="flex items-center justify-between py-2">
          <Link to="/" className="text-sm text-muted hover:text-ink">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold">Sign request</h1>
          <span className="w-12" aria-hidden />
        </header>
        <section className="mt-6 rounded-2xl bg-white border border-amber-200 p-5 shadow-sm">
          <p className="text-sm font-medium">Cannot sign — request is malformed.</p>
          <p className="mt-2 text-xs text-muted">{state.detail}</p>
          <p className="mt-3 text-xs text-muted">Code: {state.code}</p>
          {state.callback && (
            <button
              type="button"
              onClick={() =>
                declineSignRequest({ callback: state.callback! }, 'invalid_request', state.detail)
              }
              className="mt-4 w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
            >
              Return error to caller
            </button>
          )}
        </section>
      </div>
    );
  }

  async function approve() {
    if (state.kind !== 'ready') return;
    if (psbtCosignGate?.kind === 'no-trail') return;
    if (psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && !calloutConfirmed) return;
    setError(null);
    setState({ kind: 'busy' });
    try {
      await save(); // make sure prior changes are persisted
      await approveSignRequest(
        wallet,
        ownerId,
        state.request,
        async () => {
          await save();
        },
        worker,
        calloutConfirmed,
      );
      // approveSignRequest navigates via window.location; component unmounts.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign.');
      setState({ kind: 'ready', request: state.request, callbackHost: state.callbackHost });
    }
  }

  function decline() {
    if (state.kind !== 'ready') return;
    declineSignRequest(state.request, 'user_declined');
  }

  if (state.kind === 'busy') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
        Signing…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Home
        </Link>
        <h1 className="text-lg font-semibold">Sign request</h1>
        <span className="w-12" aria-hidden />
      </header>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <RenderRequest request={state.request} />
        <div className="mt-3 rounded-md bg-ink/5 px-3 py-2 text-xs text-muted">
          On approve you will be redirected to{' '}
          <span className="font-mono">{state.callbackHost}</span>. The wallet
          sends only the signed {state.request.intent === 'psbt-cosign' ? 'transaction' : 'envelope'};
          your keys never leave this device.
        </div>
      </section>

      {psbtCosignGate?.kind === 'no-trail' && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Cannot sign — this wallet does not recognize this vault.
          </p>
          <p className="mt-2 text-xs text-red-800">
            No verified vault-membership record for this vault is held by
            this wallet. Approving is disabled. If you believe you should be
            a signer on this vault, the vault owner needs to re-issue your
            membership.
          </p>
        </div>
      )}

      {psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-ink">
            This spend requires a live check before you sign
          </p>
          <p className="mt-2 text-xs text-ink/80">
            This amount is above your vault's threshold for extra
            verification. Contact the requester using your predetermined,
            out-of-band method (not a reply inside this app) and confirm
            it's really them, calmly and not under duress, before signing.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={calloutConfirmed}
              onChange={(e) => setCalloutConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>I verified this by phone (or our agreed method) just now.</span>
          </label>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={approve}
          disabled={
            psbtCosignGate?.kind === 'no-trail' ||
            (psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && !calloutConfirmed)
          }
          className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40"
        >
          {state.request.intent === 'cosign-existing'
            ? 'Approve — co-sign this'
            : state.request.intent === 'sign-in'
              ? 'Approve — sign in'
              : state.request.intent === 'psbt-cosign'
                ? 'Approve — sign this transaction'
                : 'Approve — sign this'}
        </button>
        <button
          type="button"
          onClick={decline}
          className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5"
        >
          Decline
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
