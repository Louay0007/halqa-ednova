# HALQA v2 — NestJS + MongoDB Implementation Plan

**Folder:** `challenge wie act /` · **Status:** build-ready plan (pre-coding context)
**Sources reconciled:** `HALQA_v2_Problem-Fit_and_IEEE_Impact.md` (v2 idea) · `HALQA_Backend_Blueprint_and_Data_Plan.md` (data + FastAPI blueprint)
**Stack decision:** **NestJS + TypeScript + MongoDB (Mongoose)** replacing the blueprint's FastAPI + SQLite. All tiers preserved: **T0** deterministic (0 model calls) · **C** compact model · **L** large model.

---

## 0. Read this first — what this document is

It is the *single* context you code from. It contains, in order:

1. Locked decisions and the FastAPI→NestJS mapping (so no ambiguity later)
2. Module map and directory layout
3. Complete MongoDB data model (12 collections + indexes + invariants)
4. Cross-cutting infrastructure contracts
5. AI platform: adapter, router, governor, cache, queue, degradation
6. Feature-by-feature backend spec (every feature in both docs, backend view only)
7. Full REST API surface with JSON shapes
8. Testing / eval / CI gates
9. **The ordered build plan** (§12) with task IDs, dependencies, and definition-of-done

Everything not in this document does not get built.

---

## 1. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | NestJS 11, Node 22 LTS, TypeScript strict | Requested. DI + module boundaries give the "perfectly scalable structure". |
| D2 | MongoDB 7 via official `mongoose` ODM | Requested. Maps cleanly: PK→`_id`, JSON col→`Mixed`, aggregate→pipeline. |
| D3 | **No relational joins needed** — the blueprint's SQLite DDL is 1:1 mappable. See §1.1. | Avoids a document/relational hybrid that would harm the schema. |
| D4 | REST + **polling first**, SSE as an additive upgrade (never a hard dependency) | Blueprint §3.10: venue Wi-Fi is unreliable; polling `/state` every 1.5 s. SSE is a progressive enhancement behind the same poller interface. |
| D5 | Mongoose schemas use **strict + lean reads**, no `@Schema` sprawl in domain services | Domain logic returns plain DTOs; documents never leak above the repository layer. |
| D6 | All model calls go through **one** `LlmPort` (interface). Provider adapter is the *only* file that knows model names/keys | Blueprint §3.2 build-day insurance: swap providers with one file. |
| D7 | Every write that affects scoring emits a **domain event**; S-B-U/credits are projections | Keeps the deterministic maths pure and testable, and gives the analytics taxonomy for free (§2.11 of blueprint). |
| D8 | Sync commands, async work via **in-process queue** (BullMQ optional, behind the same interface) | No Redis dependency for Phase 1. Queue interface allows later swap. |
| D9 | Auth: **passport-free**, self-issued HMAC session tokens for learner/mentor/admin | No PII, no password, no sign-up (spec feature). Demo must be <10 steps. |
| D10 | Chaos switch, PII screen, seed loaders are feature-flagged and **excluded from the production bundle path** via `NODE_ENV` + `CHAOS_ENABLED`. | Blueprint §3.11. |

### 1.1 SQLite DDL → MongoDB mapping (mechanical, no redesign)

| SQLite | MongoDB | Note |
|---|---|---|
| `learners(id TEXT PK, …)` | `learners._id = "L-01"` (string) | Human-readable synthetic IDs preserved (report/analytics use `L-##`) |
| `passports(learner_id PK, style_weights JSON)` | embedded in `learners` | 1:1, always read together → embed. This is the only intentional deviation (see D-note) |
| `circles`, `memberships` | `circles` + `circles.members[]` | bounded (3–5), embedded, never queried standalone |
| `sessions(agenda JSON, s,b,u REAL)` | `sessions` with `agenda`, `health:{S,B,U}` | |
| `questions` | `questions` | index `(sessionId, state, createdAt)` drives the poller |
| `peer_answers` | `peer_answers` | |
| `polls(result JSON)` | `polls.result` | |
| `hints(qid, level, text)` | `hints` `_id = ${qid}:${level}` | natural compound PK becomes `_id` |
| `events(id INTEGER PK, …)` | `events` (ObjectId, sorted by `_id` for ts order) | index `(sessionId, ts)`, TTL optional |
| `llm_calls` | `llm_calls` | index `(step, ts)`, `(tier, ts)` |
| `cache(key PK, value, cites)` | `cache` `_id = sha1(...)` | TTL index on `expiresAt` |
| `quota_ledger(session_id PK, c_used, l_used)` | `quota_ledger` `_id = sessionId` | atomic `$inc` with filter `c_used < quota` |
| `artifacts(kind, body)` | `artifacts` with index `(sessionId, kind)` | capsules, drift maps |
| `mentor_notes` | `mentor_notes` | |

> **Why embedding passports is correct:** a passport is read on every style-coach render, write-once-per-DNA-completion, unbounded growth = none. MongoDB embedding rules (bounded, no independent access pattern) are satisfied.

### 1.2 Tier discipline (non-negotiable, enforced by code)

| Tier | Meaning | Budget per session |
|---|---|---|
| **T0** | Deterministic TS code. S-B-U math, credits, cache keys, matching, state machines, PII screen, Arabizi normaliser, agenda. | 0 calls |
| **C** | Compact model. Group Pulse, Quick Take, hint wording, auditor classify, capsule draft, mentor brief, whisper compare. | **≤ 20** |
| **L** | Large model. Authoring only, escalation-gated. | **≤ 5** |

Every `LlmPort` call **must** pass through `BudgetGovernor.reserve(tier, sessionId)` first. A test asserts no code path calls `larger()` without a reservation. This is the credibility metric for the jury.

---

## 2. Module map

