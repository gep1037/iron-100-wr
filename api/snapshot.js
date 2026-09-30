export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const liveUrl = process.env.LIVE_SNAPSHOT_URL;
  if (liveUrl) {
    try {
      const r = await fetch(liveUrl, { headers: { "User-Agent": "Iron100WR-Site/1.0" } });
      if (r.ok) {
        const data = await r.json();
        res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
        res.status(200).json(data);
        return;
      }
    } catch (_) {
      /* fall through to static */
    }
  }
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    const r = await fetch(`${base}/data/snapshot.json`);
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
