import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { envelopeId, type Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import { verifyMoveChain } from '../move-chain/moveChain.ts';
import { readWholeCoinMoves, simulateWholeCoin } from '../move-chain/truthScore.ts';
import {
  DEFAULT_FRICTION_PCT,
  buildGenesisDraft,
  buildSwitchDraft,
  findArenaChain,
  headLink,
  nextSeq,
  nextSide,
} from './arenaChain.ts';

// ArenaScreen — the in-wallet prototype of Beat the HODL Machine (see
// ARENA_SPEC.md). You start a run, then sell-all / buy-all-back at a
// price, and the honest scorer races your coin count against the HODL
// ball fixed at one coin, after friction on every leg. Each move is a
// real signed move-chain attestation, held in the wallet and queued for
// a Bitcoin anchor — the live per-move anchor that fences hindsight.
//
// PROTOTYPE SEAMS (parallel work, not blockers — the screen does not
// depend on them):
//  - PRICE is entered by hand and stamped `manual`. The signed price
//    oracle (ARENA_SPEC.md) replaces this input with a verified round.
//  - GENESIS here is a local start move; the real genesis is a public
//    on-chain donation to an open-source charity whose txid roots the
//    trail. The charity txid field is optional here so the flow is
//    playable before that wiring lands.

function fmtCoins(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(6);
}
function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString();
}

