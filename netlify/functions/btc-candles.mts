/**
 * btc-candles.mts — real OHLC candles for the Stones chart, any timeframe.
 *
 * GET /api/btc-candles?interval=4h[&limit=<n>]
 *   → { candles: [{ts, open, high, low, close}, ...], interval, lastClose,
 *       updatedAt, source }
 *
 * The Stones lab draws a real candlestick chart of the chosen timeframe so the
 * operator can read the back-and-forth and place pieces where they'd actually
 * trade. This is that feed.
 *
 * Why not Binance: api.binance.com returns HTTP 451 (geo-restriction) from
 * Netlify's AWS egress, so it is NOT a source here — that was the whole "their
 * finance isn't giving us candles" problem. Instead we go straight to
 * exchanges that serve datacenter IPs and give real OHLC:
 *
 *  1. Kraken  — native 1h/4h/1d/1w, up to 720 bars, deep context. Primary.
 *  2. Coinbase Exchange — native 1h/1d; 4h aggregated from 1h, 1w from 1d.
 *  3. Bitstamp — native 1h/4h/1d; 1w aggregated from 1d.
 *
 * Each provider is normalized to ascending candles `{ts(ms, bar open), open,
 * high, low, close}`. First provider to return a non-empty series wins. If all
 * fail we serve stale cache, else an honest empty set — the client then falls
 * back to the daily price-history line rather than fabricating candles.
 *
 * Public read (BTC price is not personal data). Short blob cache per interval
 * so many mounts don't hammer the exchanges but new bars still surface.
 */
// Copied from WealthStrategy's Stones candle feed and adapted for tapit-wallet:
// the @netlify/blobs cache is dropped (no extra dep) — the client caches per
// interval for 5 min and the HTTP Cache-Control header below carries the rest,
// so a fresh multi-provider fetch per cold request is fine. No API key needed.

interface Candle { ts: number; open: number; high: number; low: number; close: number }

const FETCH_TIMEOUT = 15_000;

const INTERVAL_MS: Record<string, number> = {
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });

