import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { parseSignRequest, SignRequestError } from './parseSignRequest.ts';
import { RenderRequest } from './renderRequest.tsx';
import { approveSignRequest } from './approveRequest.ts';
import { declineSignRequest } from './declineRequest.ts';
import { findVaultTrail, requiresCallbackConfirmation, diagnoseVaultTrail, type VaultTrailDiagnosis } from './vaultTrail.ts';
import type { SignRequest } from './types.ts';
import { diagnoseCirclePhrase, checkCirclePhrase, type PhraseCheckResult, type CirclePhraseDiagnosis } from '../circle-phrase/circlePhrase.ts';

type State =
  | { kind: 'ready'; request: SignRequest; callbackHost: string }
  | { kind: 'invalid'; code: string; detail: string; callback?: string }
  // redirectUrl is set only once approveSignRequest resolves with a
  // 'redirect' result -- see that type's own comment for why a manual
  // fallback link matters here, not just the automatic window.location.href
  // assignment.
  | { kind: 'busy'; redirectUrl?: string }
  | { kind: 'done'; message: string };

// Short enough to eyeball-compare on a phone without dumping the whole
// descriptor -- just enough of both ends to tell "these are obviously
// different" from "these look the same but aren't" (a one-character
// difference would still be visible at the edges most of the time).
function shortDescriptor(d: string): string {
  return d.length <= 40 ? d : `${d.slice(0, 24)}…${d.slice(-12)}`;
}

function noTrailExplanation(diagnosis: VaultTrailDiagnosis): string {
  switch (diagnosis.reason) {
    case 'none_held':
      return "This wallet has never accepted a membership request for any vault -- there's nothing on file to check against.";
    case 'descriptor_mismatch':
      return diagnosis.heldDescriptors && diagnosis.heldDescriptors.length > 0
        ? `This wallet holds membership for a different version of this vault (its descriptor changed, likely from a recompile since you last accepted). Held: ${diagnosis.heldDescriptors.map(shortDescriptor).join(', ')}.`
        : 'This wallet holds membership for a different version of this vault (its descriptor changed, likely from a recompile since you last accepted).';
    case 'not_signed_by_me':
      return "This wallet holds a membership record for this exact vault, but it isn't signed by any key this wallet currently recognizes as its own -- likely accepted on a different device or browser, which has entirely separate storage even for the same app.";
    case 'invalid_signature':
      return 'This wallet holds a membership record for this vault, but it failed its own signature check -- the record may be corrupted.';
  }
}