export function ArenaScreen() {
  const {
    wallet,
    ownerId,
    holdings,
    anchorWorker,
    transport,
    save,
    refresh,
    unholdEnvelope,
    publishPublicNote,
  } = useWallet();

  const [price, setPrice] = useState('');
  const [charityTx, setCharityTx] = useState('');
  const [stake, setStake] = useState('');
  const [frictionStr, setFrictionStr] = useState(String(DEFAULT_FRICTION_PCT));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const chain = useMemo(
    () => findArenaChain(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const hasRun = chain.length > 0;
  const verify = useMemo(() => verifyMoveChain(chain), [chain]);
  const priceNum = Number(price);
  const priceValid = Number.isFinite(priceNum) && priceNum > 0;
  const friction = Math.max(0, Number(frictionStr) || 0);

  const score = useMemo(
    () =>
      simulateWholeCoin(readWholeCoinMoves(chain), {
        frictionPctPerLeg: friction,
        currentPrice: priceValid ? priceNum : undefined,
      }),
    [chain, friction, priceValid, priceNum],
  );
  const side = nextSide(chain);

  async function anchor(signed: Attestation) {
    const digestHex = envelopeId(signed);
    await anchorQueue.upsert(ownerId, {
      digestHex,
      state: 'queued',
      anchor: null,
      attempts: 0,
      last_attempt: null,
      last_error: null,
    });
    if (anchorWorker) void anchorWorker.kick();
  }

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const startRun = () =>
    run(async () => {
      const draft = buildGenesisDraft(wallet.identity, {
        charityTxid: charityTx.trim() || undefined,
        stakeSats: stake.trim() ? Number(stake) : undefined,
      });
      const signed = wallet.attest(draft);
      await wallet.hold(signed);
      await anchor(signed);
      await save();
      await refresh();
      setNote('Run started — you hold one whole coin.');
    });

  const makeSwitch = () =>
    run(async () => {
      if (!priceValid) throw new Error('Enter a price above zero first.');
      const draft = buildSwitchDraft(wallet.identity, {
        side,
        price: priceNum,
        seq: nextSeq(chain),
        prevHash: headLink(chain),
        priceTime: new Date().toISOString(),
        priceSource: 'manual',
      });
      const signed = wallet.attest(draft);
      await wallet.hold(signed);
      await anchor(signed);
      await save();
      await refresh();
      setNote(
        side === 'sell'
          ? `Sold the whole coin at ${fmtUsd(priceNum)}. Now in cash — buy back lower to get ahead.`
          : `Bought the whole coin back at ${fmtUsd(priceNum)}.`,
      );
    });

  const reveal = () =>
    run(async () => {
      if (!transport) throw new Error('Not connected to a relay right now.');
      const rounds = score.rounds.length;
      const text =
        `Beat the HODL — ${rounds} round${rounds === 1 ? '' : 's'}, ` +
        `${fmtCoins(score.coinsNow)} coins vs 1.0 HODL ` +
        `(${score.edgeCoins >= 0 ? '+' : ''}${fmtCoins(score.edgeCoins)}).`;
      const { publish } = await publishPublicNote(text);
      const n = publish.accepted.length;
      setNote(`Published to Nostr — ${n} relay${n === 1 ? '' : 's'} accepted.`);
    });

  const resetRun = () =>
    run(async () => {
      for (const att of chain) {
        await unholdEnvelope(envelopeId(att));
      }
      setNote('Run cleared. Start a fresh one whenever you like.');
    });

  const ahead = score.edgeCoins > 0;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-md mx-auto p-5">
        <header className="flex items-center justify-between mb-5">
          <Link to="/" className="text-sm text-muted hover:text-ink">
            ← Back
          </Link>
          <span className="text-xs text-muted">prototype</span>
        </header>

        <h1 className="text-xl font-semibold">Beat the HODL Machine</h1>
        <p className="mt-1 text-sm text-muted">
          Hold one whole coin. Sell all, buy all back. Your coin count races the
          HODL ball, fixed at 1.0, after real friction. The stamps show your
          choice; the math shows the truth.
        </p>

        {/* Scoreboard */}
        <section className="mt-5 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Your coins</div>
              <div className="text-3xl font-semibold tabular-nums">{fmtCoins(score.coinsNow)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted">HODL</div>
              <div className="text-3xl font-semibold tabular-nums text-muted">1.000000</div>
            </div>
          </div>
          <div
            className={`mt-3 text-sm font-medium ${ahead ? 'text-accent' : 'text-muted'}`}
          >
            {score.edgeCoins >= 0 ? '+' : ''}
            {fmtCoins(score.edgeCoins)} coins ({score.edgePct >= 0 ? '+' : ''}
            {score.edgePct.toFixed(2)}%) vs holding
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted">Holding: </span>
              {score.holding === 'btc' ? 'the coin' : 'cash'}
            </div>
            <div>
              <span className="text-muted">Rounds: </span>
              {score.rounds.length}
            </div>
            <div>
              <span className="text-muted">Friction paid: </span>
              {fmtCoins(score.frictionCoins)}
            </div>
            <div>
              <span className="text-muted">Chain: </span>
              {hasRun ? (verify.valid ? 'verified' : 'broken') : '—'}
            </div>
          </div>
          {score.holding === 'cash' && score.minBuyBackToBeatHodl != null && (
            <div className="mt-3 rounded-lg bg-accent/[0.06] border border-accent/30 px-3 py-2 text-sm">
              Buy back below <strong>{fmtUsd(score.minBuyBackToBeatHodl)}</strong> to beat
              the HODL ball.
            </div>
          )}
          {!score.wellFormed && (
            <div className="mt-3 text-xs text-red-600">
              A move was out of turn and was skipped — the run is not clean.
            </div>
          )}
        </section>

        {/* Price + action */}
        {hasRun ? (
          <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
            <label className="text-sm font-medium" htmlFor="arena-price">
              Current price
            </label>
            <p className="text-xs text-muted mb-2">
              Entered by hand for now — the signed price oracle replaces this with a
              verified reading.
            </p>
            <input
              id="arena-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 70000"
              className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !priceValid}
              onClick={makeSwitch}
              className="mt-3 w-full rounded-md bg-accent text-white px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              {side === 'sell' ? 'Sell the whole coin' : 'Buy the whole coin back'}
            </button>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <label htmlFor="arena-friction" className="text-muted">
                Friction %/leg
              </label>
              <input
                id="arena-friction"
                inputMode="decimal"
                value={frictionStr}
                onChange={(e) => setFrictionStr(e.target.value)}
                className="w-20 rounded-md border border-ink/15 px-2 py-1 text-sm"
              />
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
            <div className="font-medium">Start a run</div>
            <p className="mt-1 text-sm text-muted">
              The real start is a public donation to an open-source charity — the
              paid, timestamped root of your trail. In this prototype the charity
              txid is optional so you can play now.
            </p>
            <input
              inputMode="text"
              value={charityTx}
              onChange={(e) => setCharityTx(e.target.value)}
              placeholder="charity donation txid (optional)"
              className="mt-3 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
            <input
              inputMode="numeric"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="stake in sats (optional)"
              className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={startRun}
              className="mt-3 w-full rounded-md bg-accent text-white px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              Start holding one coin
            </button>
          </section>
        )}

        {hasRun && (
          <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
            <div className="text-sm font-medium">Prove it (optional)</div>
            <p className="mt-1 text-xs text-muted">
              Publish your result to Nostr when you want the record public. Losing
              runs never have to be revealed.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy || !transport}
                onClick={reveal}
                className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-40"
              >
                {transport ? 'Publish to Nostr' : 'Relay offline'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={resetRun}
                className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-40"
              >
                Clear run
              </button>
            </div>
          </section>
        )}

        {(err || note) && (
          <div
            role={err ? 'alert' : 'status'}
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              err ? 'bg-red-50 text-red-700' : 'bg-accent/[0.06] text-ink'
            }`}
          >
            {err ?? note}
          </div>
        )}
      </div>
    </div>
  );
}
