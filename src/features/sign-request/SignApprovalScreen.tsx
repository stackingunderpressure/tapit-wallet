import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { parseSignRequest, SignRequestError } from './parseSignRequest.ts';
import { RenderRequest } from './renderRequest.tsx';
import { approveSignRequest } from './approveRequest.ts';
import { declineSignRequest } from './declineRequest.ts';
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
  const { wallet, ownerId, save } = useWallet();
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
    setError(null);
    setState({ kind: 'busy' });
    try {
      await save(); // make sure prior changes are persisted
      await approveSignRequest(wallet, ownerId, state.request, async () => {
        await save();
      }, worker);
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
          sends only the signed result; your keys never leave this device.
        </div>
      </section>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={approve}
          className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
        >
          {state.request.intent === 'cosign-existing'
            ? 'Approve — co-sign this'
            : state.request.intent === 'sign-in'
              ? 'Approve — sign in'
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
