import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { envelopeId, type Attestation } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { arenaOracle } from '../../shared/lib/env.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import { verifyMoveChain, readMoveMeta } from '../move-chain/moveChain.ts';
import { readWholeCoinMoves, simulateWholeCoin } from '../move-chain/truthScore.ts';
import { fetchSignedRound, type SignedPriceRound } from './priceRound.ts';
import { useBtcCandles, type CandleInterval } from './useBtcCandles.ts';
import type { StoneMarker } from './ArenaChart.tsx';

// Lazy so lightweight-charts (~45KB gz) loads as its own deferred chunk only
// when the chart actually renders, keeping the arena screen chunk lean.
const ArenaChart = lazy(() => import('./ArenaChart.tsx'));
import {
  DEFAULT_FRICTION_PCT,
  buildGenesisDraft,
  buildSwitchDraft,
  findArenaChain,
  headLink,
  nextSeq,
  nextSide,
} from './arenaChain.ts';

// ArenaScreen — Beat the HODL Machine (ARENA_SPEC.md), copied in look and feel
// from WealthStrategy's Stones lab: a real TradingView candle chart of the
// chosen timeframe, your sell/buy pins drawn on it, and the honest scorer
// racing your coin count against the HODL ball fixed at 1.0 after a fixed
// 2%-round-trip cost. The price is the market's, read from the candle feed —
// never hand-typed. When an oracle is configured a move executes at a signed,
// verified price for the on-chain proof; otherwise at the live candle close.

const ORANGE = '#F7931A';
const INTERVALS: CandleInterval[] = ['1h', '4h', '1d', '1w'];

