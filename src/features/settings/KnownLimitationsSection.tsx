// Known limitations — honest user-facing warnings about things the
// wallet does NOT yet do, or does only in a partial way the operator
// should know about before they need it. Plain language, no jargon.
// Updated as things change.
//
// Extracted from SettingsScreen.tsx 2026-05-24 to keep that file
// under the 800-line hard limit per CLAUDE_ROOT.md.

export function KnownLimitationsSection() {
  return (
    <section className="mt-4 rounded-2xl bg-amber-50/40 border border-amber-200 p-5">
      <div className="font-medium">Known limitations</div>
      <p className="mt-1 text-sm text-muted">
        Things the wallet does not do yet, or does only in a partial way.
        Knowing them up front saves frustration later.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <div className="text-sm font-medium">
            QR scanner may not open the camera on installed iPhone PWA
          </div>
          <p className="mt-1 text-xs text-muted">
            When the wallet is installed to your iPhone home screen, Safari's
            standalone mode can make the live-video camera path unreliable in
            ways the wallet can't fully work around. The scanner always
            attempts the live camera first, on every platform — if it can't
            start, use "Paste from clipboard" or paste the text manually as
            the fallback (no photo-capture substitute; a live scan is either
            what you get or you paste). Opening the wallet in Safari instead
            of from the home screen restores the reliable live camera if
            you'd rather use that. Camera scanning works normally in regular
            Safari tabs and on Android either way.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">Face ID unlock not yet built</div>
          <p className="mt-1 text-xs text-muted">
            Face ID can unlock the wallet and confirm signatures (Settings,
            Security &amp; access), but only on the device where you turned it
            on. It opens a copy of your passphrase sealed on that device; it
            can&apos;t replace the passphrase, which is still what opens a
            backup file on a new device.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Recovery from a lost device requires preparation
          </div>
          <p className="mt-1 text-xs text-muted">
            The only way to bring this wallet back on a new device is a backup
            file you downloaded before the loss, plus your passphrase. Nothing
            is kept on a server, so if neither a backup file nor the original
            device survives, the wallet cannot be restored by anyone.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Peer co-signs of the recovery-succession event not yet wired
          </div>
          <p className="mt-1 text-xs text-muted">
            After a successful cohort recovery the wallet now automatically
            emits a self-signed recovery-succession credential — the
            audit-trail record asserting "I was recovered on date X from
            this cohort," signed by the restored wallet and time-anchored
            to Bitcoin like every other envelope. What's still deferred is
            the M cohort peer co-signs the spec calls for, which turn that
            self-attestation into a peer-witnessed succession event for
            third-party verification. The peer co-sign UI rides on the
            existing mergeSignatures machinery and lands in its own
            session. The self-attested record stands on its own
            cryptographically; the peer-witnessed upgrade strengthens it
            into a third-party-checkable claim.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Trusted helpers and the recovery key work on this device only
          </div>
          <p className="mt-1 text-xs text-muted">
            Both forgotten-passphrase paths — trusted helpers and the recovery
            key — open the copy of the wallet saved on this device. They
            can&apos;t open a backup file, which needs the passphrase. Keep the
            passphrase, and keep a recent backup file somewhere other than
            this device.
          </p>
        </div>
      </div>
    </section>
  );
}
