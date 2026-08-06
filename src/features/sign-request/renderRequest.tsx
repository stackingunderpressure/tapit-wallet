import { parsePsbt, toHex } from '@dynastytrust/bip341-psbt-signer';
import type { SignRequest } from './types.ts';

interface Props {
  request: SignRequest;
}

// Per-kind plain-English render of what's being signed. The
// approval screen is the product (DESIGN.md §9) — never a JSON
// dump, never hex blobs. A non-technical user sees the gist of
// what they would be committing to and can decide informedly.
//
// Each kind has a template that surfaces the most user-relevant
// fields by name; anything else in the fields object is shown
// at the bottom as additional details.

const FIELD_KEYS_PROMINENT: Record<string, string[]> = {
  identity: ['display_name', 'pubkey'],
  relationship: ['with', 'relationship_kind', 'since'],
  credential: ['name', 'issuer', 'issued_at', 'expires_at'],
  prediction: ['outcome', 'about', 'window'],
  agreement: ['terms', 'parties', 'effective_at'],
  journal: ['text', 'category'],
  meta: ['action', 'about'],
};

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return undefined;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function RenderRequest({ request }: Props) {
  // sign-in — the wallet answers a one-time login challenge to prove the user
  // controls their key. Nothing is created, nothing is held, no funds move;
  // only the public key and a signature travel. The banner says exactly that,
  // in plain language, because the screen IS the product.
  if (request.intent === 'sign-in') {
    return (
      <div className="rounded-md border border-ink/15 bg-paper p-4">
        <p className="text-sm">
          <span className="font-medium">{request.origin}</span> is asking you to{' '}
          sign in to <span className="font-medium">{request.challenge.audience}</span>{' '}
          and prove you control this key.
        </p>
        <div className="mt-3 text-xs uppercase tracking-wide text-muted">
          What this does
        </div>
        <div className="mt-1 text-sm">
          This signs a one-time login challenge from{' '}
          <span className="font-mono break-words">{hostOf(request.callback)}</span>.
          It does NOT move any funds and creates no new record.
        </div>
        <div className="mt-3 text-xs text-muted">
          You share only your public key and a signature. Your private key never
          leaves this device.
        </div>
      </div>
    );
  }

  // psbt-cosign — Cut B, the DynastyTrust signing bridge. This is NOT an
  // attestation; it's a real Bitcoin tapscript signature over a real
  // spend. Everything security-relevant shown here (amount, destination,
  // whether there's a timelock) is read straight out of psbt_hex's own
  // bytes, never from vault_context's requester-supplied label — the
  // banner shows the meaning, and the meaning has to be the true one.
  // parsePsbt already succeeded (parseSignRequest validated it before
  // this screen could render), so this re-parse cannot throw here.
  if (request.intent === 'psbt-cosign') {
    const parsed = parsePsbt(request.psbt_hex);
    const totalOut = parsed.tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
    const hasTimelock = parsed.tx.locktime > 0;
    return (
      <div className="rounded-md border border-ink/15 bg-paper p-4">
        <p className="text-sm">
          <span className="font-medium">{request.origin}</span> is asking you
          to sign a Bitcoin vault transaction
          {request.vault_context.vault_name
            ? ` for "${request.vault_context.vault_name}"`
            : ''}
          .
        </p>
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          This moves real Bitcoin. Everything below is read directly from the
          transaction itself, not from what the requester claims.
        </div>
        <div className="mt-3 text-xs uppercase tracking-wide text-muted">
          Sending (verified from the transaction)
        </div>
        <div className="mt-1 text-sm font-medium">
          {totalOut.toLocaleString()} sats total, {parsed.tx.outputs.length}{' '}
          output{parsed.tx.outputs.length === 1 ? '' : 's'}
        </div>
        <dl className="mt-1 space-y-1">
          {parsed.tx.outputs.map((o, i) => (
            <div key={i} className="text-sm">
              <span className="text-muted">{o.amount.toLocaleString()} sats to script: </span>
              <span className="font-mono break-all text-xs">{toHex(o.scriptPubkey)}</span>
            </div>
          ))}
        </dl>
        <div className="mt-3 text-xs uppercase tracking-wide text-muted">
          Timelock
        </div>
        <div className="mt-1 text-sm">
          {hasTimelock
            ? `This transaction cannot confirm before block height ${parsed.tx.locktime} — a timelocked path (e.g. recovery or inheritance).`
            : 'No timelock — this is an immediate spend.'}
        </div>
        <div className="mt-3 text-xs text-muted">
          Vault (as claimed by the requester, not independently verifiable
          from the transaction bytes alone):{' '}
          <span className="font-mono break-all">
            {request.vault_context.vault_descriptor}
          </span>
        </div>
      </div>
    );
  }

  // cosign-existing — the wallet is adding its signature to an envelope
  // someone else already signed. Show what it is and who already signed it;
  // the record itself does not change, only a signature is added.
  if (request.intent === 'cosign-existing') {
    const env = request.envelope;
    const signers = env.signatures.length;
    return (
      <div className="rounded-md border border-ink/15 bg-paper p-4">
        <p className="text-sm">
          <span className="font-medium">{request.origin}</span> is asking you to{' '}
          co-sign a <span className="font-medium">{env.kind}</span>{' '}
          {signers === 1 ? 'already signed by 1 person' : `already signed by ${signers} people`}.
        </p>
        <div className="mt-3 text-xs uppercase tracking-wide text-muted">
          Subject
        </div>
        <div className="mt-1 text-sm font-medium break-words">{env.subject}</div>
        <div className="mt-3 text-xs text-muted">
          Adding your signature confirms you agree to this exact record. The
          record itself doesn't change — only your name is added to it.
        </div>
      </div>
    );
  }

  const prominent = FIELD_KEYS_PROMINENT[request.kind] ?? [];
  const prominentEntries = prominent
    .map((k) => [k, request.fields[k]] as const)
    .filter(([, v]) => v !== undefined);
  const otherEntries = Object.entries(request.fields).filter(
    ([k]) => !prominent.includes(k),
  );

  const kindSentence: Record<string, string> = {
    identity: `confirm your identity`,
    relationship: `record a relationship`,
    credential: `record that you earned a credential`,
    prediction: `record a prediction about the future`,
    agreement: `enter into a multi-party agreement`,
    journal: `sign a journal entry`,
    meta: `record a control event (revocation, succession, or similar)`,
  };

  return (
    <div className="rounded-md border border-ink/15 bg-paper p-4">
      <p className="text-sm">
        <span className="font-medium">{request.origin}</span> is asking you to{' '}
        {kindSentence[request.kind] ?? 'sign an attestation'}.
      </p>
      <div className="mt-3 text-xs uppercase tracking-wide text-muted">
        Subject
      </div>
      <div className="mt-1 text-sm font-medium break-words">{request.subject}</div>
      {prominentEntries.length > 0 && (
        <>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Details
          </div>
          <dl className="mt-1 space-y-1">
            {prominentEntries.map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-muted">{k.replace(/_/g, ' ')}: </span>
                <span className="break-words">{asString(v)}</span>
              </div>
            ))}
          </dl>
        </>
      )}
      {otherEntries.length > 0 && (
        <>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Other fields
          </div>
          <dl className="mt-1 space-y-1">
            {otherEntries.map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-muted">{k.replace(/_/g, ' ')}: </span>
                <span className="break-words">{asString(v)}</span>
              </div>
            ))}
          </dl>
        </>
      )}
      <div className="mt-3 text-xs text-muted">
        Tier <span className="font-mono">{request.tier}</span>
      </div>
    </div>
  );
}
