# HALQA — a GenAI peer-learning companion that puts the circle first

**IEEE WIE ACT 5.0 — EdNova GenAI Peer-Learning Companion Challenge · Phase 1 submission**

Learning groups collapse into one dominant voice, passive listeners, and uncritical
acceptance of wrong answers. **HALQA** (Arabic for *circle*) orchestrates *human-first*
study sessions: every question is offered to **peers** for 45–60 s while the AI companion
**Nova** prepares a hidden, verified answer that is released only at the window's end.
A learning-DNA diagnostic personalizes level, style, register, and language
(Arabic, Tunisian Darija with Arabizi, French, English).

## What's inside

| Path | What it is |
|---|---|
| [`halqa-api/`](halqa-api) | NestJS 11 + MongoDB backend — Circle-First Ask, DNA passport, hint ladder (L1–L4), Auditor verification, Whisper drift-map, revision capsules, quiz battles, S-B-U health rings, matcher, mentor briefs |
| [`halqa-web/`](halqa-web) | React + Vite **PWA** — Solo, Mentor, Circles, Session, Debrief and facilitator board screens; four languages; offline pack |
| [`report/`](report) | Phase 1 **technical report** (LaTeX + PDF, ≤6 pages, incl. business-model note) |
| `HALQA_*.md` | Design blueprints: backend/data plan, NestJS implementation plan, frontend UI/UX plan |

## Documented model-routing policy

Two model categories are combined deliberately, per the challenge:

- **Compact (C)** — Group Pulse routing (intent, language/register, safety/PII, difficulty
  gate, all batched into one schema-constrained call), Quick Take drafts, hint ladder,
  polls/quizzes, language rewriting.
- **Larger (L), escalation only** — ≥3 retrieved chunks with conflict (multi-source
  synthesis), polished capsule prose, low C confidence, explicit Whisper/Auditor escalation.

Measured on a **41-check live smoke** against the real inference platform:
**C = 13, L = 2, L-share = 0.133** (target < 0.25) · 41 passed, 0 failed.

## Engineered behaviour under limited capacity

`GREEN → ORANGE` (L slow: queue + retry, C continues) `→ RED` (quota out: C-only)
`→ BLACK` (outage: offline pack) — every transition shown as a UI banner + telemetry
event. A quota governor, FIFO queue with ETA, and a semantic cache
(`sha1(intent + level + lang + chunk_ids + ladder_state)`) keep requests few and well-built.

## Privacy & ethics (enforced in the schema, not by policy)

Learners are artificial IDs (`L-01`); the persona table has **no columns for name, photo,
gender, or region** — a schema-gate test fails the build if one appears. PII screeners run
before any model call; logs are scrubbed; a secrets-scan gate keeps credentials out of the
repo. Wrong answers are met with a guiding question, never a reprimand.

## Quick start

```bash
# backend  (see halqa-api/README.md for full details)
cd halqa-api
cp .env.example .env        # set MONGODB_URI + TOKEN_SECRET (never commit .env)
npm ci
npm run dev:mongo           # terminal 1 — ephemeral Mongo on :27017
npm run start:dev           # terminal 2 — API on :3000
curl localhost:3000/api/v1/healthz

# frontend
cd halqa-web
npm ci
npm run dev                 # PWA on :5173
```

Tests: `npm run test:unit` · `test:int` · `test:schema` · `lint:secrets` (in `halqa-api`).

## License

MIT — the team retains full ownership of code and work.
