# AgriDash — Лабораторний Гідропонний Моніторинг

A real-time simulated dashboard for a college plant lab with hydroponic systems and crop monitoring.

## Stack

- **React 19** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Recharts** — sparkline area charts
- **Lucide React** — icons

## Features

- Two hydroponic systems (NFT + DWC) with live pH, NH₃, DO, EC, water temp, and level tracking
- 7 crop types with per-plant moisture, temperature, luminosity, and fertility readings
- Room environment strip (temp, humidity, CO₂, lux)
- Semantic color coding: Green = Normal · Amber = Warning · Red = Critical
- Rolling system journal with Zigbee-style log entries
- Webcam placeholder panel
- Mean-reversion random-walk sensor simulation (realistic slow drift)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## Build & Preview

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (e.g. `github.com/yourname/fkDash`)
2. Go to **Settings → Pages → Source** → set to **GitHub Actions**
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and deploys automatically
4. Live at `https://yourname.github.io/fkDash/`

> **Note:** The `base` in `vite.config.js` is set to `/fkDash/`. If your repo has a different name, update that value.

## Sensor Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| pH | < 5.8 or > 7.2 | < 5.4 or > 7.6 |
| NH₃ | > 0.15 mg/L | > 0.25 mg/L |
| DO | < 6.0 mg/L | < 4.5 mg/L |
| Water Level | < 40% | < 25% |
| CO₂ | > 900 ppm | > 1200 ppm |
