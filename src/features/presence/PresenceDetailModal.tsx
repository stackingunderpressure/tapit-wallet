import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { readPresence, readDevicePasskey, findLatestDevicePasskey } from './createPresence.ts';
import { leafValue } from '../connections/createHandshake.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorStatus } from '../anchoring/useAnchorStatus.ts';

interface Props {
  presence: Attestation;
  holdings: readonly Attestation[];
  /** The viewing wallet's identity, used to look up the matching passkey enrollment record. */
  walletIdentity: string;
  onClose: () => void;
}

function shortKey(s: string, head = 8, tail = 4): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

// Phase 5d Tier V — presence event detail. The HomeScreen list
// shows a tiny summary; this modal shows the operator the FULL
// claim the signed envelope makes: when, where, the Face ID /
// passkey assertion that proves the device-holder authenticated,
// the wallet's signature digest, and the OpenTimestamps anchor
// status if confirmed. Plus a map link so the operator can see
// where the location reading actually was.
//
// The honest framing — "you signed your face to this location and
// moment with your key" — is surfaced as a one-liner up top so
// the cryptographic detail underneath is in context.
export function PresenceDetailModal({
  presence,
  holdings,
  walletIdentity,
  onClose,
}: Props) {
  const { ownerId, anchorWorker } = useWallet();
  const view = readPresence(presence);
  const fixedAt = view.fixedAt ? new Date(view.fixedAt) : null;
  const signedAt = view.signedAt ? new Date(view.signedAt) : null;
  const drift =
    fixedAt && signedAt
      ? Math.abs(signedAt.getTime() - fixedAt.getTime()) / 1000
      : null;

  // Look up the matching passkey enrollment record so the operator
  // can see WHEN this device's Face ID was first enrolled, not just
  // the credentialId in the abstract.
  const enrollmentAtt = findLatestDevicePasskey(holdings, walletIdentity);
  const enrollment = enrollmentAtt ? readDevicePasskey(enrollmentAtt) : null;
  const enrolledMatchesAssertion =
    enrollment && enrollment.credentialId === view.credentialId;

  const digest = envelopeId(presence);
  const lat = Number(view.latitude);
  const lon = Number(view.longitude);
  const accuracyM = Math.round(Number(view.accuracyMeters));
  const mapHref =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
      : null;

  // Read live anchor state from the queue (same hook the journal uses)
  // rather than the static anchor field on the held attestation. The
  // attestation's anchor field stays null until the worker confirms
  // AND writes the anchor back via the attach-pass in WalletProvider —
  // which can take an hour or more. The queue row reflects the live
  // state right away: queued (just submitted), pending (stamped,
  // waiting for Bitcoin confirmation), confirmed (anchor known),
  // failed (worker gave up after retries).
  const anchorRow = useAnchorStatus(ownerId, digest, anchorWorker);
  const liveState = anchorRow?.state;
  const anchorBlock =
    anchorRow?.state === 'confirmed' && anchorRow.anchor?.btcHeight
      ? anchorRow.anchor.btcHeight
      : presence.anchor?.status === 'confirmed' && presence.anchor.btcHeight
        ? presence.anchor.btcHeight
        : null;

  // WebAuthn assertion materials live as leaves on the envelope
  // (set by holdPresenceEvent). Surfaced collapsibly for the
  // technically curious — a verifier with the device-passkey
  // enrollment's public key can independently check the assertion.
  const authenticatorData = leafValue(presence, 'passkey_authenticator_data');
  const clientData = leafValue(presence, 'passkey_client_data');
  const signature = leafValue(presence, 'passkey_signature');
  const challenge = leafValue(presence, 'passkey_challenge');

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Presence event</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          You signed your face to this location and moment with your wallet
          key. Below is the full evidence the envelope carries.
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-ink/10 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-muted">When</div>
            <div className="mt-1 text-sm font-medium">
              {signedAt ? signedAt.toLocaleString() : view.signedAt || '—'}
            </div>
            <div className="mt-1 text-xs text-muted">
              GPS fix: {fixedAt ? fixedAt.toLocaleString() : view.fixedAt || '—'}
              {drift !== null && (
                <span>
                  {' '}· drift {drift < 1 ? '<1' : Math.round(drift)}s
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md border border-ink/10 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-muted">Where</div>
            <div className="mt-1 text-sm font-mono">
              {view.latitude}, {view.longitude}
            </div>
            <div className="mt-1 text-xs text-muted">
              Accuracy ± {accuracyM} m
            </div>
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
              >
                Open in OpenStreetMap →
              </a>
            )}
          </div>

          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-900 font-semibold">
              Face ID / passkey authenticated
            </div>
            <div className="mt-1 text-sm">
              The device's authenticator signed a fresh challenge under
              user-verification = required. On iPhone that means Face ID
              succeeded; on other platforms it could be Touch ID, Windows
              Hello, or a device PIN.
            </div>
            <div className="mt-2 text-xs text-muted">
              Credential ID ·{' '}
              <span className="font-mono">{shortKey(view.credentialId, 12, 6)}</span>
            </div>
            {enrollment && (
              <div className="mt-1 text-xs text-muted">
                Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString()}
                {enrolledMatchesAssertion
                  ? ' · matches this device'
                  : ' · different device'}
              </div>
            )}
          </div>

          <div className="rounded-md border border-ink/10 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-muted">
              Wallet signature
            </div>
            <div className="mt-1 text-xs font-mono break-all">
              {shortKey(digest, 16, 8)}
            </div>
            <div className="mt-1 text-xs text-muted">
              The record's content fingerprint. A verifier with the record
              bytes recomputes this and checks the wallet's signature
              against your public key.
            </div>
            {anchorBlock !== null ? (
              <div className="mt-2 text-xs text-emerald-800">
                ⛓ Time-verified at Bitcoin block {anchorBlock}
              </div>
            ) : liveState === 'failed' ? (
              <div className="mt-2 text-xs text-red-700">
                Time-sealing is delayed — the app will keep retrying on its
                own. Your signed record stays valid in the meantime.
              </div>
            ) : liveState === 'queued' || liveState === 'pending' || liveState === undefined ? (
              <div className="mt-2 text-xs text-muted">
                ⏳ Time-sealing… this usually settles within an hour but can
                take longer if the timestamp servers are slow. Your record is
                signed and valid in the meantime.
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted">
                Not yet queued for anchoring.
              </div>
            )}
          </div>

          <details className="rounded-md border border-ink/10 bg-white p-3">
            <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted">
              Technical details
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <div>
                <div className="font-semibold">Challenge</div>
                <div className="mt-0.5 font-mono break-all text-muted">
                  {challenge || '—'}
                </div>
              </div>
              <div>
                <div className="font-semibold">Authenticator data</div>
                <div className="mt-0.5 font-mono break-all text-muted">
                  {authenticatorData || '—'}
                </div>
              </div>
              <div>
                <div className="font-semibold">Client data JSON</div>
                <div className="mt-0.5 font-mono break-all text-muted">
                  {clientData || '—'}
                </div>
              </div>
              <div>
                <div className="font-semibold">Signature</div>
                <div className="mt-0.5 font-mono break-all text-muted">
                  {signature || '—'}
                </div>
              </div>
              <p className="text-muted">
                A third party with these four fields plus the public key
                from the matching device-passkey enrollment credential can
                independently verify the WebAuthn assertion.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