```
HalqaApp
├── CoreModule                 config, logger, error filter, problem filter, request-id, crypto
├── TelemetryModule            domain event bus, event repository, analytics taxonomy emitter
├── PersistenceModule          mongoose connection, repositories (12), transaction helper, unit-of-work
├── AiPlatformModule           ⭐ provider adapter, router, budget governor, cache, queue, degradation
│   ├── AdapterModule          compact(), larger(), available() — ONLY file knowing model names
│   ├── RouterModule            intent/lang/safety/difficulty gate + escalation rules
│   ├── GovernorModule          quota ledger, reservations, meters
│   ├── CacheModule             semantic cache (sha1 key), normalisation, TTL
│   ├── QueueModule             in-process FIFO + position/ETA, retry-once, offline fallback
│   └── DegradationModule       GREEN/ORANGE/RED/BLACK state machine + forced toggle
├── RetrievalModule            ingestion, TF-IDF index, arabizi normaliser, hybrid scoring, cites
├── KnowledgeModule            KB chunk CRUD + seed loader + SOURCES manifest validation
├── LearningModule             DNA items, passport, style weights, bandit
├── CircleModule               circles, membership, context modes, join codes/QR, matching
├── SessionModule              agenda, session lifecycle, host config (window_s)
├── QuestionModule             CF-AS state machine, peer window, questions, peer answers
├── PeerWindowModule           timer, staged progress, window expiry/skip arbitration
├── ConsensusModule            polls, votes, poll-first audit
├── AuditorModule              verify peer answers, seeded-error detection, escalation
├── HintModule                 hint ladder L1..L4, answer-leak gate
├── SoloModule                 Teach-Nova, personas, hat switching, call cap
├── WhisperModule              relay chain, drift map, repair round
├── QuizModule                 bank, Boss Battle, adaptive level
├── CapsuleModule              revision notes, mini-quiz, spaced repetition
├── EquityModule               contribution credits + log cap + dominance detection
├── HealthModule               S-B-U rings maths (pure)
├── CoachModule                Explain-to-me cards, Style Coach nudges, Make-it-click coverage
├── DashboardModule            teacher/mentor aggregation queries
├── WorkshopModule             workshop board, needs_human routing
├── MentorModule               mentor seat, notes, briefs
├── AnalyticsModule            /metrics, funnel, peer-first rate, unit economics
├── GamificationModule         XP, badges (private-first, no public leaderboard)
├── OfflineModule              offline pack serving, sync-when-back
├── SecurityModule             HMAC tokens, roles, PII screen, log scrubber, chaos gate
└── HealthcheckModule          liveness/readiness
```

**Scalability rules (enforced in review):**
1. A module never imports another module's repository directly — only via that module's exported service.
2. No module outside `AiPlatformModule` imports the adapter.
3. Nothing outside `CoreModule` reads `process.env` directly (validated config only).
4. Domain maths (Health, Equity, Cache key, Matcher) is **pure functions in `domain/`** with zero Nest imports — 100% unit-testable without DI.

---

## 3. Directory layout

```
halqa-api/
├── src/
│   ├── main.ts                      bootstrap: helmet, compression, versioned prefix, graceful shutdown
│   ├── app.module.ts
│   ├── core/                        config/ logger/ filters/ interceptors/ pipes/ guards/ crypto/ ids/
│   ├── domain/                      ⭐ PURE: sbu.math.ts credits.math.ts cache-key.ts arabizi.ts
│   │                                matcher.ts claim-coverage.ts pii.ts context-modes.ts
│   ├── persistence/                 schemas/ repositories/ unit-of-work.ts indexes.ts
│   ├── ai/                          adapter/ router/ governor/ cache/ queue/ degradation/ prompts/
│   ├── retrieval/                   ingestion/ index/ tfidf/ arabizi/ hybrid/ citations/
│   ├── modules/                     one folder per §2 module: <name>.module.ts + <name>.service.ts
│   │                                + <name>.controller.ts + dto/ + events/
│   ├── seed/                        loaders for §5 data assets (kb, dna, hints, quiz, offline, eval)
│   └── common/                      decorators/ guards/ dtos/ types/
├── kb/                              seeds/*.json + SOURCES.md  (§5 assets, data not code)
├── config/                          equity.yaml  sbu.yaml  budget.yaml  router.yaml
├── prompts/registers/               ar.md darija.md fr.md en.md
├── eval/                            lang_parity.jsonl confusion_set.jsonl seeded_errors.jsonl
│                                    whisper_groundtruth.json users_fixtures.json
├── offline/pack.json
├── test/                            unit/ integration/ e2e/ eval/ chaos/
├── Dockerfile  docker-compose.yml  .env.example  nest-cli.json  tsconfig.json  README.md
```

**Rule:** `src/domain` and `src/ai` are the only folders allowed to be unit-tested in isolation with zero infra. `kb/`, `eval/`, `config/`, `prompts/` are loaded at runtime via path resolution (never bundled into compiled JS) so seeds are inspectable and diffable.

---

## 4. MongoDB data model

### 4.1 `learners` (embed passport)

```ts
LearnerSchema = {
  _id: string            // "L-01"  (assigned, no PII)
  nickname: string       // required, max 24, sanitised
  avatarKey: string      // neutral icon key ONLY: 'fox|owl|star|deer|...'
  context: 'class'|'study'|'community'|'workshop'|'program'|'solo'
  createdAt, lastSeenAt: Date
  passport?: {
    level: 'novice'|'beginner'|'intermediate'|'advanced'
    levelByTopic: Record<string, Level>          // per topic
    styleWeights: { visual; analogy; steps; example; repetition; practice }  // 0..1, sums to 1
    lang: 'ar'|'darija'|'fr'|'en'
    hintEagerness: number                          // 0..1
    inviteMe: boolean
    explainCardVisible: boolean                    // opt-in
    completedAt: Date
  }
}
// indexes: { lastSeenAt: -1 } ; { 'passport.lang': 1 }
// SCHEMA GATE: a CI test asserts the schema path set contains NO match for
// /gender|sex|region|country|photo|name$|birth|age|address|phone|email/i
```
`name$` must not appear — only `nickname`. This gate is the automated enforcement of F-V2-10 gender-blindness.

### 4.2 `circles`

```ts
Circle = {
  _id: string                  // "C-3"
  topic: string                // 'binary_search' | 'fractions'
  title: string
  context: ContextMode
  lang: Language
  state: 'open'|'live'|'wrapped'
  windowS: 45|60               // host config, clamped 30..90
  hostLearnerId: string
  members: [{ learnerId, role: 'host'|'peer'|'mentor'|'observer', joinedAt }]
  joinCode: string             // 6 chars, unique-ish; QR payload derives from it
  matcherResult?: { seed, groups: [{ circleId, learnerIds, rationale }] }
  createdAt, updatedAt
}
// indexes: { joinCode: 1 } unique-ish, { topic:1, state:1 }, { 'members.learnerId': 1 }
```
Mentor joining sets `role:'observer'` → **no credits, no turns** (Blueprint F-V2-7 acceptance).

