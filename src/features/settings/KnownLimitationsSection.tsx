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
            standalone mode restricts camera access in ways the wallet can't
            work around. The scanner falls back to a paste field. Easiest
            workaround: open the iPhone Camera app on the other phone, point
            it at the QR, tap the link/text it picks up to copy, then paste
            into the wallet. Camera scanning works normally in regular Safari
            tabs and on Android.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">Face ID unlock not yet built</div>
          <p className="mt-1 text-xs text-muted">
            The wallet still requires your passphrase at every unlock.
            Biometric unlock is on the roadmap (Phase 7+) but deferred until
            the cross-device recovery story is fully shipped — biometrics
            are per-device and can't replace the passphrase as a recovery
            primitive. Face ID is already used inside the wallet for
            device-verified presence (Tier V), just not for unlock yet.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Recovery from a lost device requires preparation
          </div>
          <p className="mt-1 text-xs text-muted">
            To recover this wallet on a new device using your cohort, the
            wallet must have had cloud backup turned on AND a recovery
            cohort declared AND shares distributed to the cohort BEFORE the
            loss. The cohort cascade can't reach back in time. If none of
            that was set up, the only path back is the original passphrase
            plus the original device or a downloaded local backup file.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Peer-witnessed recovery succession is not yet wired
          </div>
          <p className="mt-1 text-xs text-muted">
            After a successful cohort recovery the spec calls for M cohort
            peers to co-sign a peer-witnessed succession event asserting
            the recovery happened. That ceremony is the last remaining
            Phase 5e piece and lands in its own session. The recovered
            wallet works correctly without it; the succession event is a
            third-party audit trail rather than a functional requirement.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">
            Recovery requires the cloud backup to be on this device
          </div>
          <p className="mt-1 text-xs text-muted">
            Both recovery paths — cohort cascade and recovery key —
            decrypt the cloud-mirrored backup blob, which only reaches a
            new device if cloud sync was on. If cloud sync was off and
            the original device is gone, the local-backup file download
            plus your passphrase is the only path back.
          </p>
        </div>
      </div>
    </section>
  );
}
