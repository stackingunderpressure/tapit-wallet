/**
 * StoneChart — the tactical board. A TradingView Lightweight Charts view of the
 * chosen timeframe with the stone's levels drawn as labelled price lines (buys,
 * sells, and the frozen HODL/arm price).
 *
 * Renders REAL candlesticks when the feed carries OHLC (Kraken/Coinbase/
 * Bitstamp via /api/btc-candles). When only closes are available (the daily
 * price-history fallback), it renders an area line instead — a candlestick of a
 * closes-only bar would just be a flat doji, which reads as noise. The user can
 * scroll and pinch/wheel-zoom freely; we frame a sensible recent window once and
 * then leave their zoom alone.
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type LineWidth,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "./useBtcCandles.ts";

// Local dark palette, matching WealthStrategy's Stones chart look (the source
// this was copied from) — Bitcoin orange, muted gray, green/red candles.
const C = {
  muted: "#8b949e",
  border: "#1c2840",
  green: "#22A05A",
  red: "#C0392B",
  accent: "#F7931A",
} as const;

export interface StonePriceLine {
  price: number;
  color: string;
  title: string;
  dashed?: boolean;
  /** Emphasis for the level being edited. 1-4; default 1. */
  width?: number;
}

/** A buy/sell pin drawn on the candles. `time` is unix ms; it snaps to the bar
 *  it falls in so it always lands on a real candle. */
export interface StoneMarker {
  time: number;
  side: "buy" | "sell";
  label: string;
}

// How many of the most recent bars to frame by default. The rest stays
// scrollable/zoomable — the chart just opens on recent action, not years of
// macro. Enough bars that the 4h back-and-forth has real context.
const VISIBLE_BARS = 90;

type SeriesKind = "candles" | "area";

function isOhlc(candles: Candle[]): boolean {
  // Real candles have movement inside the bar; the daily fallback sets o=h=l=c.
  return candles.some((c) => c.high !== c.low || c.open !== c.close);
}

export default function StoneChart({
  candles,
  priceLines,
  markers = [],
  onPickPrice,
  height = 280,
}: {
  candles: Candle[];
  priceLines: StonePriceLine[];
  markers?: StoneMarker[];
  /** When set, tapping the chart reports the price at the tapped y. */
  onPickPrice?: (price: number) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Area"> | null>(null);
  const kindRef = useRef<SeriesKind | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const rangeRef = useRef<{ priceRange: { minValue: number; maxValue: number } } | null>(null);
  const framedRef = useRef(false); // frame once, then leave the user's zoom alone
  const pickRef = useRef<((price: number) => void) | undefined>(onPickPrice);
  pickRef.current = onPickPrice;

  // Create the chart shell once. Series are (re)built in the data effect so we
  // can switch between candlesticks and the area fallback cleanly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.muted,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(28,40,64,0.35)" },
        horzLines: { color: "rgba(28,40,64,0.35)" },
      },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    });
    chartRef.current = chart;
    seriesRef.current = null;
    kindRef.current = null;
    linesRef.current = [];
    framedRef.current = false;

    // Tap-to-set: convert the tapped y to a price and report it.
    chart.subscribeClick((param) => {
      const cb = pickRef.current;
      const series = seriesRef.current;
      if (!cb || !series || !param.point) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price != null && Number.isFinite(price) && price > 0) cb(price);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      kindRef.current = null;
      linesRef.current = [];
    };
  }, [height]);

  // Ensure the right series type exists, push data, redraw the level lines.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const kind: SeriesKind = isOhlc(candles) ? "candles" : "area";

    // (Re)build the series if the type changed (e.g. daily fallback → real 4h).
    if (kindRef.current !== kind) {
      if (seriesRef.current) {
        try {
          chart.removeSeries(seriesRef.current);
        } catch {
          /* already gone */
        }
        seriesRef.current = null;
        linesRef.current = [];
      }
      const autoscale = () => rangeRef.current;
      seriesRef.current =
        kind === "candles"
          ? chart.addCandlestickSeries({
              upColor: C.green,
              downColor: C.red,
              borderVisible: false,
              wickUpColor: C.green,
              wickDownColor: C.red,
              priceLineVisible: false,
              autoscaleInfoProvider: autoscale,
            })
          : chart.addAreaSeries({
              lineColor: C.accent,
              topColor: "rgba(247,147,26,0.22)",
              bottomColor: "rgba(247,147,26,0.02)",
              lineWidth: 2,
              priceLineVisible: false,
              autoscaleInfoProvider: autoscale,
            });
      kindRef.current = kind;
      framedRef.current = false; // re-frame after a type swap
    }

    const series = seriesRef.current;
    if (!series) return;

    const seen = new Set<number>();
    const rows = candles
      .filter((c) => Number.isFinite(c.ts) && c.close > 0)
      .map((c) => ({ t: Math.floor(c.ts / 1000) as UTCTimestamp, c }))
      .sort((a, b) => a.t - b.t)
      .filter((r) => (seen.has(r.t) ? false : (seen.add(r.t), true)));

    // Scale the price axis to the recent window + the level lines, so recent
    // action fills the pane and the placed levels are always visible.
    const recent = rows.slice(-VISIBLE_BARS);
    const vals: number[] = [];
    for (const r of recent) vals.push(r.c.high, r.c.low);
    for (const pl of priceLines) if (Number.isFinite(pl.price) && pl.price > 0) vals.push(pl.price);
    if (vals.length) {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const pad = (hi - lo || hi) * 0.08;
      rangeRef.current = { priceRange: { minValue: lo - pad, maxValue: hi + pad } };
    } else {
      rangeRef.current = null;
    }

    if (kind === "candles") {
      (series as ISeriesApi<"Candlestick">).setData(
        rows.map((r) => ({
          time: r.t,
          open: r.c.open,
          high: r.c.high,
          low: r.c.low,
          close: r.c.close,
        })),
      );
    } else {
      (series as ISeriesApi<"Area">).setData(rows.map((r) => ({ time: r.t, value: r.c.close })));
    }

    for (const line of linesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* series may have been torn down */
      }
    }
    linesRef.current = priceLines
      .filter((pl) => Number.isFinite(pl.price) && pl.price > 0)
      .map((pl) =>
        series.createPriceLine({
          price: pl.price,
          color: pl.color,
          lineWidth: (pl.width ?? 1) as LineWidth,
          lineStyle: pl.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: pl.title,
        }),
      );

    // Buy/sell markers — snap each to the bar it falls in so it lands on a real
    // candle. Buys: green up-arrow below the bar; sells: orange down-arrow above.
    const barTimes = rows.map((r) => r.t as number);
    const snap = (tsMs: number): UTCTimestamp | null => {
      if (!barTimes.length) return null;
      const s = Math.floor(tsMs / 1000);
      let chosen = barTimes[0];
      for (const t of barTimes) {
        if (t <= s) chosen = t;
        else break;
      }
      return chosen as UTCTimestamp;
    };
    const seriesMarkers: SeriesMarker<Time>[] = [];
    for (const m of markers) {
      const t = snap(m.time);
      if (t == null) continue;
      seriesMarkers.push({
        time: t,
        position: m.side === "buy" ? "belowBar" : "aboveBar",
        color: m.side === "buy" ? C.green : C.accent,
        shape: m.side === "buy" ? "arrowUp" : "arrowDown",
        text: m.label,
      });
    }
    seriesMarkers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(seriesMarkers);

    const nBars = rows.length;
    if (nBars > 0 && !framedRef.current) {
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, nBars - VISIBLE_BARS), to: nBars + 1 });
      framedRef.current = true;
    }
  }, [candles, priceLines, markers]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