### 4.3 `sessions`

```ts
Session = {
  _id: string                    // "S-..." (used as quota ledger key)
  circleId: string
  agenda: { templateId, steps: [{ id, kind:'goal|explain|challenge|teachback|recap',
                                  plannedS, done, completedAt }] }
  health: { S, B, U, computedAt }          // projection, recomputed on event
  healthInputs: {                             // raw ingredients → makes maths auditable
    agendaCompletion, timeDiscipline, recapDone,
    creditsByLearner: Record<string, number>, dispersion,
    checkSuccessRate, avgHintDepth, corrections
  }
  startedAt, endedAt
}
// indexes: { circleId: 1, startedAt: -1 }, { 'health.U': 1 }
```
Storing `healthInputs` is deliberate: the report must show *why* a ring is low, and the mentor brief needs the reason.

### 4.4 `questions` (CF-AS)

```ts
Question = {
  _id, sessionId, circleId
  askerId: string
  text: string                  // PII-screened at write time
  lang: Language
  anonymous: boolean            // author hidden from circle, visible in ledger
  state: 'OPEN'|'NOVA_THINKING'|'RESOLVED'|'CLOSED_UNANSWERED'
  windowS: number
  windowStartedAt, windowEndsAt
  stages: [{ name:'retrieving'|'checking_similar'|'writing'|'verifying', startedAt, doneAt }]
  hintState: 0                 // 0..4, the answer-leak gate input
  quickTake?: { text, cites, hidden:true }     // prepared silently, never sent to peers
  deepDive?: { text, tier:'C'|'L', cites, readyAt }  // slides in later: "deeper answer ready ✨"
  cites: string[]
  escalated: boolean
  resolution: 'peers_verified'|'hint_path'|'skip_direct'|'poll'
  createdAt, resolvedAt
}
// indexes: { sessionId:1, state:1, createdAt:-1 }   ← powers the poller
//          { askerId:1, createdAt:-1 }
//          { 'windowEndsAt': 1 }                     ← background expiry worker
```
`anonymous` + `askerId` co-exist by design: credits/ledger must be auditable, the *circle-facing* API must never return `askerId` when `anonymous=true` (enforced by a response DTO mapper, tested).

### 4.5 `peer_answers`, `polls`, `hints`, `poll_votes`

```ts
PeerAnswer = { _id, questionId, authorId, text, lang, creditsAwarded, createdAt }
//   index { questionId: 1, createdAt: 1 }   → "peers answered?" branch of the state machine
Poll = { _id, sessionId, questionId?, claim, choices[], state:'open'|'closed',
         result?: { tally: Record<string, number>, winner, closedAt },
         reason:'auditor_doubt'|'seeded_error'|'teaching', createdAt }
//   index { sessionId:1, state:1 }
PollVote = { _id, pollId, learnerId, choice, createdAt }   // idempotent by (pollId, learnerId)
Hint = { _id: `${questionId}:${level}`, questionId, level:1|2|3|4, text, cites, createdAt }
```

### 4.6 `artifacts` (capsules, drift maps, explain cards)

```ts
Artifact = { _id, sessionId, circleId, kind: 'capsule'|'drift_map'|'mentor_brief'|'boss_battle',
             body: Mixed, tier: 'C'|'L'|'T0', createdAt }
//   index { sessionId:1, kind:1, createdAt:-1 }
```
`body` shape per kind is validated by a zod/class-validator discriminated union (`ArtifactBodySchema`) — no free-form blobs reach reports.

### 4.7 `cache`

```ts
Cache = { _id: sha1(normalise(intent)+level+lang+sorted(chunkIds)+ladderState),  // == _id
          value: Mixed, cites: string[], tier, hits, createdAt, expiresAt }
//   index { expiresAt: 1 } with expireAfterSeconds: 0   ← TTL, automatic eviction
// Cache key is a pure function in domain/cache-key.ts; tests assert normalisation
// (case/punctuation/whitespace) collapses equivalent re-asks into one key.
```

### 4.8 `quota_ledger`

```ts
QuotaLedger = { _id: sessionId, cUsed: number, lUsed: number, cCap: number, lCap: number,
                reservedC: number, reservedL: number, exhaustedAt?: Date }
```
Reservation is a **conditional atomic update**:
```ts
const ok = await ledger.updateOne(
  { _id: sessionId, $expr: { $lt: [ { $add: ['$cUsed','$reservedC'] }, '$cCap' ] } },
  { $inc: { reservedC: 1 } });
// if matchedCount === 0 → quota exhausted → degradation + fallback path (never silent)
```
Commit on completion (`$inc cUsed:-1, cUsed` net) — this prevents concurrent bursts from overspending, which a plain read-then-write would not.

### 4.9 `llm_calls` (the metrics backbone)

```ts
LlmCall = { ts, sessionId?, step: 'group_pulse'|'quick_take'|'deep_dive'|'hint'|'auditor'
                  |'capsule'|'capsule_polish'|'mentor_brief'|'whisper_compare'|'solo_turn'|'question_coach',
            tier: 'C'|'L', tokensIn, tokensOut, latencyMs, cacheHit: boolean,
            fallbackUsed: string|null, ok: boolean, errorCode?: string }
//   indexes { ts: -1 }, { step: 1, ts: -1 }, { tier: 1, ts: -1 }, { sessionId: 1 }
```

### 4.10 `events` (analytics taxonomy — blueprint §2.11, verbatim set)

```ts
Event = { ts, sessionId, circleId, actor: 'L-01'|'NOVA'|'mentor'|'system',
          type: <the 30+ names in §2.11>, payload: Mixed }
//   indexes { sessionId:1, ts:1 }, { circleId:1, ts:-1 }, { type:1, ts:-1 }
```
Typed union `AnalyticsEventType` mirroring the taxonomy exactly. Emitting an unknown type is a type error → the taxonomy can't silently drift.

### 4.11 `mentor_notes`, `settings`

```ts
MentorNote = { _id, circleId, sessionId?, mentorId, text, kind:'note'|'prompt', createdAt }
Settings  = { _id: 'chaos', mode: 'green'|'orange'|'red'|'black', forcedBy, updatedAt }
Settings  = { _id: 'config', windowS, quotas, cacheTtlS, routerThresholds }   // runtime overrides
```

### 4.12 Database-level invariants (documented as a checklist, enforced in tests)

