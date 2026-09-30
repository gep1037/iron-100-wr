import { Fragment, useEffect, useMemo, useState } from "react";
import { Bars, EquityChart, TradeChart } from "./Charts";

type Trade = {
  id: string;
  source: string;
  symbol: string;
  coin: string;
  side: string;
  entry_time: number;
  exit_time: number;
  entry: number;
  exit: number;
  reason: string;
  pnl_pct: number;
  pnl_usd: number;
  hold_hours: number;
  year: number;
  month: string;
  day: string;
  dow: number;
  hour: number;
};

type Open = {
  symbol: string;
  side: string;
  entry: number;
  sl: number;
  tp: number;
  entry_time: number;
  margin?: number;
  leverage?: number;
  notional?: number;
  mode?: string;
};

type Snapshot = {
  generated_at: string;
  strategy: {
    name: string;
    pack: string;
    filters: number;
    coins: string[];
    period: { from: string; to: string };
    sizing_note: string;
    rules: string[];
    tp: number;
    sl: number;
  };
  summary: {
    n: number;
    tp: number;
    sl: number;
    wr: number;
    pnl: number;
    avg_pnl: number;
    avg_hold: number;
    per_month: number;
    months: number;
    long: number;
    short: number;
  };
  by_year: Stat[];
  by_month: Stat[];
  by_day: Stat[];
  by_coin: Stat[];
  by_side: Stat[];
  by_hour: Stat[];
  by_dow: Stat[];
  heat_pnl: number[][];
  heat_n: number[][];
  equity: { t: number; equity: number; pnl: number }[];
  opens: Open[];
  live_trades: Trade[];
  trades: Trade[];
  bot?: { mode?: string; trading_on?: boolean; updated_ms?: number | null };
};

type Stat = { key: string | number; n: number; tp: number; sl: number; wr: number; pnl: number; avg_hold: number };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmt(ms: number) {
  return new Date(ms).toLocaleString("ru-RU", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }) + " UTC";
}

