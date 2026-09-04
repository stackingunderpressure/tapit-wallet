/**
 * useBtcCandles — real OHLC candles of a chosen timeframe for the Stones chart.
 *
 * Fetches /api/btc-candles for the given interval and hands the chart a clean
 * OHLC series. Module-scope cached per interval with a short session TTL so
 * multiple mounts reuse one fetch; the endpoint also blob-caches server-side.
 * Errors are swallowed — callers degrade gracefully on an empty series (the
 * tab then falls back to the daily price line rather than fabricating candles).
 */
import { useEffect, useState } from "react";

// The candle feed endpoint (netlify/functions/btc-candles.mts). Copied from
// WealthStrategy's Stones lab; here it's a plain path instead of a config map.
const BTC_CANDLES = "/api/btc-candles";

export type CandleInterval = "1h" | "4h" | "1d" | "1w";

export interface Candle {
  ts: number; // bar open, unix ms
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Payload {
  candles: Candle[];
  lastClose: number | null;
  source: string;
  fetchedAt: number;
}

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min — the endpoint refreshes ~10 min
const cache = new Map<string, Payload>();
const inFlight = new Map<string, Promise<Payload>>();

function keyOf(interval: CandleInterval, limit?: number): string {
  return `${interval}:${limit ?? "all"}`;
}

function parseCandle(c: Partial<Candle> & { close?: number }): Candle | null {
  const ts = Number(c.ts);
  const close = Number(c.close);
  if (!Number.isFinite(ts) || !Number.isFinite(close) || close <= 0) return null;
  // Tolerate a closes-only payload by treating missing OHLC as the close.
  const open = Number.isFinite(Number(c.open)) && Number(c.open) > 0 ? Number(c.open) : close;
  const high = Number.isFinite(Number(c.high)) && Number(c.high) > 0 ? Number(c.high) : close;
  const low = Number.isFinite(Number(c.low)) && Number(c.low) > 0 ? Number(c.low) : close;
  return { ts, open, high, low, close };
}

async function fetchOnce(interval: CandleInterval, limit?: number): Promise<Payload> {
  const key = keyOf(interval, limit);
  const hit = cache.get(key);
  if (hit && hit.candles.length > 0 && Date.now() - hit.fetchedAt < SESSION_TTL_MS) return hit;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const p = (async (): Promise<Payload> => {
    try {
      const params = new URLSearchParams({ interval });
      if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
        params.set("limit", String(Math.floor(limit)));
      }
      const res = await fetch(`${BTC_CANDLES}?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return { candles: [], lastClose: null, source: "none", fetchedAt: Date.now() };
      const json = (await res.json()) as {
        candles?: Array<Partial<Candle> & { close?: number }>;
        lastClose?: number | null;
        source?: string;
      };
      const candles = Array.isArray(json?.candles)
        ? (json.candles.map(parseCandle).filter(Boolean) as Candle[])
        : [];
      const lastClose =
        typeof json?.lastClose === "number" && Number.isFinite(json.lastClose)
          ? json.lastClose
          : candles.length
            ? candles[candles.length - 1]!.close
            : null;
      const payload: Payload = {
        candles,
        lastClose,
        source: json?.source || "none",
        fetchedAt: Date.now(),
      };
      if (candles.length > 0) cache.set(key, payload);
      return payload;
    } catch {
      return { candles: [], lastClose: null, source: "none", fetchedAt: Date.now() };
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}

export function useBtcCandles(
  interval: CandleInterval,
  limit?: number,
): { candles: Candle[]; lastClose: number | null; source: string; loading: boolean } {
  const key = keyOf(interval, limit);
  const [state, setState] = useState<{ candles: Candle[]; lastClose: number | null; source: string }>(
    () => {
      const hit = cache.get(key);
      return hit
        ? { candles: hit.candles, lastClose: hit.lastClose, source: hit.source }
        : { candles: [], lastClose: null, source: "none" };
    },
  );
  const [loading, setLoading] = useState<boolean>(() => !cache.get(key));

  useEffect(() => {
    let cancelled = false;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < SESSION_TTL_MS) {
      setState({ candles: hit.candles, lastClose: hit.lastClose, source: hit.source });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchOnce(interval, limit).then((p) => {
      if (cancelled) return;
      setState({ candles: p.candles, lastClose: p.lastClose, source: p.source });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key, interval, limit]);

  return { candles: state.candles, lastClose: state.lastClose, source: state.source, loading };
}