function n(x: unknown): number {
  const v = typeof x === "string" ? parseFloat(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(v) ? v : NaN;
}

function cleanAsc(rows: Candle[]): Candle[] {
  const seen = new Set<number>();
  return rows
    .filter(
      (c) =>
        Number.isFinite(c.ts) &&
        [c.open, c.high, c.low, c.close].every((v) => Number.isFinite(v) && v > 0),
    )
    .sort((a, b) => a.ts - b.ts)
    .filter((c) => (seen.has(c.ts) ? false : (seen.add(c.ts), true)));
}

/** Aggregate finer candles into aligned buckets of `bucketMs` (open/close from
 *  the first/last candle, high/low across the group). Used when a provider has
 *  no native bar for the requested timeframe. */
function aggregate(candles: Candle[], bucketMs: number): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const start = Math.floor(c.ts / bucketMs) * bucketMs;
    const b = buckets.get(start);
    if (!b) {
      buckets.set(start, { ts: start, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close; // candles arrive ascending, so last wins
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT), headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Kraken (primary) — native 1h/4h/1d/1w ─────────────────────────────────────
const KRAKEN_MIN: Record<string, number> = { "1h": 60, "4h": 240, "1d": 1440, "1w": 10080 };
async function fetchKraken(interval: string): Promise<Candle[] | null> {
  const min = KRAKEN_MIN[interval];
  if (!min) return null;
  const json = await getJson(`https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${min}`);
  const result = (json as { result?: Record<string, unknown> } | null)?.result;
  if (!result) return null;
  const key = Object.keys(result).find((k) => k !== "last");
  const rows = key ? (result[key] as unknown) : null;
  if (!Array.isArray(rows)) return null;
  // [time(sec), open, high, low, close, vwap, volume, count]
  const out = rows.map((r) => {
    const a = r as Array<string | number>;
    return { ts: n(a[0]) * 1000, open: n(a[1]), high: n(a[2]), low: n(a[3]), close: n(a[4]) };
  });
  const clean = cleanAsc(out);
  return clean.length ? clean : null;
}

// ── Coinbase Exchange — native 1h/1d; 4h←1h, 1w←1d ────────────────────────────
const COINBASE_GRAN: Record<string, { gran: number; agg?: number }> = {
  "1h": { gran: 3600 },
  "4h": { gran: 3600, agg: INTERVAL_MS["4h"] },
  "1d": { gran: 86400 },
  "1w": { gran: 86400, agg: INTERVAL_MS["1w"] },
};
async function fetchCoinbase(interval: string): Promise<Candle[] | null> {
  const spec = COINBASE_GRAN[interval];
  if (!spec) return null;
  const json = await getJson(
    `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${spec.gran}`,
    { "User-Agent": "wealthstrategy-stones/1.0", Accept: "application/json" },
  );
  if (!Array.isArray(json)) return null;
  // [time(sec), low, high, open, close, volume], newest-first
  const out = (json as Array<Array<number>>).map((r) => ({
    ts: n(r[0]) * 1000,
    low: n(r[1]),
    high: n(r[2]),
    open: n(r[3]),
    close: n(r[4]),
  }));
  let clean = cleanAsc(out);
  if (spec.agg) clean = aggregate(clean, spec.agg);
  return clean.length ? clean : null;
}

// ── Bitstamp — native 1h/4h/1d; 1w←1d ─────────────────────────────────────────
const BITSTAMP_STEP: Record<string, { step: number; agg?: number }> = {
  "1h": { step: 3600 },
  "4h": { step: 14400 },
  "1d": { step: 86400 },
  "1w": { step: 86400, agg: INTERVAL_MS["1w"] },
};
async function fetchBitstamp(interval: string): Promise<Candle[] | null> {
  const spec = BITSTAMP_STEP[interval];
  if (!spec) return null;
  const json = await getJson(
    `https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${spec.step}&limit=1000`,
  );
  const ohlc = (json as { data?: { ohlc?: unknown } } | null)?.data?.ohlc;
  if (!Array.isArray(ohlc)) return null;
  // { timestamp(sec, str), open, high, low, close, volume }
  const out = (ohlc as Array<Record<string, string>>).map((r) => ({
    ts: n(r.timestamp) * 1000,
    open: n(r.open),
    high: n(r.high),
    low: n(r.low),
    close: n(r.close),
  }));
  let clean = cleanAsc(out);
  if (spec.agg) clean = aggregate(clean, spec.agg);
  return clean.length ? clean : null;
}

async function fetchCandles(
  interval: string,
): Promise<{ candles: Candle[]; source: string } | null> {
  const providers: Array<[string, () => Promise<Candle[] | null>]> = [
    ["kraken", () => fetchKraken(interval)],
    ["coinbase", () => fetchCoinbase(interval)],
    ["bitstamp", () => fetchBitstamp(interval)],
  ];
  for (const [source, fn] of providers) {
    const candles = await fn();
    if (candles && candles.length > 0) return { candles, source };
  }
  return null;
}

export default async (req: Request) => {
  if (req.method !== "GET") return J({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const interval = (url.searchParams.get("interval") || "1d").toLowerCase();
  if (!INTERVAL_MS[interval]) {
    return J({ error: "Invalid interval", allowed: Object.keys(INTERVAL_MS) }, 400);
  }

  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 1000) : 0;
  const now = Date.now();
  const trim = (cs: Candle[]) => (limit > 0 ? cs.slice(-limit) : cs);

  const fresh = await fetchCandles(interval);
  if (fresh) {
    const lastClose = fresh.candles[fresh.candles.length - 1].close;
    return J({ candles: trim(fresh.candles), lastClose, interval, updatedAt: now, source: fresh.source });
  }
  return J({ candles: [], lastClose: null, interval, updatedAt: now, source: "none" });
};

export const config = { path: "/api/btc-candles" };
