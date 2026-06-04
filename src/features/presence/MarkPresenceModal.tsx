import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import {
  assertWithPasskey,
  enrollPasskey,
  webauthnSupported,
} from './webauthn.ts';
import {
  geolocationSupported,
  requestFreshLocation,
} from './geolocation.ts';
import {
  findLatestDevicePasskey,
  holdDevicePasskey,
  holdPresenceEvent,
  readDevicePasskey,
} from './createPresence.ts';
import { leafValue } from '../connections/createHandshake.ts';

interface Props {
  onClose: () => void;
  /**
   * Sub-cut 2c mark-presence promote target — when present, the
   * captured presence event carries the peer's pubkey + display
   * name as `with_peer_*` signed leaves, and the modal copy
   * surfaces "with <peerName>" so the operator sees they're
   * marking shared company, not solo presence.
   */
  prefill?: { peerPubkey: string; peerName: string };
}

type Step =
  | { kind: 'overview' }
  | { kind: 'enrolling' }
  | { kind: 'enrolled'; passkey: Attestation }
  | { kind: 'capturing' }
  | { kind: 'done'; presence: Attestation };

// Tier V flow. First-time path: enroll a passkey on this device,
// then capture a presence event. Returning path: skip enrollment;
// existing passkey from prior session is used. The button labels
// stay plain-English; the spec's "to the best of the device's
// ability" is surfaced inline so the operator is honest with
// themselves about what Tier V proves.

export function MarkPresenceModal({ onClose, prefill }: Props) {
  const { wallet, ownerId, holdings, identity, anchorWorker, save, syncEnvelope } = useWallet();
  const existingPasskey = findLatestDevicePasskey(holdings, wallet.identity);
  const [step, setStep] = useState<Step>({ kind: 'overview' });
  const [error, setError] = useState<string | null>(null);

  const platformOk = webauthnSupported() && geolocationSupported();

  async function enroll() {
    setError(null);
    setStep({ kind: 'enrolling' });
    try {
      const displayName = identity ? leafValue(identity, 'display_name') : '';
      const enroll = await enrollPasskey(wallet.publicKey, displayName || 'Tapit Wallet');
      const passkey = await holdDevicePasskey(wallet, ownerId, anchorWorker, enroll);
      await save();
      void syncEnvelope(passkey).catch(() => undefined);
      setStep({ kind: 'enrolled', passkey });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'enrollment failed');
      setStep({ kind: 'overview' });
    }
  }

  async function capture() {
    setError(null);
    const credentialAtt = existingPasskey ?? (step.kind === 'enrolled' ? step.passkey : null);
    if (!credentialAtt) {
      setError('No passkey enrolled on this device yet.');
      return;
    }
    const view = readDevicePasskey(credentialAtt);
    setStep({ kind: 'capturing' });
    try {
      // Order matters: ask for biometric FIRST so the geolocation
      // permission prompt (if needed) doesn't appear before the user
      // has decided to engage. Both prompts are platform-modal so
      // there is no race; this is purely about flow feel.
      const assertion = await assertWithPasskey(view.credentialId);
      const location = await requestFreshLocation();
      const presence = await holdPresenceEvent(
        wallet,
        ownerId,
        anchorWorker,
        location,
        assertion,
        prefill
          ? { id: prefill.peerPubkey, name: prefill.peerName }
          : undefined,
      );
      await save();
      void syncEnvelope(presence).catch(() => undefined);
      setStep({ kind: 'done', presence });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'capture failed');
      setStep({ kind: 'overview' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {prefill
              ? `Mark presence with ${prefill.peerName || 'them'}`
              : 'Mark presence'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {!platformOk && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This browser does not support Face ID / passkeys or location.
            Marking presence needs both. Try Safari on iOS, or a recent
            Chrome / Edge with location permission.
          </div>
        )}

        {step.kind === 'overview' && platformOk && (
          <>
            <p className="mt-3 text-sm text-muted">
              Marking presence binds three things into one signed proof:
              your Face ID / passkey (so it's confirmed it was really you,
              not just whoever was holding the phone), a fresh location
              reading, and the moment in time. It's honest about its limits
              — location can be faked; this proves you confirmed it was you
              in this moment, not that the spot is impossible to spoof.
            </p>
            {!existingPasskey ? (
              <>
                <p className="mt-3 text-sm">
                  This device doesn't have a Tapit passkey yet. Step one is
                  enrollment — your phone will ask you to confirm with Face
                  ID, Touch ID, or your platform's authentication.
                </p>
                <button
                  type="button"
                  onClick={enroll}
                  className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
                >
                  Enroll a passkey on this device
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm">
                  This device has a passkey enrolled. Tap below to capture a
                  presence proof — you'll be asked to confirm with your
                  passkey, then for location permission.
                </p>
                <button
                  type="button"
                  onClick={capture}
                  className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
                >
                  Capture presence
                </button>
              </>
            )}
          </>
        )}

        {step.kind === 'enrolling' && (
          <p className="mt-4 text-sm text-muted">
            Asking your device for a passkey… follow the platform prompt.
          </p>
        )}

        {step.kind === 'enrolled' && (
          <>
            <p className="mt-3 text-sm">
              Passkey enrolled and held. You can capture a presence event
              now, or come back any time — the passkey stays on this
              device.
            </p>
            <button
              type="button"
              onClick={capture}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
            >
              Capture presence now
            </button>
          </>
        )}

        {step.kind === 'capturing' && (
          <p className="mt-4 text-sm text-muted">
            Confirm with your passkey, then accept the location prompt…
          </p>
        )}

        {step.kind === 'done' && (
          <>
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              <div className="font-medium">Presence captured.</div>
              <div className="mt-1 text-xs">
                The event is signed by your wallet and the passkey, and it
                is queued for Bitcoin anchoring. A verifier reading it sees
                "the authenticated owner's device reported being at this
                place at this time" — to the best of the device's ability.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
            >
              Done
            </button>
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
