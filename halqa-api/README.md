# HALQA v2 — backend (`halqa-api`)

NestJS 11 + TypeScript (strict) + MongoDB (Mongoose). Phase 1–5 built, green.

## Run (clean checkout, 5 steps)

```bash
cd "challenge wie act /halqa-api"
cp .env.example .env          # set MONGODB_URI + TOKEN_SECRET (never commit .env)
npm ci
npm run dev:mongo             # terminal 1 — ephemeral Mongo on :27017 (no Docker needed)
npm run start:dev             # terminal 2 — picks up .env automatically
curl localhost:3000/api/v1/healthz
curl localhost:3000/api/v1/readyz
```

`npm run dev:mongo` keeps its data in the OS temp dir, so it starts empty every
time. For a database you want to keep, use `docker compose up -d mongo` instead
and point `MONGODB_URI` at it.

`.env` is read by `src/main.ts` via `node:process.loadEnvFile`; real environment
variables always win over the file. Tests set `process.env` directly and never
read `.env`.

## Test

```bash
npm run test:unit     # domain, config, schema gate, tokens, scrubber
npm run test:int      # boot + healthz/readyz + event round-trip + error shape
npm run test:schema   # forbidden-field gate (no gender/region/photo)
npm run lint:check    # ESLint 9 (flat config)
npm run lint:secrets  # secrets scan gate (CI)
```

## Live smoke (real provider, 41 checks)

```bash
PROVIDER_BASE_URL=https://aipilot-weld.vercel.app PROVIDER_API_KEY=<key> \
  COMPACT_MODEL=haiku-5.5 LARGER_MODEL=sonnet-5.5 npm run smoke:live
# boots the real app on mongodb-memory-server, walks every endpoint in
# dependency order with real C/L calls: auth→DNA→circles→CF-AS→hints→polls→
# capsule→quiz→whisper→mentor→matcher→coach→game→dashboard→solo→metrics→chaos.
# Last green run: 41 passed, 0 failed · C=13 L=2 lShare=0.133 (target <0.25).
```

## Layout

- `src/core` — validated config, JSON logger + scrubber, global error filter, request-id
- `src/domain` — pure functions, zero Nest imports (`pii.ts`, `ids.ts`, `sbu.math.ts`, `credits.math.ts`, `cache-key.ts`, `arabizi.ts`, `bandit.ts`, `hint-templates.ts`, `context-modes.ts`)
- `src/ai` — adapter (metered), router (1×C pulse + escalation), governor (atomic quota), cache (sha1), queue (FIFO), degradation (G/O/R/B), retrieval (TF-IDF + diagnose)
- `src/persistence` — 15 collections, indexes, unit-of-work
- `src/telemetry` — typed analytics event bus (taxonomy §2.11)
- `src/security` — HMAC tokens, role guard, PII service, chaos toggle (dev-only)
- `src/modules` — circle, session, question, peer-window, hints, auditor, consensus, knowledge, learning, equity, sbu, projections, offline, analytics (`/metrics`), capsule, quiz, solo, mentor, whisper, matcher, workshop, coach, gamification, dashboard, auth
- `src/seed` — stubs until Phase 6 (demo reset)
- `config/*.yaml` (equity, sbu, budget, router), `kb/seeds` (39 chunks, SOURCES 100%), `eval/` (confusion 20, parity 24, seeded 3, whisper truth, users), `offline/pack.json` (30 snippets), `prompts/registers` (ar/darija/fr/en)

## Conventions

- Every error response: `{ error, code, retryable, user_msg: { ar, darija, fr, en } }` — never a stack.
- No `process.env` outside `src/core/config`. No model names/keys outside the Phase-1 adapter.
- IDs are synthetic (`L-01`, `C-3`, `S-…`). No gender/region/photo fields — enforced by `test:schema`.