- No collection may contain a field matching `/gender|sex|region|photo|birth|address|phone|email/i` → `schema-gate.spec.ts`
- `learners._id` matches `^L-\d{2,4}$`; `circles._id` matches `^C-\d{1,3}$`; `sessions._id` matches `^S-`
- Every `Event` has `actor` and `type` from the taxonomy
- `quota_ledger` docs exist for every `sessions` doc (created in the same unit of work)

---

## 5. Seed data assets to build (P3 stream, must be data-not-code)

| Asset | Target | Loader | Validation |
|---|---|---|---|
| `kb/seeds/*.json` | 60–120 chunks; **binary_search ≥ 24** (FR/AR/Darija/EN ≥ 6 each), fractions ≥ 12, rest ≥ 6 | `seed:kb` | schema + duplicate-id + SOURCES manifest coverage (every chunk has `source` + `license`) |
| `bs-probe-*` 3 probes + `bs-misc-*` 3 seeded errors + glossary | verbatim from blueprint §2.1 | `seed:kb` | probe answers match `answers` field |
| DNA items (L1/S1/G1/C1) | 4 micro-items | `seed:dna` | renders in ≤3 min |
| Hint ladder templates L1–L4 | per level | `seed:hints` | leak test: L1–L3 output must not contain the L4 answer string |
| Quiz bank | 12 binary_search + 9 fractions | `seed:quiz` | every `explain_chunk` exists in KB |
| `offline/pack.json` | 30 snippets (12 bs + 8 frac + 10 generic) | `seed:offline` | every `chunk_refs` resolves |
| `config/equity.yaml`, `sbu.yaml`, `budget.yaml`, `router.yaml` | per §2.10 / §3.3 | loaded at boot | yoi/yaml schema validated at boot, fail fast |
| `prompts/registers/*.md` | ar/darija/fr/en | prompts | Darija ≤60 words rule asserted in eval |
| `eval/lang_parity.jsonl` | ≥ 24 rows | `eval:parity` | runs in CI |
| `eval/confusion_set.jsonl` | 20 turns | `eval:confusion` | reports precision |
| `eval/seeded_errors.jsonl` | 3 wrong claims/session | `eval:errors` | reports caught-rate |
| `eval/whisper_groundtruth.json` | claim checklists | `eval:whisper` | drift-map precision |
| `eval/users_fixtures.json` | 5 learners (1 quiet, 1 dominant), 1 teacher, 1 mentor, 30 nicknames | `demo:reset` | deterministic demo reset script |

Arabizi map (`ch→ش, gh→غ, 7→ح, 3→ع, 5→خ, dh→ذ, th→ث, ou→و, y→ي` + cue list) is **code**, in `domain/arabizi.ts`, with table-driven tests.

---

## 6. AI platform contracts (build these before any feature)

### 6.1 Adapter (`src/ai/adapter/provider.adapter.ts`) — the ONLY file with model names/keys

```ts
export interface LlmResult { text: string; tokensIn: number; tokensOut: number;
                            latencyMs: number; cached: false; usage: unknown }
export interface LlmPort {
  compact(req: LlmRequest): Promise<LlmResult>;
  larger(req: LlmRequest): Promise<LlmResult>;
  available(tier: 'C' | 'L'): Promise<boolean>;
}
export interface LlmRequest { step: LlmStep; prompt: string; system?: string;
                              maxTokens: number; schema?: JsonSchema; signal?: AbortSignal }
```
Rules: keys read from validated config only; secrets redacted by the log scrubber; every call persisted to `llm_calls` via an interceptor; `available()` failure flips degradation instead of throwing into the request.

### 6.2 Group Pulse (1×C per turn window, shared)

Batched schema-constrained output consumed by **credits, confusion, intent, language**:
```ts
type GroupPulse = { intent: 'ask'|'explain'|'help_offer'|'dispute'|'chitchat'|'meta';
                    helpful_0_2: number; bridging_bool: boolean; skeptic_bool: boolean;
                    confusion_0_1: number; lang: Language };
```
**Design constraint:** F-V2-4 (credits) and F-CONF (confusion) must add **zero** extra model calls — the pulse is the single shared source. Enforced by a call-count test: one turn window ⇒ at most 1 C call in `llm_calls`.

### 6.3 Router (Stage-0 gate + escalation)

Gate (all in 1 C call where possible): `intent` · `lang/register` · `safety/PII` · `difficulty + synthesis`.
Escalate to L **iff** any of:
1. ≥ 3 chunks with conflicting claims require synthesis
2. gate flags final polished prose as needed
3. C confidence < `router.confidenceThreshold` (config)
4. Auditor or Whisper explicitly escalates (low classify confidence)

Targets (declared, measured via `/metrics`): L-share < 25 % of calls · skeleton < 200 ms · C complete < 4 s · L complete < 12 s.

### 6.4 Budget Governor

Per-session caps from `budget.yaml` (`C: 20, L: 5, solo C: 8`). Order of operations on **every** call:
`PII screen → cache lookup → governor.reserve → adapter → ledger.commit → llm_calls write`.
Denial path is explicit: fallback tier + meter + banner event. Never a silent no-op.

### 6.5 Cache

Key = `sha1(normalise(intent) + level + lang + sorted(chunkIds) + ladderState)` where `normalise` = lowercase, strip punctuation/diacritics, collapse whitespace, strip fillers. TTL: session-scoped for answers; long-lived for probes/glossary. **Cache hits still write an `llm_calls` row with `cacheHit: true`** so the hit-rate metric is honest.

### 6.6 Queue

`AiQueue` interface: `enqueue(step, tier, run): Promise<LlmResult>` returning `{ position, etaMs }` exposed to the UI. Retry **once** as a guided retry (same tier, one rephrase), then C fallback, then offline pack. Implementation: in-process FIFO (`p-queue`) now; BullMQ later behind the same interface.

### 6.7 Degradation state machine

```
GREEN   normal
ORANGE  L slow/unavailable → L queued + ETA, C continues, banner
RED     quota exhausted     → C-only, simplified labels, banner, offline pack allowed
BLACK   service down         → offline pack + polls/roles/flashcards, queue for sync
```
Every transition = banner + event (`fallback_state`) + metrics counter. Forced transitions via `POST /chaos` (dev-only, auth-gated, `CHAOS_ENABLED`).

### 6.8 PII screen & log scrubber

