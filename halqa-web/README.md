# HALQA v2 — frontend (`halqa-web`)

Vite + React 19 + TypeScript (strict) + React Router + PWA. Phase F0–F2 built.

14 routes: `/` · `/enter` · `/dna` · `/solo` · `/circles/new` ·
`/circles/join` · `/c/:circleId` · `/c/:circleId/s/:sessionId` · `…/debrief` ·
`/board` · `/mentor` · `/dashboard` · `/lab` · `/me`.

## Run (clean checkout, 4 steps)

```bash
cd "challenge wie act /halqa-web"
cp .env.example .env.local    # VITE_API_BASE — must match halqa-api PORT
npm ci
npm run dev                   # http://localhost:5173
```

The API must be running for anything past the landing page. See
`../halqa-api/README.md`.

## Build

```bash
npm run lint      # oxlint
npx tsc -b        # typecheck
npm run build     # → dist/ + manifest.webmanifest + sw.js
```

`vite-plugin-pwa` precaches the app shell and runtime-caches
`/questions/:id/state` (NetworkFirst, 3 s) and `/kb/*`
(StaleWhileRevalidate), so the session poller degrades instead of dying
on a bad venue Wi-Fi. Icons live in `public/` (`icon.svg`,
`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`); the 512 px one is
also declared `maskable`.

## Notes

- `src/lib/api.ts` is the only place that talks to the backend — ~60 typed
  calls. Errors surface as `{ error, code, retryable, user_msg }`.
- Language and direction are set on `<html>` from `session.tsx`
  (ar/darija → RTL).
- `Session.tsx` polls `/questions/:id/state` every 1.5 s, sends
  `If-None-Match`, and renders nothing on 304 — so a quiet tick stays
  under 1 KB.