// The screen IS the product (DESIGN.md §9). Render the requesting
// origin (claimed) and the callback URL's host (actual destination)
// so the operator can sanity-check that the request is going where
// they expect. Approve / Decline — no third option, no "advanced"
// toggle, no JSON dump.
export function SignApprovalScreen() {
  const [params] = useSearchParams();
  const { wallet, ownerId, save, holdings, transport } = useWallet();
  const worker = useAnchorWorker();
  const navigate = useNavigate();
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
  // Only meaningful for intent 'psbt-cosign'. Set true only once the phrase
  // gate below (or, when no phrase pair is on file, the plain checkbox
  // fallback) confirms the out-of-band callback ritual actually happened —
  // approveSignRequest re-checks this is true whenever the spend requires
  // it, so this is a real gate, not decoration.
  const [calloutConfirmed, setCalloutConfirmed] = useState(false);

  // Phone-callback phrase gate (2026-08-08 follow-up to the amount-tiered
  // callback ritual). null while still checking whether this vault even has
  // a phrase pair on file; true/false once known. A vault with no phrase
  // pair falls back to the plain "I verified this by phone" checkbox below
  // — the phrase gate is a strengthening of that ritual, never a dead end
  // that blocks approval when nothing was ever delivered.
  const vaultDescriptor =
    state.kind === 'ready' && state.request.intent === 'psbt-cosign'
      ? state.request.vault_context.vault_descriptor
      : null;
  const vaultName =
    state.kind === 'ready' && state.request.intent === 'psbt-cosign'
      ? (state.request.vault_context.vault_name ?? '')
      : null;
  const [phraseDiagnosis, setPhraseDiagnosis] = useState<CirclePhraseDiagnosis | null>(null);
  const phraseConfigured = phraseDiagnosis === null ? null : phraseDiagnosis.status === 'configured';
  const [phraseInput, setPhraseInput] = useState('');
  const [phraseResult, setPhraseResult] = useState<PhraseCheckResult | null>(null);
  const [phraseBusy, setPhraseBusy] = useState(false);

  useEffect(() => {
    if (!vaultDescriptor || vaultName === null) return;
    let cancelled = false;
    setPhraseDiagnosis(null);
    void diagnoseCirclePhrase(vaultDescriptor, vaultName).then((d) => {
      if (!cancelled) setPhraseDiagnosis(d);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultDescriptor, vaultName]);

  async function verifyPhrase() {
    if (!vaultDescriptor || phraseInput.trim().length === 0) return;
    setPhraseBusy(true);
    try {
      const result = await checkCirclePhrase(vaultDescriptor, phraseInput);
      setPhraseResult(result);
      const confirmed = result === 'normal';
      setCalloutConfirmed(confirmed);
      if (confirmed) {
        // The whole point of this cut: a correct code signs immediately,
        // no separate Approve tap. doApprove takes the confirmation as a
        // parameter rather than reading calloutConfirmed off state, which
        // would still read false here (state hasn't re-rendered yet).
        await doApprove(true);
        return;
      }
    } finally {
      // The entered phrase never lingers past the check that consumed it.
      setPhraseInput('');
      setPhraseBusy(false);
    }
  }

  // psbt-cosign gating (risk register: "no rogue signing" + the amount-
  // tiered callback ritual). Computed on every render from `holdings` so
  // it reflects the trail the wallet actually has right now, not a stale
  // snapshot from when the screen first mounted.
  let psbtCosignGate:
    | { kind: 'no-trail'; diagnosis: VaultTrailDiagnosis }
    | { kind: 'ok'; requiresCallback: boolean; totalOutSats: bigint }
    | null = null;
  if (state.kind === 'ready' && state.request.intent === 'psbt-cosign') {
    const req = state.request;
    const trail = findVaultTrail(holdings, req.vault_context.vault_descriptor, wallet.keyHistory);
    if (!trail) {
      psbtCosignGate = {
        kind: 'no-trail',
        diagnosis: diagnoseVaultTrail(holdings, req.vault_context.vault_descriptor, wallet.keyHistory),
      };
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

  // Split out of approve() (2026-08-08, operator: "get the rolling code
  // and bam my transaction is signed in the background") so verifyPhrase
  // can trigger signing the instant a correct phrase comes back, without
  // waiting a render cycle for calloutConfirmed state to settle and
  // without a separate manual Approve tap. Takes `confirmed` as a
  // parameter rather than reading it off state for exactly that reason.
  async function doApprove(confirmed: boolean) {
    if (state.kind !== 'ready') return;
    if (psbtCosignGate?.kind === 'no-trail') return;
    if (psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && !confirmed) return;
    setError(null);
    setState({ kind: 'busy' });
    try {
      await save(); // make sure prior changes are persisted
      const result = await approveSignRequest(
        wallet,
        ownerId,
        state.request,
        async () => {
          await save();
        },
        worker,
        confirmed,
        transport,
      );
      if (result.delivered === 'nostr') {
        // Nostr-delivered requests never leave this screen at all -- there
        // is no redirect, no second device to look at, nothing but this
        // tab to tell the operator whether it worked. Show a real
        // confirmation instead of silently landing back on Home (operator,
        // 2026-08-20: "drops it right there... leaves you at tapit with no
        // confirmation. Need message banners that confirm signed").
        const message =
          state.request.intent === 'sign-in'
            ? `Signed in to ${state.request.origin}. You can go back to that app now.`
            : state.request.intent === 'psbt-cosign'
              ? 'Transaction signed and sent back.'
              : 'Sent.';
        setState({ kind: 'done', message });
        return;
      }
      // 'redirect' -- window.location.href was already set inside
      // approveSignRequest. Keep the busy screen up but now with a manual
      // fallback link (result.url), in case the browser blocked or
      // deprioritized that automatic navigation (see ApproveResult's own
      // comment) -- without this the operator was left staring at
      // "Signing…" forever with zero way forward or explanation.
      setState({ kind: 'busy', redirectUrl: result.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign.');
      setState({ kind: 'ready', request: state.request, callbackHost: state.callbackHost });
    }
  }

  async function approve() {
    await doApprove(calloutConfirmed);
  }

  function decline() {
    if (state.kind !== 'ready') return;
    const result = declineSignRequest(state.request, 'user_declined');
    if (result.delivered === 'none') navigate('/');
  }

  if (state.kind === 'busy') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted text-sm">Signing…</p>
        {state.redirectUrl && (
          <div className="max-w-xs">
            <p className="text-xs text-muted">
              Signed. If this page doesn&apos;t move on its own in a moment, tap below.
            </p>
            <a
              href={state.redirectUrl}
              className="mt-3 inline-block rounded-md bg-ink px-5 py-3 text-paper text-sm font-medium"
            >
              Continue
            </a>
          </div>
        )}
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <p className="text-base font-medium text-ink" role="status">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-2 rounded-md bg-ink px-5 py-3 text-paper text-sm font-medium"
        >
          Done
        </button>
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
          {(state.request.intent === 'psbt-cosign' || state.request.intent === 'sign-in') &&
          state.request.response_channel?.kind === 'nostr' ? (
            <>
              On approve the signed {state.request.intent === 'sign-in' ? 'proof' : 'transaction'} goes
              straight back over the network to whoever asked — nothing to redirect to, your keys
              never leave this device.
            </>
          ) : (
            <>
              On approve you will be redirected to{' '}
              <span className="font-mono">{state.callbackHost}</span>. The wallet
              sends only the signed {state.request.intent === 'psbt-cosign' ? 'transaction' : 'envelope'};
              your keys never leave this device.
            </>
          )}
        </div>
      </section>

      {psbtCosignGate?.kind === 'no-trail' && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Cannot sign — this wallet does not recognize this vault.
          </p>
          <p className="mt-2 text-xs text-red-800">
            {noTrailExplanation(psbtCosignGate.diagnosis)}
          </p>
          <p className="mt-2 text-xs text-red-800">
            Approving is disabled. If you believe you should be a signer on
            this vault, the vault owner needs to re-issue your membership.
          </p>
        </div>
      )}

      {psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && phraseResult === 'duress' && (
        <div className="mt-4 rounded-md border-2 border-red-400 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-900">
            That was the duress phrase. Do not approve this request.
          </p>
          <p className="mt-2 text-xs text-red-900">
            This wallet will not sign. Hang up if you're still on the call. Contact the other
            circle members for this vault, or the authorities, right now, using a different
            channel than this app. If the vault has a halt/pause control, the owner should use
            it now — that stops every signature on it until the circle sorts this out together.
          </p>
        </div>
      )}

      {psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && phraseResult !== 'duress' && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-ink">
            This spend requires a live check before you sign
          </p>
          <p className="mt-2 text-xs text-ink/80">
            This spend is above this vault's threshold for extra
            verification. Contact the requester using your predetermined,
            out-of-band method (not a reply inside this app) and confirm
            it's really them, calmly and not under duress, before signing.
          </p>

          {phraseConfigured === null && (
            <p className="mt-3 text-xs text-ink/60">Checking for a safety phrase on this vault…</p>
          )}

          {phraseConfigured === true && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-ink/80">
                The phrase they just told you on the call
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={phraseInput}
                  onChange={(e) => {
                    setPhraseInput(e.target.value);
                    if (phraseResult) setPhraseResult(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void verifyPhrase();
                  }}
                  disabled={phraseBusy}
                  placeholder="type the phrase"
                  className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void verifyPhrase()}
                  disabled={phraseBusy || phraseInput.trim().length === 0}
                  className="rounded-md bg-ink px-4 py-2 text-paper text-sm font-medium disabled:opacity-40"
                >
                  {phraseBusy ? 'Confirming…' : 'Confirm & sign'}
                </button>
              </div>
              {phraseResult === 'normal' && (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Phrase confirmed — signing now…
                </p>
              )}
              {phraseResult === 'no-match' && (
                <p className="mt-2 text-xs text-red-700">
                  That doesn't match. Try again, or hang up and call back on a number you know is
                  really theirs before trying again.
                </p>
              )}
              {phraseResult === 'locked' && (
                <p className="mt-2 text-xs text-red-700">
                  Too many wrong tries — locked for a few minutes. Try again shortly.
                </p>
              )}
            </div>
          )}

          {phraseDiagnosis?.status === 'stale' && (
            <p className="mt-3 rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-xs text-amber-900">
              This wallet has a safety phrase on file for a vault named
              &quot;{phraseDiagnosis.staleVaultName}&quot;, but it doesn&apos;t match this
              request&apos;s current vault — the vault was most likely recompiled since the
              phrase was set up. Ask the owner to resend it. Using plain confirmation for now.
            </p>
          )}

          {phraseConfigured === false && (
            <>
              {phraseDiagnosis?.status === 'not_configured' && (
                <p className="mt-3 text-xs text-ink/60">
                  No safety phrase is set up for this vault yet — using plain confirmation instead.
                </p>
              )}
              <label className="mt-2 flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={calloutConfirmed}
                  onChange={(e) => setCalloutConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I verified this by phone (or our agreed method) just now.</span>
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {/* 2026-08-08: when a phrase pair is on file for a callback-gated
            psbt-cosign request, entering the right phrase already signs
            (verifyPhrase -> doApprove(true), the "bam" the operator asked
            for) -- a second manual Approve button here would just be a
            redundant, confusing extra tap for the one case this cut exists
            to collapse. Every other case (sign-in, cosign-existing, a
            plain attest, or the no-phrase-pair checkbox fallback) keeps
            the explicit button unchanged. */}
        {!(psbtCosignGate?.kind === 'ok' && psbtCosignGate.requiresCallback && phraseConfigured === true) && (
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
        )}
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
