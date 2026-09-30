# Iron 100% WR · Volume v1

Minimal site for the Iron Volume v1 strategy book: hist trades since 2021, live opens, analytics, per-trade charts.

## Stack
- Vite + React
- Vercel (`/api/klines`, `/api/snapshot`)
- Live snapshot from bot VPS (`LIVE_SNAPSHOT_URL`)

## Local
```bash
npm i
npm run dev
```

## Deploy
Set Vercel env `LIVE_SNAPSHOT_URL` to the bot snapshot HTTP endpoint.
