// The new-passphrase form for RecoveryInitiatorModal's `naming`
// phase — landed at the end of the recovery ceremony when the
// wallet has been reconstituted and needs a fresh passphrase to
// save under on this device. Extracted from RecoveryInitiatorModal
// 2026-05-28 so the modal stays under the 800-line hard limit.

interface Props {
  newPass: string;
  onNewPassChange: (value: string) => void;
  confirmPass: string;
  onConfirmPassChange: (value: string) => void;
  onSubmit: () => void;
}

export function RecoveryNamingStep({
  newPass,
  onNewPassChange,
  confirmPass,
  onConfirmPassChange,
  onSubmit,
}: Props) {
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Your wallet is back. Choose a new passphrase to save it under on this
        device. Your old passphrase is no longer needed.
      </p>
      <label className="mt-4 block">
        <span className="text-sm font-medium">New passphrase</span>
        <input
          type="password"
          autoComplete="new-password"
          value={newPass}
          onChange={(e) => onNewPassChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Confirm</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPass}
          onChange={(e) => onConfirmPassChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={onSubmit}
        className="mt-4 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium"
      >
        Save and unlock
      </button>
    </>
  );
}
