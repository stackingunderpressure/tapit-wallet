import type { CohortEntry } from './recoveryInitiatorTypes.ts';
import { shortKey } from './recoveryInitiatorTypes.ts';

// The cohort-entry form for RecoveryInitiatorModal's `configuring`
// phase. Extracted from RecoveryInitiatorModal 2026-05-28 so the
// modal stays under the 800-line hard limit.

interface Props {
  oldIdentity: string;
  onOldIdentityChange: (value: string) => void;
  operatorName: string;
  onOperatorNameChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  cohort: CohortEntry[];
  onUpdateCohort: (index: number, patch: Partial<CohortEntry>) => void;
  onAddCohortRow: () => void;
  onRemoveCohortRow: (index: number) => void;
  threshold: number;
  onThresholdChange: (n: number) => void;
  ceremonyPubkey: string;
  onBegin: () => void;
}

export function RecoveryConfigStep({
  oldIdentity,
  onOldIdentityChange,
  operatorName,
  onOperatorNameChange,
  message,
  onMessageChange,
  cohort,
  onUpdateCohort,
  onAddCohortRow,
  onRemoveCohortRow,
  threshold,
  onThresholdChange,
  ceremonyPubkey,
  onBegin,
}: Props) {
  const filledCohortCount = cohort.filter((c) => c.pubkey.trim()).length;

  return (
    <>
      <p className="mt-2 text-sm text-muted">
        Enter your old wallet's ID and the trusted helpers who hold pieces
        of your backup. Each one checks it's really you — a quick call or
        text — before releasing their piece. Once enough pieces come back,
        your wallet is rebuilt on this device.
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Your old wallet ID</span>
        <input
          type="text"
          value={oldIdentity}
          onChange={(e) => onOldIdentityChange(e.target.value)}
          placeholder="Paste your old wallet's public ID"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium">Your name</span>
        <input
          type="text"
          value={operatorName}
          onChange={(e) => onOperatorNameChange(e.target.value)}
          placeholder="So your helpers know who's asking"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium">Optional message</span>
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={2}
          placeholder="A note for your helpers"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </label>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Trusted helpers</span>
          <button
            type="button"
            onClick={onAddCohortRow}
            className="text-xs text-accent hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {cohort.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={c.name}
                onChange={(e) => onUpdateCohort(i, { name: e.target.value })}
                placeholder="Name"
                className="w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={c.pubkey}
                onChange={(e) => onUpdateCohort(i, { pubkey: e.target.value })}
                placeholder="their wallet ID"
                className="flex-1 min-w-0 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono focus:border-accent focus:outline-none"
              />
              {cohort.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveCohortRow(i)}
                  className="text-xs text-muted hover:text-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">How many must help</span>
        <input
          type="number"
          min={2}
          max={filledCohortCount || 2}
          value={threshold}
          onChange={(e) =>
            onThresholdChange(Math.max(2, Number(e.target.value) || 2))
          }
          className="mt-1 w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <span className="ml-2 text-xs text-muted">
          of {filledCohortCount || cohort.length} helpers
        </span>
      </label>

      <button
        type="button"
        onClick={onBegin}
        className="mt-5 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium"
      >
        Begin recovery
      </button>

      <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs text-muted">
        This device's recovery code ·{' '}
        <span className="font-mono">{shortKey(ceremonyPubkey)}</span> — read
        it to your helpers so they can confirm it's really you.
      </div>
    </>
  );
}