Regex families: phone, email, street address, national ID-ish digit runs, `@handle` + phone combo, plus **reject** photo/voice uploads at the API boundary (multipart not accepted at all in Phase 1 — binary voice is never stored). Runs **before** any model call. Scrubber wraps the Nest logger so no key/PII can reach a log file, screenshot, or video.

---

## 7. Retrieval

- **Ingest:** `kb/seeds/*.json` → validated chunks → **TF-IDF index built at startup** (must be < 1 s; asserted by a startup perf test) → optional local embeddings **declared but default OFF**.
- **Query:** T0 template rewrite → 3 query variants → hybrid score `0.7·vector + 0.3·keyword + 0.15·langBoost` → top-5 + attached claim checklists.
- **Citations:** every grounded answer carries `cites: string[]`; the API returns them as chips; a validator fails the build if a grounded answer has an empty `cites` array.
- **Arabizi:** normalised before retrieval and before language detection.

---

## 8. Feature → backend implementation map (the build checklist)

| ID | Feature | Tier | Backend surface | Acceptance (backend-verifiable) |
|---|---|---|---|---|
| F-V2-1 | Circle First, AI Second | T0+C(+L) | `POST /questions`, `GET /questions/:id/state` (poller), `POST /questions/:id/skip`, `POST /questions/:id/peer-answer`, expiry worker on `windowEndsAt` | Peer-first rate logged; window 30–90 s validated; `skip` reachable in < 2 client actions; state machine has no model dependency |
| F-V2-2 | Explain-to-me card + Style Coach | T0(+C) | `GET /passports/:id/explain-card`, `POST /coach/nudge`, `POST /coach/rephrase` (C, ≤ 80 tok), `POST /coach/coverage-check` | Card renders < 100 ms from passport; nudge never appears in circle feed (private channel asserted); coverage check reuses claim checklist |
| F-V2-3 | S-B-U rings | T0 | `GET /circles/:id/health`, projection updated on every event | `healthInputs` makes each ring reproducible; thresholds 0.75/0.45 drive display tier; unit tests over the worked numbers |
| F-V2-4 | Contribution Credits | T0 (+C via pulse) | `POST /pulse` (internal), `GET /sessions/:id/credits` | Worked example asserted: 12 plain (effective 2·ln13 ≈ 5.1 pre-weight → ≈2.6 at weight 0.5) < 1 question+bridge+vote (7); dominance alert is private-only |
| F-V2-5 | Solo Circle "Teach Nova" | T0+C | `POST /solo/sessions`, `POST /solo/sessions/:id/turn`, `POST /solo/sessions/:id/hat` | ≤ 8 C calls, 0 L calls per solo session (hard test); conversion deep-link preserves passport |
| F-V2-6 | Circle Matcher + Workshop board | T0 | `POST /circles/match`, `GET /board` | 30 nicknames → groups in < 1 s; same seed ⇒ byte-identical result; `needs_human` flag rule (B<0.45 ∨ U<0.45 ∨ misconception open > 3 min) |
| F-V2-7 | Mentor Seat | T0+C | `POST /mentor/notes`, `GET /mentor/brief?circleId` | Brief ≤ 60 words; mentor role = observer (0 credits, 0 turns); never auto-answers |
| F-V2-8 | Whisper Chain | T0 + 1×C | `POST /whisper`, `POST /whisper/:chainId/repair` | ≤ 1 C call typical; drift map has `kept/lost/distorted/added` per claim; seeded run loses "must be sorted" at step 2 |
| F-V2-9 | Context modes | T0 | enum on circle + `GET /contexts/:mode/config` | No code fork; agenda/matcher/mentor-board/spaced-rep/bandwidth all derive from enum |
| F-V2-10 | Gender-blind | T0 (+eval) | schema gate + `eval:parity` | CI fails on forbidden field names; parity report includes gaps honestly |
| F-DNA | Learning DNA + bandit | T0+C | `POST /dna`, `PATCH /passports/:id`, bandit update on check success | `w_style += 0.1·(success − baseline)` renormalised; passport update is atomic |
| F-PACK | Concept Packs | T0 | `GET /kb/chunks?topic&lang`, `POST /admin/kb/seed` | Chunk schema validation; SOURCES coverage 100 % |
| F-HINT | Hint Ladder | C | `POST /questions/:id/hint {level}` | T0 gate refuses level 4 unless `hintState ≥ 3` or skip pressed — enforced in code, not prompt |
| F-CONF | Confusion meter | C (in pulse) | `confusion` field on `events`, `GET /sessions/:id/confusion` | 5 signals implemented; precision reported from `confusion_set.jsonl` |
| F-EQ | Equity Ring | T0 | subsumed by F-V2-3 `B` | — |
| F-FEAR | Ask Without Fear + Question Coach | T0(+C) | `anonymous` on question, `me-too` as a credit-bearing event, `POST /questions/:id/coach` (1×C) | Anonymous questions return no `askerId` to non-asker peers (DTO test) |
| F-AUD | Auditor | C, poll-first | `POST /questions/:id/verify`, `POST /polls` | Poll created when confidence is doubtful; escalation to L only below threshold |
| F-BOSS | Co-op Boss Battle | C | `POST /quiz/battle`, `POST /quiz/battle/:id/answer` | Adaptive level from passport; items drawn from bank so offline works |
| F-CAP | Capsule | C (+L if governor allows) | `POST /sessions/:id/capsule`, `GET /sessions/:id/capsule` | Bullets ≤ 15 words (≤ 12 Darija), visual_desc ≤ 40 words, 3 mini-quiz qids resolve |
| F-DASH | Teacher dashboard | T0 (+briefs) | `GET /dashboard?circleId&since` | Stuck concepts, talk-share, style mix; aggregate only, no learner PII |
| F-WAIT | Waiting UX | T0 | `GET /questions/:id/state` returns real stage names | Stages mirror pipeline; asker-only detail flag; polling payload < 1 KB |
| F-CHAOS | Capacity/Chaos Switch | T0 | `POST /chaos` (dev-only), `GET /degradation` | Forcing each state produces banner event + counter; excluded from prod route registration |
| F-LANG | Multilingual + Arabizi | C | lang fields everywhere, `prompts/registers/*` | Register guides enforced per call; Arabizi→Darija path tested |
| F-GAME | Gamification | T0 | `GET /learners/:id/xp`, `GET /learners/:id/badges` | XP tied to learning signals only; caps enforced (vote 15/day, streak cap 5); **no public leaderboard endpoint exists** |
| F-VOICE | Voice output opt-in | declared ext | out of scope server-side (browser TTS); documented | No audio stored; declared in README/report |
| F-A11Y | Accessibility | T0 | n/a server-side | `bandwidth: 'low'` reduces payload size (asserted in a payload-size test) |
| F-ANAL | Analytics | T0 | `GET /metrics` | Every taxonomy event maps to a stored doc; report numbers equal `/metrics` output |

