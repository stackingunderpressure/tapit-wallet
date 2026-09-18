import { useState } from 'react';
import type { MovePreview } from '../move-chain/truthScore.ts';
import { fmtCoins, fmtUsd } from './arenaShare.ts';
import { ArenaModal } from './ArenaModal.tsx';

// The one button that logs a permanent, signed move, plus its deliberate-action
// gate. Extracted from ArenaScreen when that file crossed the 800-line hard
// limit; it is a self-contained unit — the only state it owns is whether the
// confirm is open.
//
// The second line is the whole point of this component. It states what the move
// DOES, never the price of one coin: a buy-back deploys the WHOLE cash balance,
// so quoting spot here read as the cost of the trade and was off by the entire
// edge (reported live 2026-09-18 — the screen said "$80,383" for a trade that
// actually spent $81,446). The sell leg drifts the same way once a winning
// round pushes the count off 1.0. `previewMove` is the single source of both
// numbers and uses the same arithmetic the scorer replays with, so the button
// and the scoreboard above it cannot disagree.
export function ArenaAction({
  side,
  preview,
  busy,
  lastClose,
  onAct,
}: {
  side: 'sell' | 'buy';
  preview: MovePreview | null;
  busy: boolean;
  lastClose: number | null;
  onAct: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const label = side === 'sell' ? 'Sell the whole coin' : 'Buy the whole coin back';

  return (
    <>
      <button
        type="button"
        disabled={busy || !lastClose || confirming}
        onClick={() => setConfirming(true)}
        className="mt-4 w-full rounded-xl bg-accent text-white px-4 py-4 text-base font-semibold disabled:opacity-40"
      >
        <span className="block">{label}</span>
        {preview && (
          <span className="mt-0.5 block text-xs font-normal opacity-85">
            {preview.kind === 'buy'
              ? `${fmtUsd(preview.cashUsd)} → ${fmtCoins(preview.coins)} coins`
              : `${fmtCoins(preview.coins)} coins → ${fmtUsd(preview.cashUsd)}`}
            {` at ${fmtUsd(preview.price)}/coin`}
          </span>
        )}
      </button>

      {/* Deliberate-action gate — an accidental tap must not log a move. It
          repeats the preview rather than only the unit price, because this is
          the last screen before something permanent is signed. */}
      {confirming && (
        <ArenaModal onDismiss={busy ? undefined : () => setConfirming(false)}>
          <div className="font-medium">{label}?</div>
          {preview && (
            <p className="mt-1 text-sm tabular-nums">
              {preview.kind === 'buy'
                ? `${fmtUsd(preview.cashUsd)} → ${fmtCoins(preview.coins)} coins`
                : `${fmtCoins(preview.coins)} coins → ${fmtUsd(preview.cashUsd)}`}
              {` at ${fmtUsd(preview.price)}/coin`}
            </p>
          )}
          <p className="mt-1 text-sm text-muted">
            This logs a signed, permanent move at the live price
            {lastClose ? ` (${fmtUsd(lastClose)})` : ''}. It becomes part of your
            tamper-evident trail and can&apos;t be undone — only the whole run can be
            cleared. Confirm to make it deliberate.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !lastClose}
              onClick={() => {
                setConfirming(false);
                void onAct();
              }}
              className="rounded-md bg-accent text-white py-2 text-sm font-semibold disabled:opacity-40"
            >
              {side === 'sell' ? 'Yes, sell' : 'Yes, buy back'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-md border border-ink/15 bg-white py-2 text-sm font-medium disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </ArenaModal>
      )}
    </>
  );
}