function usd(n: number) {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function heatColor(v: number, maxAbs: number) {
  if (!maxAbs) return "rgba(232,236,230,0.05)";
  const t = Math.min(1, Math.abs(v) / maxAbs);
  if (v >= 0) return `rgba(200,245,106,${0.08 + t * 0.75})`;
  return `rgba(224,122,106,${0.08 + t * 0.75})`;
}

export default function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"overview" | "opens" | "trades" | "analytics" | "rules">("overview");
  const [selected, setSelected] = useState<Trade | null>(null);
  const [coin, setCoin] = useState("all");
  const [side, setSide] = useState("all");
  const [src, setSrc] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        let r = await fetch("/api/snapshot");
        if (!r.ok) r = await fetch("/data/snapshot.json");
        if (!r.ok) throw new Error(`snapshot ${r.status}`);
        const j = await r.json();
        if (alive) setData(j);
      } catch (e) {
        if (alive) setErr(String(e));
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const allTrades = useMemo(() => {
    if (!data) return [] as Trade[];
    const live = (data.live_trades || []).map((t) => ({ ...t, source: t.source || "live" }));
    return [...live, ...data.trades].sort((a, b) => b.entry_time - a.entry_time);
  }, [data]);

  const filtered = useMemo(() => {
    return allTrades.filter((t) => {
      if (coin !== "all" && t.coin !== coin) return false;
      if (side !== "all" && t.side !== side) return false;
      if (src !== "all" && (t.source || "hist") !== src) return false;
      if (q && !`${t.coin} ${t.side} ${t.reason}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [allTrades, coin, side, src, q]);

  if (err) return <div className="app"><p className="empty">Ошибка загрузки: {err}</p></div>;
  if (!data) return <div className="app"><p className="empty">Загрузка книги Volume v1…</p></div>;

  const s = data.summary;
  const maxHeat = Math.max(...data.heat_pnl.flat().map((x) => Math.abs(x)), 1);

  if (selected) {
    return (
      <div className="app">
        <button className="ghost back" onClick={() => setSelected(null)}>← К списку</button>
        <div className="section detail">
          <h2>
            {selected.coin}/USDT{" "}
            <span className={`pill ${selected.side}`}>{selected.side}</span>{" "}
            <span className={`pill ${selected.reason}`}>{selected.reason}</span>
          </h2>
          <p className="sub">
            {selected.source === "live" ? "Live" : "Hist Volume v1"} · вход {fmt(selected.entry_time)} · выход {fmt(selected.exit_time)}
          </p>
          <div className="detail-meta">
            <div className="kv"><div className="k">Entry</div><div className="v">{selected.entry}</div></div>
            <div className="kv"><div className="k">Exit</div><div className="v">{selected.exit}</div></div>
            <div className="kv"><div className="k">PnL %</div><div className="v">{selected.pnl_pct.toFixed(3)}%</div></div>
            <div className="kv"><div className="k">PnL $</div><div className="v">{usd(selected.pnl_usd)}</div></div>
            <div className="kv"><div className="k">Hold</div><div className="v">{selected.hold_hours.toFixed(2)} h</div></div>
            <div className="kv"><div className="k">Hour UTC</div><div className="v">{selected.hour}:00 · {DOW[selected.dow]}</div></div>
          </div>
          <div className="panel">
            <h3>График 15m · TP/SL/entry/exit</h3>
            <TradeChart
              symbol={selected.symbol}
              entryTime={selected.entry_time}
              exitTime={selected.exit_time}
              entry={selected.entry}
              exit={selected.exit}
              side={selected.side}
              tpPct={data.strategy.tp}
              slPct={data.strategy.sl}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <h1 className="brand">
          Iron <em>100%</em> WR
        </h1>
        <p className="lede">
          Volume v1 · streak-8 · TP +1% / SL −5% · {data.strategy.filters} фильтров UTC ·{" "}
          {data.strategy.coins.length} монет. Книга с {data.strategy.period.from.slice(0, 10)} по{" "}
          {data.strategy.period.to.slice(0, 10)}. {data.strategy.sizing_note}.
        </p>
        <div className="cta-row">
          <button className="active" onClick={() => setTab("trades")}>Сделки</button>
          <button onClick={() => setTab("analytics")}>Аналитика</button>
          <button onClick={() => setTab("opens")}>Открытые ({data.opens?.length || 0})</button>
          <span className="meta">
            WR {s.wr}% · {s.n} сделок · {usd(s.pnl)} · обновлено {new Date(data.generated_at).toLocaleString("ru-RU")}
          </span>
        </div>
      </header>

      <nav className="nav">
        {(
          [
            ["overview", "Обзор"],
            ["opens", "Открытые"],
            ["trades", "Сделки"],
            ["analytics", "Аналитика"],
            ["rules", "Правила"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="section">
          <h2>Обзор</h2>
          <p className="sub">Hist Volume v1 + live с бота · режим {data.bot?.mode || "—"} · входы {data.bot?.trading_on ? "ON" : "пауза"}</p>
          <div className="stats">
            <div className="stat"><div className="label">Сделки</div><div className="value">{s.n}</div></div>
            <div className="stat"><div className="label">Win rate</div><div className="value good">{s.wr}%</div></div>
            <div className="stat"><div className="label">TP / SL</div><div className="value">{s.tp} / {s.sl}</div></div>
            <div className="stat"><div className="label">Net PnL</div><div className="value good">{usd(s.pnl)}</div></div>
            <div className="stat"><div className="label">Avg / trade</div><div className="value">{usd(s.avg_pnl)}</div></div>
            <div className="stat"><div className="label">Avg hold</div><div className="value">{s.avg_hold}h</div></div>
            <div className="stat"><div className="label">/ месяц</div><div className="value">{s.per_month}</div></div>
            <div className="stat"><div className="label">Long / Short</div><div className="value">{s.long}/{s.short}</div></div>
          </div>
          <div className="grid2" style={{ marginTop: "1.25rem" }}>
            <div className="panel">
              <h3>Equity ($500×5)</h3>
              <EquityChart points={data.equity} />
            </div>
            <div className="panel">
              <h3>По монетам (сделки)</h3>
              <Bars rows={data.by_coin} valueKey="n" />
            </div>
          </div>
          {(data.live_trades?.length || 0) > 0 && (
            <div className="panel" style={{ marginTop: "1.25rem" }}>
              <h3>Последние live</h3>
              <TradeTable rows={data.live_trades.slice(0, 8)} onPick={setSelected} />
            </div>
          )}
        </section>
      )}

      {tab === "opens" && (
        <section className="section">
          <h2>Открытые сейчас</h2>
          <p className="sub">С бота Iron 100% на сервере. Если пусто — позиций нет.</p>
          {!data.opens?.length ? (
            <p className="empty">Нет открытых позиций.</p>
          ) : (
            <div className="panel">
              <table>
                <thead>
                  <tr>
                    <th>Монета</th><th>Сторона</th><th className="num">Entry</th>
                    <th className="num">TP</th><th className="num">SL</th><th>Вход</th><th>Режим</th>
                  </tr>
                </thead>
                <tbody>
                  {data.opens.map((o, i) => (
                    <tr key={i}>
                      <td>{o.symbol.replace("USDT", "")}</td>
                      <td><span className={`pill ${o.side}`}>{o.side}</span></td>
                      <td className="num">{o.entry}</td>
                      <td className="num">{o.tp}</td>
                      <td className="num">{o.sl}</td>
                      <td>{fmt(o.entry_time)}</td>
                      <td><span className="pill open">{o.mode || "paper"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "trades" && (
        <section className="section">
          <h2>Сделки</h2>
          <p className="sub">Кликни строку — полный разбор и график. Показано {filtered.length} из {allTrades.length}.</p>
          <div className="filters">
            <select value={coin} onChange={(e) => setCoin(e.target.value)}>
              <option value="all">Все монеты</option>
              {data.strategy.coins.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="all">Long+Short</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select value={src} onChange={(e) => setSrc(e.target.value)}>
              <option value="all">Hist+Live</option>
              <option value="hist">Только hist</option>
              <option value="live">Только live</option>
            </select>
            <input placeholder="поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="panel" style={{ overflow: "auto", maxHeight: "70vh" }}>
            <TradeTable rows={filtered.slice(0, 400)} onPick={setSelected} />
          </div>
        </section>
      )}

      {tab === "analytics" && (
        <section className="section">
          <h2>Аналитика</h2>
          <p className="sub">Месяцы, дни, часы UTC, дни недели, монеты.</p>
          <div className="grid2">
            <div className="panel">
              <h3>По месяцам · PnL</h3>
              <Bars rows={[...data.by_month].reverse()} valueKey="pnl" />
            </div>
            <div className="panel">
              <h3>По годам</h3>
              <table>
                <thead><tr><th>Год</th><th className="num">N</th><th className="num">WR</th><th className="num">PnL</th></tr></thead>
                <tbody>
                  {data.by_year.map((r) => (
                    <tr key={String(r.key)}>
                      <td>{r.key}</td>
                      <td className="num">{r.n}</td>
                      <td className="num">{r.wr}%</td>
                      <td className="num">{usd(r.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid2" style={{ marginTop: "1.25rem" }}>
            <div className="panel">
              <h3>По монетам</h3>
              <table>
                <thead><tr><th>Coin</th><th className="num">N</th><th className="num">WR</th><th className="num">PnL</th><th className="num">Hold</th></tr></thead>
                <tbody>
                  {data.by_coin.map((r) => (
                    <tr key={String(r.key)}>
                      <td>{r.key}</td>
                      <td className="num">{r.n}</td>
                      <td className="num">{r.wr}%</td>
                      <td className="num">{usd(r.pnl)}</td>
                      <td className="num">{r.avg_hold}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>По часу UTC</h3>
              <Bars rows={[...data.by_hour].sort((a, b) => Number(a.key) - Number(b.key))} valueKey="n" />
            </div>
          </div>
          <div className="panel" style={{ marginTop: "1.25rem" }}>
            <h3>Теплокарта PnL · день недели × час UTC</h3>
            <div className="heat-hours">
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={h}>{h}</span>)}
            </div>
            <div className="heat">
              {DOW.map((d, di) => (
                <Fragment key={d}>
                  <div className="lab">{d}</div>
                  {data.heat_pnl[di].map((v, h) => (
                    <div
                      key={`${di}-${h}`}
                      className="cell"
                      title={`${d} ${h}:00 · n=${data.heat_n[di][h]} · ${usd(v)}`}
                      style={{ background: heatColor(v, maxHeat) }}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <div className="panel" style={{ marginTop: "1.25rem", overflow: "auto", maxHeight: 360 }}>
            <h3>По дням (хвост)</h3>
            <table>
              <thead><tr><th>День</th><th className="num">N</th><th className="num">WR</th><th className="num">PnL</th></tr></thead>
              <tbody>
                {[...data.by_day].reverse().slice(0, 90).map((r) => (
                  <tr key={String(r.key)}>
                    <td>{r.key}</td>
                    <td className="num">{r.n}</td>
                    <td className="num">{r.wr}%</td>
                    <td className="num">{usd(r.pnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "rules" && (
        <section className="section">
          <h2>80 правил Volume v1</h2>
          <p className="sub">OR-union · UTC · сторона/час/день как в боте.</p>
          <div className="panel" style={{ overflow: "auto", maxHeight: "70vh" }}>
            <table>
              <thead><tr><th>#</th><th>Правило</th></tr></thead>
              <tbody>
                {data.strategy.rules.map((r, i) => (
                  <tr key={i}><td className="num">{i + 1}</td><td style={{ fontFamily: "var(--mono)" }}>{r}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="foot">
        Hist 100% WR — in-sample на книге Volume v1, не гарантия live. Сайт тянет snapshot бота каждую минуту.
        Свечи — Binance USDT-M через /api/klines.
      </footer>
    </div>
  );
}

function TradeTable({ rows, onPick }: { rows: Trade[]; onPick: (t: Trade) => void }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Когда</th><th>Coin</th><th>Side</th><th>Result</th>
          <th className="num">PnL $</th><th className="num">Hold</th><th>Src</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="clickable" onClick={() => onPick(t)}>
            <td>{fmt(t.entry_time)}</td>
            <td>{t.coin}</td>
            <td><span className={`pill ${t.side}`}>{t.side}</span></td>
            <td><span className={`pill ${t.reason}`}>{t.reason}</span></td>
            <td className="num">{usd(t.pnl_usd)}</td>
            <td className="num">{t.hold_hours.toFixed(1)}h</td>
            <td>{t.source || "hist"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
