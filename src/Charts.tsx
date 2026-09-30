import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";

type Point = { t: number; equity: number };

export function EquityChart({ points }: { points: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !points.length) return;
    const chart: IChartApi = createChart(ref.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#8b968c",
        fontFamily: "IBM Plex Mono, monospace",
      },
      grid: { vertLines: { color: "rgba(232,236,230,0.06)" }, horzLines: { color: "rgba(232,236,230,0.06)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      height: 280,
      width: ref.current.clientWidth,
    });
    const series = chart.addAreaSeries({
      lineColor: "#c8f56a",
      topColor: "rgba(200,245,106,0.28)",
      bottomColor: "rgba(200,245,106,0)",
      lineWidth: 2,
    });
    series.setData(
      points.map((p) => ({
        time: Math.floor(p.t / 1000) as never,
        value: p.equity,
      }))
    );
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: ref.current!.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points]);
  return <div className="chart-box" ref={ref} />;
}

type Candle = { time: number; open: number; high: number; low: number; close: number };

export function TradeChart({
  symbol,
  entryTime,
  exitTime,
  entry,
  exit,
  side,
  tpPct = 0.01,
  slPct = 0.05,
}: {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entry: number;
  exit: number;
  side: string;
  tpPct?: number;
  slPct?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let chart: IChartApi | null = null;
    let cancelled = false;
    (async () => {
      const pad = 6 * 3600 * 1000;
      const start = entryTime - pad;
      const end = exitTime + pad;
      const q = new URLSearchParams({
        symbol,
        interval: "15m",
        startTime: String(start),
        endTime: String(end),
        limit: "500",
      });
      const r = await fetch(`/api/klines?${q}`);
      if (!r.ok || cancelled || !ref.current) return;
      const bars: Candle[] = await r.json();
      if (cancelled || !ref.current) return;
      chart = createChart(ref.current, {
        layout: {
          background: { color: "transparent" },
          textColor: "#8b968c",
          fontFamily: "IBM Plex Mono, monospace",
        },
        grid: { vertLines: { color: "rgba(232,236,230,0.06)" }, horzLines: { color: "rgba(232,236,230,0.06)" } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        height: 340,
        width: ref.current.clientWidth,
      });
      const candle: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries({
        upColor: "#6bcf8e",
        downColor: "#e07a6a",
        borderVisible: false,
        wickUpColor: "#6bcf8e",
        wickDownColor: "#e07a6a",
      });
      candle.setData(bars.map((b) => ({ ...b, time: b.time as never })));
      const tp = side === "long" ? entry * (1 + tpPct) : entry * (1 - tpPct);
      const sl = side === "long" ? entry * (1 - slPct) : entry * (1 + slPct);
      candle.createPriceLine({ price: entry, color: "#e8ece6", lineWidth: 1, lineStyle: 2, title: "entry" });
      candle.createPriceLine({ price: tp, color: "#c8f56a", lineWidth: 1, lineStyle: 2, title: "TP" });
      candle.createPriceLine({ price: sl, color: "#e07a6a", lineWidth: 1, lineStyle: 2, title: "SL" });
      candle.createPriceLine({ price: exit, color: "#e0b45a", lineWidth: 1, title: "exit" });
      chart.timeScale().fitContent();
      const onResize = () => chart && ref.current && chart.applyOptions({ width: ref.current.clientWidth });
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    })();
    return () => {
      cancelled = true;
      chart?.remove();
    };
  }, [symbol, entryTime, exitTime, entry, exit, side, tpPct, slPct]);
  return <div className="chart-box" ref={ref} />;
}

export function Bars({
  rows,
  valueKey = "n",
}: {
  rows: { key: string | number; n: number; pnl?: number; wr?: number }[];
  valueKey?: "n" | "pnl";
}) {
  const max = Math.max(...rows.map((r) => Math.abs(Number(r[valueKey] || 0))), 1);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.slice(0, 16).map((r) => {
        const v = Number(r[valueKey] || 0);
        const w = (Math.abs(v) / max) * 100;
        return (
          <div key={String(r.key)} style={{ display: "grid", gridTemplateColumns: "64px 1fr 72px", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{r.key}</span>
            <div style={{ height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${w}%`, height: "100%", background: v >= 0 ? "var(--accent)" : "var(--short)" }} />
            </div>
            <span className="num" style={{ fontFamily: "var(--mono)", fontSize: 12, textAlign: "right" }}>
              {valueKey === "pnl" ? `$${v.toFixed(0)}` : v}
            </span>
          </div>
        );
      })}
    </div>
  );
}
