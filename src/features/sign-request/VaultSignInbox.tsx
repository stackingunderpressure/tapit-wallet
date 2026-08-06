import { useEffect, useRef, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  subscribeVaultSignRequests,
  sendVaultSignResponse,
  type IncomingVaultSignRequest,
} from '../transport/vaultSignChannel.ts';
import { RenderRequest } from './renderRequest.tsx';
import { signPsbtCosign, PsbtCosignError } from './signPsbtCosign.ts';
import { findVaultTrail, requiresCallbackConfirmation } from './vaultTrail.ts';
import type { PsbtCosignSignRequest } from './types.ts';

// Cut B stage B3 — the Tapit-side receive/respond half of the async,
// offline-capable vault-cosign flow. LIVE WIRING pattern copied from
// LivenessPanel.tsx: this component reuses the SAME Mycelium transport the
// encrypted inbox + liveness ride (WalletContext.transport), subscribes only
// when that transport is live, and is a safe no-op — renders nothing — when
// it is null (locked, signed out, or the operator has not opted into the
// Mycelium network). pause_safe / removal_safe by the same reasoning.
//
// Deliberately NOT routed through SignApprovalScreen/approveRequest.ts/
// declineRequest.ts: those redirect via window.location.href to a deeplink
// callback URL, which has no meaning for a request that arrived over Nostr
// while this wallet was offline — there is no caller tab to redirect to.
// The response instead publishes back over this same channel. RenderRequest
// (the plain-English banner) and signPsbtCosign (the actual signing + every
// real security check — vault trail, known-leaf-script, callback threshold)
// are reused verbatim; only the transport differs.

/**
 * A pending request wrapped in the synthetic PsbtCosignSignRequest shape
 * RenderRequest expects. `callback: 'nostr:vault-sign'` is a sentinel, never
 * a real URL — this request is never passed to approveRequest.ts/
 * declineRequest.ts, which are the only code that reads `callback`.
 */
function toSignRequest(item: IncomingVaultSignRequest): PsbtCosignSignRequest {
  return {
    v: 1,
    intent: 'psbt-cosign',
    origin: item.payload.origin,
    callback: 'nostr:vault-sign',
    ...(item.payload.nonce ? { nonce: item.payload.nonce } : {}),
    psbt_hex: item.payload.psbt_hex,
    vault_context: {
      vault_descriptor: item.payload.vault_descriptor,
      ...(item.payload.vault_name ? { vault_name: item.payload.vault_name } : {}),
    },
  };
}

export function VaultSignInbox() {
  const { wallet, transport, holdings } = useWallet();
  const [pending, setPending] = useState<IncomingVaultSignRequest[]>([]);
  const seenEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!transport) return;
    const sub = subscribeVaultSignRequests(transport, wallet, (item) => {
      if (seenEventIds.current.has(item.eventId)) return;
      seenEventIds.current.add(item.eventId);
      setPending((prev) => [...prev, item]);
    });
    return () => sub.close();
  }, [transport, wallet]);

  if (pending.length === 0) return null;

  const current = pending[0]!;
  const request = toSignRequest(current);

  function dismiss() {
    setPending((prev) => prev.slice(1));
  }

  return (
    <VaultSignRequestCard
      key={current.eventId}
      item={current}
      request={request}
      holdings={holdings}
      onDone={dismiss}
    />
  );
}

interface CardProps {
  item: IncomingVaultSignRequest;
  request: PsbtCosignSignRequest;
  holdings: Attestation[];
  onDone: () => void;
}

function VaultSignRequestCard({ item, request, holdings, onDone }: CardProps) {
  const { wallet, transport } = useWallet();
  const [calloutConfirmed, setCalloutConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trail = findVaultTrail(holdings, request.vault_context.vault_descriptor, wallet.publicKey);
  let gate: { kind: 'no-trail' } | { kind: 'ok'; requiresCallback: boolean };
  if (!trail) {
    gate = { kind: 'no-trail' };
  } else {
    const parsed = parsePsbt(request.psbt_hex);
    const totalOutSats = parsed.tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
    gate = { kind: 'ok', requiresCallback: requiresCallbackConfirmation(trail, totalOutSats) };
  }

  async function respond(response: Parameters<typeof sendVaultSignResponse>[1]) {
    if (!transport) return;
    await sendVaultSignResponse(transport, response, item.requesterPubkey, wallet);
  }

  async function approve() {
    if (gate.kind === 'no-trail') return;
    if (gate.kind === 'ok' && gate.requiresCallback && !calloutConfirmed) return;
    setBusy(true);
    setError(null);
    try {
      const signedHex = signPsbtCosign(wallet, holdings, request, calloutConfirmed);
      await respond({
        v: 1,
        ok: true,
        ...(request.nonce ? { nonce: request.nonce } : {}),
        psbt_hex: signedHex,
      });
      onDone();
    } catch (err) {
      const reason = err instanceof PsbtCosignError ? err.code : 'invalid_request';
      setError(err instanceof Error ? err.message : 'Could not sign.');
      // Only report a decline back to the requester for a definitive
      // refusal, not a transient bug in this screen — no_vault_trail and
      // unknown_leaf_script are definitive; report them so the requester's
      // UI stops waiting instead of timing out silently.
      if (err instanceof PsbtCosignError) {
        await respond({
          v: 1,
          ok: false,
          ...(request.nonce ? { nonce: request.nonce } : {}),
          reason,
          detail: err.message,
        }).catch(() => {
          // Best-effort — if the response itself fails to send, the
          // requester simply times out; do not compound the error.
        });
      }
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    await respond({
      v: 1,
      ok: false,
      ...(request.nonce ? { nonce: request.nonce } : {}),
      reason: 'user_declined',
    }).catch(() => {});
    onDone();
  }

  return (
    <div className="rounded-2xl bg-white border border-amber-300 p-5 shadow-sm mb-4">
      <p className="text-xs uppercase tracking-wide text-amber-700 font-medium mb-2">
        Bitcoin signature requested
      </p>
      <RenderRequest request={request} />

      {gate.kind === 'no-trail' && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">
            Cannot sign — this wallet does not recognize this vault.
          </p>
          <p className="mt-2 text-xs text-red-800">
            No verified vault-membership record for this vault is held by this
            wallet. If you believe you should be a signer on this vault, the
            vault owner needs to re-issue your membership.
          </p>
        </div>
      )}

      {gate.kind === 'ok' && gate.requiresCallback && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-ink">
            This spend requires a live check before you sign
          </p>
          <p className="mt-2 text-xs text-ink/80">
            This amount is above your vault's threshold for extra
            verification. Contact the requester using your predetermined,
            out-of-band method (not a reply inside this app) and confirm it's
            really them, calmly and not under duress, before signing.
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
            busy ||
            gate.kind === 'no-trail' ||
            (gate.kind === 'ok' && gate.requiresCallback && !calloutConfirmed)
          }
          className="w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Signing…' : 'Approve — sign this transaction'}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={busy}
          className="w-full rounded-md border border-ink/15 px-4 py-3 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
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