---

## 9. REST API surface (v1 contract, JSON only)

Base path `/api/v1`. All responses JSON. Errors **always**: `{ error, code, retryable, user_msg: { ar, darija, fr, en } }` — never a stack trace to a learner.

**Identity & DNA**
```
POST /auth/session        {nickname, avatarKey, context}            → {token, learner:{id,nickname,avatarKey}}
GET  /me                                                          → {learner, passport}
POST /dna                   {context, answers[4]}                   → {passport}
GET  /passports/:id/explain-card                                  → {card, visible}
PATCH /passports/:id        {lang, inviteMe, explainCardVisible}     → {passport}
```
**Circles & sessions**
```
POST /circles              {topic, context, lang, windowS?, nicknames?} → {circle, matcher?}
POST /circles/match        {nicknames[], seed?}                    → {seed, groups[]}
POST /circles/:id/join     {joinCode|nickname}                     → {learnerId, role}
GET  /circles/:id                                                   → {circle, members[]}
POST /circles/:id/sessions                                          → {session, agenda}
GET  /sessions/:id                                                 → {session, health, stages}
POST /sessions/:id/end                                             → {endedAt, summary}
```
**Questions / CF-AS**
```
POST /questions            {text, lang?, anonymous?, skip?}        → {qid, state, windowS, windowEndsAt}
GET  /questions/:qid/state                                       → {state, stages, peerCount, quickTakeReady,
                                                                   deepDiveReady?, answer?, cites?}
POST /questions/:qid/peer-answer {text}                           → {aid, creditsAwarded}
POST /questions/:qid/answer     {text}                            → {aid}          // peer's answer attempt
POST /questions/:qid/me-too                                      → {ok}
POST /questions/:qid/skip                                        → {answer, tierUsed, cached, cites[]}
POST /questions/:qid/hint       {level}                           → {hint, level}
POST /questions/:qid/verify                                       → {verdict, poll?}
POST /questions/:qid/coach      {mode:'rephrase'}                 → {suggestion}     // ≤ 1 C
```
**Consensus, solo, whisper, quiz, capsule**
```
POST /polls                 {questionId?, claim, choices[]}       → {poll}
POST /polls/:pid/vote       {choice}                              → {tally}
POST /polls/:pid/close                                        → {result}
POST /solo/sessions         {topic, lang, level?}                 → {session, hat:'NOVA_NOVICE'}
POST /solo/sessions/:sid/turn {text}                             → {novaTurn, hint?, progress}
POST /solo/sessions/:sid/hat {hat}                               → {hat}
POST /solo/sessions/:sid/invite                                 → {deepLink, code}
POST /whisper               {topic}                               → {chain, driftMap}
POST /whisper/:cid/repair   {text}                               → {coverage}
POST /quiz/battle           {circleId}                            → {items[3]}
POST /quiz/battle/:bid/answer {qid, choice}                      → {correct, explain, xp}
POST /sessions/:id/capsule                                      → {capsule}
GET  /sessions/:id/capsule                                      → {capsule}
```
**Health, board, mentor, analytics, ops**
```
GET  /circles/:id/health                                         → {S,B,U, tiers, credits[], needsHuman}
GET  /sessions/:id/credits                                        → {credits[], dispersion, topContributorId}
GET  /board?workshop=1                                            → {circles[{id,S,B,U,needsHuman}]}
POST /mentor/notes            {circleId, text}                   → {note}
GET  /mentor/brief?circleId=                                    → {brief, words}
GET  /metrics                                                       → {callsByTier, lShare, p50, p95, cacheHitRate,
                                                                      peerFirstRate, fallbackCounts, quotaUsage}
GET  /degradation                                                  → {mode, banner, since}
POST /chaos                   {mode}                              → {mode}          // dev-only, auth-gated
GET  /kb/chunks?topic&lang                                         → {chunks[]}      // admin in prod
GET  /healthz  /readyz
```
**Poller contract:** `GET /questions/:qid/state` must stay **< 1 KB**, return stage *names* only (no prompt/内部 detail to non-askers), and support `ETag`/`If-None-Match` → `304`.

---

## 10. Testing & CI gates

| Suite | Command | Asserts |
|---|---|---|
| Unit (domain) | `npm run test:unit` | S-B-U maths, credits log-cap `2·ln(1+n)`, cache-key normalisation, matcher determinism, PII regexes, Arabizi map, claim coverage, context-mode config — **no DI, no Mongo** |
| Integration | `npm run test:int` | Full ask flow with **mocked LLM** in 3 scripts: peers-answer / nobody-answers / skip; quota exhaustion → fallback; anonymous DTO masking |
| Schema gate | `npm run test:schema` | No forbidden fields; ID formats; every session has a ledger |
| Evals | `npm run eval:all` | confusion precision · seeded-error caught rate · whisper drift precision vs ground truth · lang parity (length/toxicity automated + human 1–5) |
| Chaos | `npm run test:chaos` | Force orange/red/black → correct degradation state, banner event, counter increments, offline pack served, queue sync |
| Security gate | `npm run lint:secrets` | grep for key patterns; fails build |
| Contract | `npm run test:contract` | Every route in §9 exists and returns the documented error shape |

