export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  try {
    const { symbol, interval = "15m", startTime, endTime, limit = "500" } = req.query || {};
    if (!symbol) {
      res.status(400).json({ error: "symbol required" });
      return;
    }
    const params = new URLSearchParams({
      symbol: String(symbol).toUpperCase(),
      interval: String(interval),
      limit: String(Math.min(1500, Number(limit) || 500)),
    });
    if (startTime) params.set("startTime", String(startTime));
    if (endTime) params.set("endTime", String(endTime));
    const url = `https://fapi.binance.com/fapi/v1/klines?${params}`;
    const r = await fetch(url, { headers: { "User-Agent": "Iron100WR-Site/1.0" } });
    if (!r.ok) {
      res.status(r.status).json({ error: await r.text() });
      return;
    }
    const raw = await r.json();
    const bars = raw.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: +k[1],
      high: +k[2],
      low: +k[3],
      close: +k[4],
    }));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json(bars);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