function fmtCoins(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(6);
}
function fmtUsd(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString();
}
// Sats view, copied from WealthStrategy's Stones scoreboard: 1 coin =
// 100,000,000 sats, shown as a big tangible integer so "how far behind HODL"
// reads as a concrete number, not a fraction.
const SATS = 100_000_000;
function fmtSats(coins: number): string {
  if (!Number.isFinite(coins)) return '—';
  return Math.round(coins * SATS).toLocaleString() + ' sats';
}
function fmtSatsSigned(coins: number): string {
  if (!Number.isFinite(coins)) return '—';
  return (coins >= 0 ? '+' : '') + fmtSats(coins);
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

  const oracle = useMemo(() => arenaOracle(), []);
  const friction = DEFAULT_FRICTION_PCT; // 1%/leg = 2% round trip, applied silently

  const [interval, setInterval] = useState<CandleInterval>('4h');
  // Poll the candle feed every 30s so the live price keeps moving on its own;
  // reload() is the manual tap-to-refresh.
  const { candles, lastClose, loading, reload } = useBtcCandles(interval, undefined, {
    refreshMs: 30_000,
  });
  const [charityTx, setCharityTx] = useState('');
  const [stake, setStake] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const chain = useMemo(
    () => findArenaChain(holdings, wallet.identity),
    [holdings, wallet.identity],
  );
  const hasRun = chain.length > 0;
  const verify = useMemo(() => verifyMoveChain(chain), [chain]);
  const markPrice = lastClose ?? undefined;

  const score = useMemo(
    () =>
      simulateWholeCoin(readWholeCoinMoves(chain), {
        frictionPctPerLeg: friction,
        currentPrice: markPrice,
      }),
    [chain, friction, markPrice],
  );
  const side = nextSide(chain);

  // Buy/sell pins on the chart, built from the signed move chain.
  const markers = useMemo<StoneMarker[]>(() => {
    const out: StoneMarker[] = [];
    for (const att of chain) {
      const meta = readMoveMeta(att);
      if (!meta) continue;
      const kind = meta.payload.kind;
      if (kind !== 'sell' && kind !== 'buy') continue;
      const t = Date.parse(String(meta.payload.price_time ?? ''));
      if (!Number.isFinite(t)) continue;
      out.push({ time: t, side: kind, label: fmtUsd(Number(meta.payload.price)) });
    }
    return out;
  }, [chain]);

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

  // Execute the next legal move at the current market price. When an oracle is
  // configured the price is a freshly signed, verified round (the on-chain
  // proof); otherwise it's the live candle close.
  const act = () =>
    run(async () => {
      const market = lastClose && lastClose > 0 ? lastClose : null;
      let usePrice: number | null = market;
      let usedRound: SignedPriceRound | undefined;
      // The oracle is a BEST-EFFORT proof layer: if it's configured and
      // reachable, execute at its signed, verified price; if it's unset or
      // failing, fall back to the live market price so a move NEVER breaks.
      if (oracle) {
        try {
          const r = await fetchSignedRound(oracle.url, oracle.pubkey);
          usePrice = r.price;
          usedRound = r;
        } catch {
          usedRound = undefined; // oracle down — quietly use the market price
        }
      }
      if (!usePrice || usePrice <= 0) {
        throw new Error('No live price yet — give the chart a second to load.');
      }
      const draft = buildSwitchDraft(wallet.identity, {
        side,
        price: usePrice,
        seq: nextSeq(chain),
        prevHash: headLink(chain),
        priceTime: new Date().toISOString(),
        priceSource: usedRound ? 'oracle' : 'market',
        round: usedRound,
      });
      const signed = wallet.attest(draft);
      await wallet.hold(signed);
      await anchor(signed);
      await save();
      await refresh();
      setNote(
        side === 'sell'
          ? `Sold the whole coin at ${fmtUsd(usePrice)}. Now in cash — buy back lower to get ahead.`
          : `Bought the whole coin back at ${fmtUsd(usePrice)}.`,
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
        <header className="flex items-center justify-between mb-4">
          <Link to="/" className="text-sm text-muted hover:text-ink">
            ← Back
          </Link>
          <span className="text-xs text-muted">prototype</span>
        </header>

        <h1 className="text-xl font-semibold">Beat the HODL Machine</h1>
        <p className="mt-1 text-sm text-muted">
          Hold one whole coin. Sell all, buy all back. Your coin count races the
          HODL ball, fixed at 1.0. The stamps show your choice; the math shows the
          truth.
        </p>

        {/* Chart — WealthStrategy Stones style */}
        <section
          className="mt-4 rounded-2xl p-4"
          style={{ background: '#0D1117', border: `1px solid ${ORANGE}33` }}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase"
                style={{ letterSpacing: '0.14em', color: '#8b949e' }}
              >
                {lastClose && (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: ORANGE, boxShadow: `0 0 6px ${ORANGE}` }}
                  />
                )}
                Bitcoin · USD · live
              </div>
              <div
                className="tabular-nums"
                style={{ fontFamily: 'monospace', fontSize: 40, fontWeight: 900, color: ORANGE, lineHeight: 1.05 }}
              >
                {fmtUsd(lastClose)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex gap-1">
                {INTERVALS.map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setInterval(iv)}
                    className="rounded px-2 py-1 text-[11px] font-semibold"
                    style={
                      interval === iv
                        ? { background: `${ORANGE}22`, color: ORANGE, border: `1px solid ${ORANGE}55` }
                        : { color: '#8b949e', border: '1px solid #1c2840' }
                    }
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={reload}
                disabled={loading}
                aria-label="Refresh price"
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                style={{ color: '#8b949e', border: '1px solid #1c2840' }}
              >
                <span className={loading ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
                {loading ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
          {candles.length > 0 ? (
            <Suspense
              fallback={
                <div className="h-[240px] flex items-center justify-center text-xs" style={{ color: '#8b949e' }}>
                  Loading chart…
                </div>
              }
            >
              <ArenaChart candles={candles} priceLines={[]} markers={markers} height={240} />
            </Suspense>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-xs" style={{ color: '#8b949e' }}>
              {loading ? 'Loading candles…' : 'Price feed unavailable — try again in a moment.'}
            </div>
          )}
        </section>

        {/* Scoreboard */}
        <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Your coins</div>
              <div className="text-3xl font-semibold tabular-nums">{fmtCoins(score.coinsNow)}</div>
              <div className="text-[10px] text-muted mt-0.5">after costs</div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 rounded-full border border-ink/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink/40" />
                HODL · the ball
              </div>
              <div className="text-3xl font-semibold tabular-nums text-muted">1.000000</div>
              <div className="text-[10px] text-muted mt-0.5">to beat</div>
            </div>
          </div>
          {/* You vs HODL, in sats — the WealthStrategy Stones view */}
          <div className="mt-4 rounded-xl border border-ink/10 bg-ink/[0.02] p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">
              {ahead ? 'You are ahead of HODL' : score.edgeCoins < 0 ? 'You are behind HODL' : 'Dead even with HODL'}
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-black tabular-nums ${
                ahead ? 'text-emerald-600' : score.edgeCoins < 0 ? 'text-red-600' : 'text-muted'
              }`}
            >
              {fmtSatsSigned(score.edgeCoins)}
            </div>
            <div
              className={`text-sm font-bold ${
                ahead ? 'text-emerald-600' : score.edgeCoins < 0 ? 'text-red-600' : 'text-muted'
              }`}
            >
              {score.edgePct >= 0 ? '+' : ''}
              {score.edgePct.toFixed(2)}%
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white border border-ink/10 px-2 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted">You now</div>
                <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums">
                  {fmtSats(score.coinsNow)}
                </div>
              </div>
              <div className="rounded-lg bg-white border border-ink/10 px-2 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted">HODL frozen</div>
                <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-muted">
                  {fmtSats(score.hodlCoins)}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-muted">Holding</span>
              <div>{score.holding === 'btc' ? 'the coin' : 'cash'}</div>
            </div>
            <div>
              <span className="text-muted">Rounds</span>
              <div>{score.rounds.length}</div>
            </div>
            <div>
              <span className="text-muted">Chain</span>
              <div>{hasRun ? (verify.valid ? 'verified' : 'broken') : '—'}</div>
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

        {/* Action */}
        {hasRun ? (
          <button
            type="button"
            disabled={busy || !lastClose}
            onClick={act}
            className="mt-4 w-full rounded-xl bg-accent text-white px-4 py-4 text-base font-semibold disabled:opacity-40"
          >
            {side === 'sell' ? 'Sell the whole coin' : 'Buy the whole coin back'}
            {lastClose ? ` · ${fmtUsd(lastClose)}` : ''}
          </button>
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