**Hard invariants asserted in CI (these are the report's credibility):**
1. `L-share < 25 %` across the integration scripts.
2. Solo session ≤ 8 C calls, **0 L calls**.
3. Whisper run ≤ 1 C call typical.
4. No grounded answer with empty `cites`.
5. No L call without a prior `governor.reserve`.
6. Report metrics = `/metrics` output (a test regenerates the report table from `/metrics`).

---

## 11. Runtime, deploy, security

- **Dev:** `docker compose up mongo` (or Atlas) + `npm run start:dev` with `mongodb-memory-server` for tests (no external DB needed in CI).
- **Prod:** single container `node dist/main` + Mongo volume; env via platform secrets; `CHAOS_ENABLED=false`; `NODE_ENV=production` strips `/chaos` and `/admin` routes at bootstrap (asserted by a test that the router has no chaos handler in prod mode).
- **Config:** `.env.example` with keys **empty**: `MONGODB_URI, PROVIDER_BASE_URL, PROVIDER_API_KEY, COMPACT_MODEL, LARGER_MODEL, QUOTA_C, QUOTA_L, WINDOW_S, CHAOS_ENABLED, TOKEN_SECRET`.
- **Security:** HMAC session tokens (learner/mentor/admin roles), helmet, CORS allowlist, request-size limits, global rate limit on write routes, PII screen pre-model, scrubbed logs, no multipart in Phase 1.
- **Declared externals (README + report):** model provider, optional browser speech synthesis, hosting.

---

## 12. ORDERED BUILD PLAN

Each phase ends with a runnable, demonstrable state. **Do not start a phase before the previous phase's exit criteria pass.** Owners: **BE** (backend/AI), **FE** (frontend), **DA** (data/eval). Timeline assumes 5 weeks; deadline-gated by the 3-person split.

### Phase 0 — Foundation (2 days) — BE
| # | Task | Dep |
|---|---|---|
| 0.1 | `nest new halqa-api --strict`, tsconfig strict, eslint+prettier, husky, CI workflow | — |
| 0.2 | `CoreModule`: validated config (Joi/zod), request-id, structured logger + scrubber, global exception filter producing the §9 error shape | 0.1 |
| 0.3 | `PersistenceModule`: Mongoose connection (retry + health), `unit-of-work.ts` (session-backed transactions for ledger+events) | 0.1 |
| 0.4 | All 12 schemas + indexes (§4) as code, plus seed loaders wired but empty | 0.3 |
| 0.5 | `TelemetryModule`: typed event union (§4.10) + `emit()` + repository | 0.3 |
| 0.6 | `test:schema` gate green (§10) | 0.4 |
| 0.7 | `SecurityModule`: HMAC tokens, roles guard, PII screen, chaos gate | 0.2 |
| **Exit** | `npm run start:dev` boots, `/healthz` + `/readyz` green, schema gate green, an event can be emitted and read back |

### Phase 1 — AI platform spine (3 days) — BE · **blocks every C/L feature**
| # | Task | Dep |
|---|---|---|
| 1.1 | `LlmPort` + `ProviderAdapter` (compact/larger/available) + secrets only from config | 0.7 |
| 1.2 | `llm_calls` write interceptor (all calls logged, scrubbed) | 1.1 |
| 1.3 | `CacheModule` + pure `cache-key.ts` + TTL index | 0.4 |
| 1.4 | `QuotaLedger` atomic reserve/commit + `BudgetGovernor` + deny-path fallback | 0.4 |
| 1.5 | `AiQueue` (in-process FIFO, position/ETA, retry-once) | 1.1 |
| 1.6 | `DegradationModule` state machine + forced toggle + counters | 1.4, 1.5 |
| 1.7 | `RetrievalModule`: TF-IDF ingest < 1 s, hybrid scoring, lang boost, cites | 0.4, 1.1 |
| 1.8 | `RouterModule`: Group Pulse (1×C, shared schema), gate, escalation rules | 1.1, 1.4 |
| **Exit** | Integration test: 3 mocked scripts run end-to-end; `/metrics` shows lShare < 25 %; forcing RED yields fallback + banner |

### Phase 2 — Deterministic core (2 days) — BE + DA
| # | Task | Owner | Dep |
|---|---|---|---|
| 2.1 | `domain/sbu.math.ts` + tests incl. worked numbers | BE | 0.5 |
| 2.2 | `domain/credits.math.ts` (weights, log cap, dispersion, dominance private alert) | BE | — |
| 2.3 | `domain/arabizi.ts` + `domain/pii.ts` + tests | BE | — |
| 2.4 | `KnowledgeModule` + `seed:kb` loader + SOURCES validation | DA | 0.4 |
| 2.5 | **All KB seeds** (≥24 binary_search, ≥12 fractions, probes, seeded errors, glossary) | DA | 2.4 |
| 2.6 | `LearningModule`: DNA items, passport write, bandit update | BE | 2.4 |
| 2.7 | Event→projection wiring: every event recomputes affected S-B-U/credits | BE | 2.1, 2.2, 0.5 |
| **Exit** | Credits worked example test passes (12 plain → effective 5.1 → ≈2.6 weighted < 7); S-B-U reproducible from `healthInputs` |

### Phase 3 — Circle + CF-AS vertical slice (4 days) — BE (+FE contract)
| # | Task | Owner | Dep |
|---|---|---|---|
| 3.1 | `CircleModule` (create/join/roles/joinCode) + `contexts/:mode/config` | BE | 0.4 |
| 3.2 | `SessionModule` (agenda template per context, start/end, health projection) | BE | 2.7 |
| 3.3 | `QuestionModule` create + state machine | BE | 3.2 |
| 3.4 | `PeerWindowModule`: window timer, expiry worker on `windowEndsAt`, staged progress, skip path | BE | 3.3 |
| 3.5 | `HintModule` L1–L4 + T0 leak gate | BE | 1.8, 3.3 |
| 3.6 | `AuditorModule` verify + poll-first + escalation | BE | 1.8, 3.3 |
| 3.7 | `ConsensusModule` polls/votes/close (idempotent votes) | BE | 3.3 |
| 3.8 | Parallel hidden Quick Take prep + queued Deep Dive with `✨` readiness flag | BE | 1.5, 3.4 |
| 3.9 | `GET /questions/:qid/state` poller (< 1 KB, ETag, asker-only detail) | BE | 3.4 |
| 3.10 | Integration scripts: peers-answer / nobody-answers / skip, all mocked-LLM green | BE | 3.4–3.7 |
| **Exit** | Vertical slice demoable end-to-end: ask → peer window → hint/verify/poll → resolved; peer-first rate logged |

### Phase 4 — People & equity (3 days) — BE + DA
| # | Task | Owner | Dep |
|---|---|---|---|
| 4.1 | `EquityModule`: credits award on every event, private dominance alert, `GET /sessions/:id/credits` | BE | 2.2 |
| 4.2 | `CoachModule`: explain-card render < 100 ms, private Style Coach nudge, rephrase (1×C ≤ 80 tok) | BE | 2.6 |
| 4.3 | Claim coverage checker ("Make it click") reused by Auditor + Whisper | BE | 2.4 |
| 4.4 | `F-FEAR` anonymous path + DTO masking test + "me too" credit | BE | 3.3 |
| 4.5 | `SoloModule`: Teach-Nova, hats, ≤ 8 C cap test, invite deep-link | BE | 3.5, 3.6 |
| 4.6 | `GamificationModule` XP + badges + daily caps, **no leaderboard route** | BE | 4.1 |
| 4.7 | Quiz bank + `QuizModule` Boss Battle (adaptive) | DA+BE | 2.4 |
| **Exit** | Quiet-vs-dominant scenario passes acceptance (quiet voter ≥ 60 % of top contributor); solo session ≤ 8 C / 0 L |

### Phase 5 — Outputs, mentor, workshop (3 days) — BE
| # | Task | Owner | Dep |
|---|---|---|---|
| 5.1 | `CapsuleModule` draft (C) + optional L polish gated by governor + spaced repetition across sessions | BE | 1.4 |
| 5.2 | `WhisperModule` chain + 1×C compare + drift map + repair round | BE | 4.3 |
| 5.3 | `MatcherModule` deterministic greedy matcher + `WorkshopModule` board + `needs_human` rule | BE | 2.6 |
| 5.4 | `MentorModule`: observer seat, notes, `GET /mentor/brief` (1×C ≤ 60 words) | BE | 5.3 |
| 5.5 | `DashboardModule` aggregation endpoints | BE | 4.1 |
| 5.6 | `AnalyticsModule` `/metrics` + funnel + unit economics | BE | 0.5, 1.2 |
| **Exit** | All §7 metrics endpoints populated; seeded whisper run drops "must be sorted" at step 2 |

### Phase 6 — Resilience, offline, ops (2 days) — BE + DA
| # | Task | Owner | Dep |
|---|---|---|---|
| 6.1 | `OfflineModule` + 30-snippet pack + sync-when-back | BE+DA | 1.6 |
| 6.2 | Chaos test suite (orange/red/black) | BE | 6.1 |
| 6.3 | Dockerfile + compose + healthchecks + graceful shutdown + prod route stripping | BE | 0.2 |
| 6.4 | `seed:demo` deterministic demo reset (5 learners incl. quiet+dominant, teacher, mentor, 30 nicknames) | DA | 2.5 |
| 6.5 | Eval suites + parity set + CI wired to fail the build | DA | 2.5 |
| 6.6 | Secrets scan gate + README run in < 10 steps from clean checkout | BE+DA | 6.3 |
| **Exit** | Chaos rehearsal filmed; `npm run eval:all` green; clean-checkout run verified |

### Phase 7 — Hardening & report numbers (2 days) — all
| # | Task | Dep |
|---|---|---|
| 7.1 | Contract tests for every §9 route + error-shape test | 5.6 |
| 7.2 | Load sanity: 50 concurrent pollers on one session, p95 budget respected | 6.6 |
| 7.3 | Generate report metric tables **from** `/metrics` (no hand-typed numbers) | 7.1 |
| 7.4 | Deferred: SSE upgrade (additive), BullMQ swap (additive), local embeddings (declared, off) | — |

**Critical path:** 0 → 1 → 3 → 5 → 6. **Parallel:** DA seeds/evals run from Phase 0 onward (they never block BE). **Freeze rule:** anything not finished and tested by the freeze date moves to the roadmap slide.

---

## 13. Ownership split (3 people)

| Stream | Owns |
|---|---|
| **P1 — Backend/AI** | Phases 0, 1, 3, 5, 6, 7 · adapter, router, governor, cache, queue, retrieval, CF-AS, auditor, hints, whisper, capsule, matcher, mentor, metrics, chaos |
| **P2 — Frontend/UX** | PWA shell against §9 contract (starts Phase 3 with the poller), circle/question/poll/whisper/capsule/dashboard/board screens, S-B-U rings, banners, skeleton-first, a11y, offline client |
| **P3 — Data/Eval/Biz** | All §5 seeds, registers, eval fixtures + suites, demo reset, user-test fixtures, report tables generated from `/metrics`, video/pitch assets, LOI |

Frontend starts Phase 3 because the poller + `state` shape is the contract everything else hangs off — publish the §9 contract as a generated OpenAPI file at the end of Phase 3 so FE is never blocked by BE drift.

---

## 14. Risk register (backend-specific)

| Risk | Impact | Mitigation in this plan |
|---|---|---|
| Provider outage/rate limit mid-demo | Demo dies | Adapter + degradation machine + offline pack + rehearsed chaos (§6.7) |
| Quota exhausted before demo | Answers stop | Governor + RED mode (circle still works) + explicit banner |
| Feature creep from v2 P1 items | Nothing finished | Phase gates + freeze rule; P1 items are Phase 5, isolated |
| Schema drift vs docs | Report/DB mismatch | Schemas are code; `seed:kb` validation + schema gate in CI |
| Cache serving a wrong answer | Credibility loss | Key includes intent+level+lang+chunks+ladderState; tests assert normalisation scope |
| Anonymous identity leak | Ethics failure | Single DTO mapper + dedicated test; `askerId` never serialised for non-askers |
| Latency spikes on venue Wi-Fi | Frozen UI | Polling with ETag, < 1 KB payloads, skeleton-first, peer window hides wait |
| Polling storm | DB overload | 1.5 s interval + ETag/304 + cache headers + rate limit; SSE only as upgrade |

---

## 15. Definition of done (backend)

- [ ] Clean checkout → running API in < 10 documented steps (Mongo via compose or Atlas)
- [ ] All §9 routes implemented, contract-tested, uniform error shape
- [ ] CI green: unit + integration (3 CF-AS scripts) + schema gate + evals + chaos + secrets scan
- [ ] `/metrics` shows: L-share < 25 %, cache hit rate, p50/p95 per tier, peer-first rate, fallback counts, quota usage
- [ ] Invariant tests pass: solo ≤ 8 C / 0 L · whisper ≤ 1 C · no un-cited grounded answer · no L without reservation · no forbidden schema field
- [ ] Seeded demo reproducible via `seed:demo` (quiet + dominant + seeded error + Arabizi + chaos)
- [ ] Report numbers generated from `/metrics`, not hand-typed
- [ ] `.env.example` has zero values; secrets scan clean; `CHAOS_ENABLED=false` in prod; chaos routes absent in prod bundle