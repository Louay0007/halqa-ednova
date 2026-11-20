# HALQA — Production Readiness Plan

Status: **not production-ready.** Demo-complete and internally coherent, but three classes of
defect block a public deployment: an uncommitted-frontend build break, open read endpoints that
expose other learners' data, and all mutable session state living in process memory.

This document is the work order. Every finding below was verified against the tree at
`bcdfdbe` + uncommitted working set, not inferred from the specs.

---

## 1. Definition of "production"

Before the tracks, fix the target, because several "defects" are only defects relative to it.

| Dimension | Target | Why this and not more |
|---|---|---|
| Availability | 99.5% monthly on the API, single-region | Classroom-scale pilot; 99.9% needs multi-AZ and buys nothing at this traffic |
| Latency | p95 < 400 ms on non-AI routes; AI routes bounded by quota governor, not latency SLO | AI latency is provider-bound; the governor already degrades rather than waits |
| Durability | Zero loss of a learner's XP/badges/battle history across a deploy | Currently lost on every restart (§3.6, §4.1) |
| Isolation | No learner can read another learner's session, answers, or passport | Currently violated (§2.1–2.5) |
| Capacity | 200 concurrent learners, ~40 concurrent circles, one 45 s window each | Extrapolated from `WINDOW_S=45`, poller cadence, and a class of 30 |
| Compliance | No PII beyond `nickname`; export + delete on request | Matches the existing schema-gate promise in `README.md` |
| Rollback | Any deploy revertible in < 5 min with no data loss | Forces migration discipline (§6.4) |

**Non-goals, explicitly.** No leaderboard, no photo/name upload, no cross-circle social graph, no
public profiles. These are product invariants from `HALQA_UI_UX_Specification.md` §8.2 and several
of the fixes below would violate them if done naively (e.g. making `/board` public-but-richer).

---

## 2. Track 0 — Repository integrity (P0, blocks everything)

### 2.1 A clean clone cannot build the frontend

`halqa-web/src/routes/Session.tsx:8-10` is tracked and imports:

```
import { Composer, QuestionCard, StaleChip } from './session/QuestionFeed';
import { MembersBar } from './session/MembersRail';
import { CreditBar, RingsLegend } from './session/Shared';
```

but `git ls-files halqa-web/src/routes/session` returns **nothing** — the whole directory is
untracked, along with `components/PassportView.tsx`, `lib/degradation-copy.ts`,
`lib/motion-variants.ts`, `styles/night.fixes.css`, and `CHANGELOG.md`. `Me.tsx`,
`PassportSheet.tsx`, and `session.tsx` also import these.

**Change:** commit the 11 untracked files and the 37 modified tracked files as one reviewable
commit before any other work. Run `git clean -ndx` first and confirm the list matches intent.

**Acceptance:** `git clone` into a temp dir → `npm ci && npm run build` in `halqa-web` exits 0.
Add this as a CI job so it can never regress.

### 2.2 Repo hygiene

`demo/`, `presentation/`, `report/`, `EdNova_Challenge_Specification_book.pdf`, and `.DS_Store`
sit at the root. `demo/` contains `node_modules`-adjacent lockfiles and `record.cjs`.

**Change:** keep `report/` and `presentation/` (they are deliverables), move `demo/` under
`tools/demo/`, add `.DS_Store` to `.gitignore` (already present — verify it is not committed),
and drop the vendored PDF in favour of a link.

### 2.3 No CI

`.github/workflows` does not exist, despite `package.json` already defining every gate:
`lint:check`, `test:unit`, `test:int`, `test:schema`, `test:contract`, `lint:secrets`, `build`,
`eval:all`, `smoke:live`.

**Change:** two workflows.

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  api:
    - npm ci
    - npm run lint:check
    - npm run build
    - npm run test:unit
    - npm run test:int          # uses mongodb-memory-server, no URI needed
    - npm run lint:secrets
  web:
    - npm ci && npm run lint && npm run build
```

Plus `nightly.yml` running `eval:all` and `smoke:live` against staging with a real
`PROVIDER_API_KEY`, uploading the report as an artifact. The eval harness already writes
`eval/*.jsonl` fixtures (§7.3) — turn its output into a tracked trend so the L-share claim in
`README.md` (0.133) is defended continuously rather than once.

**Acceptance:** a PR with a deliberately broken import fails in < 6 min; `main` is protected and
requires both jobs.

---

## 3. Track 1 — Security and authorization (P0)

The global `TokenGuard` is default-deny, which is the right foundation. The gap is `@Public()`:
it was applied to reads that turn out to be member-scoped, and to two endpoints that leak
operational data. Below, "member" means a learner with a row in `circle.members`.

### 3.1 `GET /questions?sessionId=` leaks every session to every learner

`question.controller.ts:65` calls `listBySession(sessionId)` with no membership check, while the
sibling `POST /questions` at `:71` correctly calls `members.assertSessionMember`. Any signed-in
learner can enumerate `S-1…S-n` (ids are sequential, see §3.3) and read all questions, peer
answers, and resolution state.

**Change:** inject `MembershipService`, resolve `sessionId → circleId`, assert membership before
listing. Reuse the same helper.

**Acceptance:** integration test — learner A authenticated, `GET /questions?sessionId=<B's>` → 403.

### 3.2 `GET /questions/:qid/state` trusts the `asker` query param

`question.controller.ts:78-88` passes `@Query('asker')` straight into `getState(qid, asker)`.
That flag gates asker-only fields — `stages`, `quickTakeReady`, `deepDive` (see
`question.service.ts:287-303`). Passing another learner's id reveals Nova's hidden answer before
the window closes, which defeats the core product mechanic.

**Change:** delete the `asker` param. Derive the viewer from `@CurrentUser('sub')` via
`@OptionalUser` (the route must stay reachable while anonymous peers read the poller), and add a
membership assertion. Keep the ETag stable — it is currently a hash of the view, so a
viewer-dependent body needs the viewer id folded into the hash, or asker-only fields must move to
a separate `GET /questions/:qid/private` so the shared poller keeps one cacheable body.

**Recommended:** the second option. It preserves the `<1 KB` payload and 304 behaviour from
`HALQA_UI_UX_Specification.md` §8.2, which is currently being met deliberately.

**Acceptance:** `GET /questions/:qid/state?asker=<other>` returns no `stages`/`deepDive`; the
new private route 403s for non-members. Test the 304 path still works across two viewers.

### 3.3 `GET /circles/:id` is public and returns the join code

`circle.controller.ts:74` is `@Public()`, and `circle.service.ts:105-111` returns the entire
circle document spread into the response — including `joinCode` and the full member list with
nicknames and learner ids. Ids are sequential (`C-1`, `C-2`; `ids.ts`), so the public `/board`
at `workshop.controller.ts:43` hands out a complete enumeration list.

Net effect: anyone can walk every circle, harvest every join code, and join as a peer.

**Change:**
- make `GET /circles/:id` member-scoped via the token;
- keep a narrow public shape for the join screen: `{ circleId, topic, hostNickname, memberCount }`,
  which `GET /circles/by-code/:code` already returns correctly;
- stop spreading the document — project an explicit `CircleView` DTO;
- switch circle/session/question ids from sequential to opaque (`randomBytes(4).toString('hex')`
  or a short ULID). Sequential ids are the root enabler of enumeration and cannot be fixed by
  authz alone once a link is shared.

**Acceptance:** unauthenticated `GET /circles/C-1` → 401/403. `joinCode` absent from every
response except the creator's own create/join response. Ids non-guessable; a test asserts the id
regex excludes `^\w-\d+$`.

### 3.4 `GET /metrics`, `GET /dashboard`, `/telemetry/.../events` are public

`analytics.controller.ts:23`, `dashboard.controller.ts:16`, `telemetry.controller.ts:5` are all
`@Public()`. `/metrics` exposes per-tier call counts, latency percentiles, cache hit rate, and
quota usage — a free map of the AI cost structure and a cheap way to detect quota exhaustion
timing. `/telemetry` streams every actor id and event for a session.

**Change:** these become `@Roles('mentor','admin')` for `/dashboard` and `/metrics` (aggregate
only, no per-caller data), and `@Roles('mentor','admin')` + circle-scoped for telemetry. Keep
`GET /degradation` public — the banner genuinely needs it (the comment in
`chaos.controller.ts` is right about that).

The `/lab` screen is a demo surface; gate it behind an `admin` role and a build flag so it does
not ship in a public bundle.

**Acceptance:** each route 403s for a plain learner token; `/lab` is absent from the production
build (`import.meta.env.PROD` guard + route removal).

### 3.5 `GET /learners/:id/xp` is a cross-learner read oracle

Separate from the self-award problem below: `gamification.controller.ts:24-32` reads XP and badges
for **any** `:id` with only `@Roles('learner')` — no `id === learnerId` check, unlike the `POST`
sibling at `:35` which does check. Any learner can walk `L-01…L-n` (sequential ids, §3.3) and read
every peer's XP, badge set, and therefore participation level. Low direct impact, but it is a
violation of the isolation invariant and it is free to fix.

**Change:** either scope both reads to the caller (`/learners/me/progress`) or assert membership in
a shared circle before returning another learner's numbers, and return badges only if the product
wants peer-visible achievements — which §8.2 says it does not ("no leaderboard"). Prefer
`/learners/me/progress` and delete the `:id` form.

**Acceptance:** `GET /learners/L-02/xp` as `L-01` → 403/404; `/learners/me/progress` returns own data.

### 3.6 Self-awarded XP

`gamification.controller.ts:36-44` accepts any `signal` in `XP_TABLE` from the caller. It blocks
awarding *to another* learner but lets a learner mint unlimited XP by replaying a signal.
Combined with §4.1 (XP is in-memory) the fix is the same rewrite: XP must be a server-side
consequence of an action the server already witnessed, never an inbound request.

**Change:** delete `POST /learners/:id/xp`. Award from the services that own the action
(`peer-window.settle`, `quiz.answer`, `capsule.build`, `question.peerAnswer`).

### 3.7 No rate limits on anything that spends money or writes rows

Verified: only `auth/session` (20/60s), `auth/register` (20/60s), `auth/login` (10/60s),
`auth/passphrase` (10/60s), and `mentor/notes` carry `@RateLimit`. Unthrottled and
AI-spending: `coach/nudge`, `coach/rephrase`, `hints`, `solo/*`, `capsule/build`,
`whisper/*`, `questions/:qid/peer-answer`, `poll-vote`, `circles` create/join,
`circles/by-code` (join-code brute force), `quiz/battle`.

**Change:** add `@RateLimit` to every one, tiered: AI routes 10/min per learner, write routes
30/min, `by-code` 5/min per IP (this is the brute-force target), create-circle 3/min per IP.
Note the existing guard keys by learner when signed in, IP otherwise — that is correct; extend
it rather than replace it.

**Acceptance:** the existing `test/integration/rate-limit.spec.ts` gains a case per new route.

### 3.8 The rate limiter is per-instance and unbounded

`rate-limit.guard.ts:12` is `private readonly buckets = new Map<string, Bucket>()` with no
eviction. Under >1 replica the limit multiplies by replica count; under sustained traffic the map
grows without bound (memory leak). The code comment is honest about this ("not a replacement for
an edge limiter"), but there is no edge limiter.

**Change:** two layers.
1. Edge/ingress limiter (Cloudflare, ALB WAF, or nginx `limit_req`) as the real budget.
2. Replace the in-process map with a Mongo TTL collection or Redis (`rate-limit` buckets keyed
   `caller:route:windowStart`), so it is shared and self-expiring.

**Acceptance:** two app instances behind a load balancer enforce one combined budget; memory
stays flat over a 1 h soak with 200 rps of distinct callers.

### 3.9 Token model gaps

`tokens.ts` is a sound HMAC bearer with an `ep` epoch, but:
- 24 h TTL, no refresh → learners are logged out mid-session on a long day;
- rotating `TOKEN_SECRET` signs *everyone* out at once (acknowledged in `.env.example` as "the
  intended lever"); with no dual-key window, rotation is an outage;
- token lives in `sessionStorage` (`api.ts:36`), readable by any XSS.

**Change:** verify against a key **list** (`TOKEN_SECRET` + `TOKEN_SECRET_PREVIOUS`) so rotation
is a rolling deploy; shorten access TTL to 2 h and add `POST /auth/refresh` that re-mints from the
same epoch; add a strict CSP (`helmet` is enabled at `main.ts:31` but with default directives):

```
default-src 'self'; script-src 'self'; object-src 'none';
connect-src 'self' https://<api-host>; img-src 'self' data:;
frame-ancestors 'none'; base-uri 'none'
```

Moving the token to an `HttpOnly; Secure; SameSite=Strict` cookie is the stronger fix but requires
CSRF tokens on the mutating routes. Decide once: **cookie + CSRF** is the production answer;
`sessionStorage` + CSP is acceptable only if the CSP is real and tested.

**Acceptance:** rotation test — old and new secret both verify for one deploy; a CSP report-only
run for a week shows zero violations before enforcement.

### 3.10 PII and input validation

Already good: `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` at `main.ts:34`,
DTOs are real `class-validator` classes, `pii.ts` + scrubber, and a schema-gate unit test that
fails the build if a name/photo column appears. Keep all of it.

Gaps: no data-export or delete endpoint (§6.5); `UpdateMeDto` allows `nickname` freely — ensure
it passes the same scrubber as asker text; `POST /auth/session` mints a durable anonymous
account with no cap per IP beyond 20/min, which is a cheap way to inflate the learners collection.

**Acceptance:** a learner can `GET /me/export` (JSON) and `DELETE /me` (soft-delete + PII purge)
and both are covered by tests.

---

## 4. Track 2 — State durability and correctness (P1)

This is the single largest structural gap: five services hold authoritative state in `Map`s.

```
gamification.service.ts:26-29   xp, daily, badges, streaks
quiz.service.ts:14              battles
solo.service.ts:46-47           hats, turns
whisper.service.ts:35           chains
peer-window.service.ts:20       timers
```

Consequences: every restart wipes XP and badges; a second replica disagrees with the first; a
battle started on instance A cannot be answered on B; a whisper chain 404s after deploy.

### 4.1 Gamification → persistent, event-sourced

**Change:** add `LearnerProgress` (xp total, badges[], streak, daily counters keyed by
`YYYY-MM-DD`) and an append-only `XpLedger` (`learnerId, sessionId, circleId, signal, xp, ts`).
Total = sum of ledger for auditability; `LearnerProgress` is the fast read model. Apply the daily
cap inside a transaction (§4.6), because the current read-modify-write on a Map races.

**Acceptance:** restart the process mid-session → XP and badges survive. Fire 50 concurrent
`poll_vote` awards for one learner → daily cap (see `DAILY_CAP`) is never exceeded.

### 4.2 Quiz battles → persistent

**Change:** `QuizBattle` collection with `items[]`, `answers{learnerId: {qid: bool}}`,
`expiresAt` (TTL 24 h), `status`. Keep the seeded/bounded generation logic.

**Acceptance:** battle created on instance A is answerable on B; expired battles are reaped by
TTL.

### 4.3 Whisper chains → persistent

**Change:** store the chain on the existing artifact (`kind: 'drift_map'`) instead of the side
map, which the service already writes at `whisper.service.ts:70-75`. The chain is the input to
that artifact, so it belongs beside it.

### 4.4 Solo hats/turns → persist on the session document

`solo.service.ts:46-47` keeps `hats` and `turns` in maps, but the service *already* creates a
`Session` document at `:60` with `_id: S-solo-<hex>`. There is a durable row to attach to, so the
side maps have no reason to exist.

One correction to the obvious fix: the hat is **learner-chosen** (`hat()` at `:106` sets it
explicitly), not a pure function of turn index, so it cannot be derived — it must be stored. Turn
count *is* derivable from the `solo_turn` events the service already emits at `:72`, but a stored
counter avoids a count query per turn.

**Change:** add `soloHat` and `soloTurn` to the `Session` schema; read and write those instead of
the maps. Cheap, and it is the difference between a solo session surviving a deploy and silently
resetting to `NOVA_NOVICE` / turn 0.

**Acceptance:** start a solo session, restart the API, continue it → same hat and the turn counter
continues rather than restarting.

### 4.5 Peer-window expiry → at-least-once worker

`rescan()` (`peer-window.service.ts:54`) is only called from `onModuleInit` (`:31`). If a process
dies between window close and settle, that question stays `OPEN` until the *next* restart. Worse,
with two replicas both may settle — `settle` is documented idempotent but should be enforced.

**Change:** run `rescan()` on a 5 s interval guarded by a distributed lock (a `workers` collection
with `leaseUntil`, or a Mongo `findOneAndUpdate` on the question itself to claim it), and make
`settle` conditional: `findOneAndUpdate({ _id, state: 'OPEN' }, { state: 'SETTLING' })` so only
one writer proceeds. Emit a metric when `settle` finds a question overdue by > 30 s.

**Acceptance:** kill the process with an open window, restart after expiry → question settles
within 5 s. Two replicas racing the same expiry → exactly one `RESOLVED` transition in telemetry.

### 4.6 Transactions are unused

`unit-of-work.ts:9` implements `withTransaction` and **nothing calls it**. Multi-document writes
that must be atomic: question creation + telemetry; settle + credit grant + artifact write;
capsule build + XP award.

**Change:** wrap those three flows. Requires a replica set in every environment — update
`docker-compose.yml` and the dev instructions (`scripts/dev-mongo.ts`), because standalone Mongo
cannot run transactions. This is a prerequisite, not a detail.

### 4.7 Unbounded collection growth

No TTL on `TelemetryEvent` or `LlmCall`; indexes exist (`telemetry.schema.ts:58-60`) but nothing
prunes. At 200 learners this is fine for a month and a problem in a year.

**Change:** TTL indexes — `TelemetryEvent` 90 d, `LlmCall` 180 d, `CacheEntry` already has one
(`ai.schema.ts:33`). Archive before delete if the report needs history.

**Acceptance:** a seed of 1 M events drops to 0 after the TTL window in a time-frozen test.

---

## 5. Track 3 — Product gaps that make screens wrong (P1)

These are visible defects on screens the demo depends on.

### 5.1 The debrief battle renders three letters

`quiz.service.ts:51-55`:

```
const m = p.text.match(/\((a)\)[^)]*(b)\)[^)]*(c)\)/);
if (m) return ['a', 'b', 'c'];
return ['a', 'b', 'c', 'd'];
```

It matches the option markers and then discards the option text, returning literal `'a'|'b'|'c'`.
`Debrief.tsx` renders each choice as a button, so a learner is asked to pick between "a", "b",
and "c" with no question text distinguishing them. The regex proves the option text is present in
`p.text` and is simply not captured.

**Change:** capture groups — `/\(a\)\s*(.+?)\s*\(b\)\s*(.+?)\s*\(c\)\s*(.+)$/` — and return
`{ key: 'a', text: '...' }[]`. Also carry the correct answer from the probe chunk
(`(p as {answer?: string}).answer` is already read at `:31`) and shuffle deterministically by
`seed` so the answer is not always slot `a` — every seeded probe currently has `answer: "a"`, so
without a shuffle the battle is trivially winnable.

Mind the coupling: `answer()` at `quiz.service.ts:38` compares the submitted value directly to
`item.answer` (`choice === item.answer`), where `answer` is the letter. Returning option text
without changing that comparison silently marks every answer wrong. Submit the **key**, keep the
letter comparison, and change only what the UI displays. `Debrief.tsx:160-165` maps `it.choices`
straight into buttons and uses the string as the React key, so it needs the `{key,text}` shape and
must submit `c.key`.

**Acceptance:** `Debrief` shows readable options; a unit test asserts no choice text is a single
character for all seeded probes, and that a full battle can still be answered correctly end-to-end.

### 5.2 Capsule is hardcoded to English and to one topic

`capsule.service.ts:50`: `const lang = 'en';`. The `visual_desc` is a binary-search string
regardless of `topic`. So the screen that is supposed to close the learning loop ignores the
learner's language selection and describes the wrong concept for every topic but one.

**Change:** thread the session/circle `lang` through; render `visual_desc` from the topic's
checklist; use the L-tier model for prose only when the governor allows, else compose from the
retrieved chunks in the target language (the T0 path already exists). Add a Darija short-oral
variant to satisfy the §8.2 parity gate.

**Acceptance:** build a capsule for a French learner on a non-binary-search topic → prose and
visual description are both French and on-topic. Covered by an integration test per language.

### 5.3 Create-circle advertises the wrong agenda

`CirclesNew.tsx:162` hardcodes `['goal','explain','challenge','teachback','recap']`, while
`api.ts` documents `/contexts/:mode/config` and `Lobby.tsx` reads it correctly. A context that
drops a step (e.g. solo) would still show it at creation time.

**Change:** read `contextConfig(mode).agenda` from `/contexts/:mode/config`, exactly as `Lobby`
does. One source of truth.

**Acceptance:** changing a step list in `context-modes.ts` changes both create and lobby.

### 5.4 The XP promise is unfulfilled end-to-end

XP surfaces exist on `Debrief`, `Me`, `Dashboard`, but nothing server-side awards XP in the
normal flow (`award` is only reachable via the endpoint removed in §3.6), and the capsule's
`xp_earned: 15` is displayed without being credited.

**Change:** after §4.1, wire awards into the settling paths and return the granted XP in the
response body of the action that caused it, so the UI can animate the real number instead of a
constant.

**Acceptance:** complete a full session → `Debrief` XP matches `GET /learners/me/progress` and
the ledger sum.

---

## 6. Track 4 — Frontend production hardening (P1)

### 6.1 A silent localhost fallback ships to production

`api.ts:5`: `const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api/v1'`.
If `VITE_API_BASE` is missing at build time, the production bundle points at the learner's own
machine and every request fails with an opaque network error.

**Change:** throw at module init when `import.meta.env.PROD && !VITE_API_BASE`. Better: make it a
build-time assertion in `vite.config.ts` so the build fails rather than the runtime.

**Acceptance:** `VITE_API_BASE` unset → `npm run build` fails with a clear message.

### 6.2 No error boundary

Grep for `ErrorBoundary` returns nothing. One thrown error in any route blanks the app, and a
failed lazy chunk (deploy during a session) leaves a white screen.

**Change:** add a top-level boundary plus a per-route boundary inside the `Suspense` at
`App.tsx:54`, with a retry that reloads the chunk and a localized fallback. Handle
`ChunkLoadError` explicitly — this is the common production failure during a rolling deploy.

### 6.3 The 404 route renders the landing page

`App.tsx:70`: `<Route path="*" element={<Landing />} />`. A mistyped deep link silently shows the
home page, and analytics cannot distinguish it from a real visit.

**Change:** a real `NotFound` route with a link back; keep `*` → `NotFound`.

### 6.4 Unprotected routes that are also unprotected server-side

`/board`, `/dashboard`, `/lab` render without `RequireAuth` (`App.tsx:65-69`), matching the
public endpoints in §3.4. Fixing the server is necessary but the router should not render an
admin surface to an anonymous visitor. Gate all three and remove `/lab` from production builds.

### 6.5 No request timeout, cancellation, or retry

`req()` at `api.ts:64` calls `fetch` with no `AbortController`, no timeout, and no retry. A hung
request leaves a spinner forever; a route unmount does not cancel the in-flight poller; a
transient 502 surfaces as a hard error.

**Change:** `AbortSignal.timeout(10_000)` (longer for AI routes), accept an external `signal` from
callers so pollers cancel on unmount, retry idempotent GETs twice with jittered backoff on
network error / 502-504 only, and surface `requestId` from the error body (`global-exception.filter.ts:31`
already returns it) in the user-facing error so support can correlate.

### 6.6 Accessibility pass is claimed but not verified

`role="meter"`, `aria-valuenow`, `prefers-reduced-motion` in four stylesheets, and RTL handling
(`session.tsx:95-96`) are all present and correct. What is missing is verification: no automated
a11y check exists, and the §8.2 claim "keyboard-only walkthrough succeeds" is untested.

**Change:** add `@axe-core/playwright`, run it against every route in CI, fail on new violations,
and add the keyboard walkthrough as a Playwright script for the five demo-critical routes.

Also fix the static `<html lang="fr">` in `index.html` — it is corrected at runtime
(`session.tsx:95`) but the first paint and any crawler see French regardless.

### 6.7 No frontend tests at all

`halqa-web/package.json` has no test script and no test runner. The 99 backend unit tests are
excellent; the 14 screens have zero.

**Change:** Vitest for `lib/` (i18n parity, api ETag/skew logic, `motion-variants` reduced-motion
branching) and Playwright for the five critical flows: enter → create → lobby → session →
debrief; join by code; solo; DNA; offline reload. Turn the existing manual `demo/record.cjs`
harness into this rather than starting fresh.

---

## 7. Track 5 — Platform, deployment, observability (P1)

### 7.1 Container is not production-grade

`Dockerfile` runs as root (no `USER`), `docker-compose.yml` hardcodes `NODE_ENV: development`,
and neither defines resource limits. `package.json` has no `engines` field.

**Change:** add `USER node`, `engines: { node: ">=22 <23" }`, pin the base image by digest, add
`--frozen-lockfile` semantics (already `npm ci`), and split compose into `dev` and `prod` files.
Add `read_only: true` + `tmpfs` for the app container in prod.

**Acceptance:** `docker run --user 1000` succeeds; `trivy image` shows no HIGH/CRITICAL, or the
exceptions are documented.

### 7.2 No graceful shutdown

`enableShutdownHooks` is absent from `main.ts`. On every deploy, in-flight requests are dropped
and the Mongo connection is not closed. With the peer-window timers in memory (§4.5) a SIGTERM
mid-window loses the settle.

**Change:** call `app.enableShutdownHooks()`, add `onModuleDestroy` to `PeerWindowService` that
clears timers, and drain: stop accepting, finish in-flight, then exit. Set
`terminationGracePeriodSeconds` above the longest route (AI routes are the long tail).

### 7.3 Mongo needs production settings

`persistence.module.ts:47-51` sets only `uri`, `retryWrites`, `serverSelectionTimeoutMS: 5000`.

**Change:** add `maxPoolSize: 20`, `minPoolSize: 2`, `autoIndex: false` in production (build
indexes explicitly, out-of-band — otherwise every boot rebuilds them and boot time scales with
collection size), `retryReads: true`, and a `connection.on('disconnected')` log. Add a
`migrate` script that ensures indexes from `persistence/schemas/*` before the app serves traffic.

**Acceptance:** boot with `autoIndex: false` against a seeded DB serves correct results; index
list matches the schema definitions.

### 7.4 Health is shallow

`health.controller.ts` returns `ok: true` unconditionally for liveness (correct) and checks only
Mongo `readyState` for readiness. Nothing covers the AI provider, the retrieval index, or the
build version.

**Change:** readiness checks Mongo ping (not just `readyState`), KB load state, and reports
`{ version, commit, startedAt }`. Keep provider health *out* of readiness — a provider outage must
degrade (`GREEN→ORANGE→RED→BLACK`), not remove the pod, or a provider blip takes the product down.

### 7.5 No observability pipeline

There is a solid foundation — `JsonLogger`, `requestIdMiddleware`, `global-exception.filter`
attaching `requestId`. There is no metrics export, no tracing, no error tracking, no alerting.

**Change:**
- `prom-client` + `GET /metrics` behind admin auth: request count/duration by route, peer-window
  settle lag, AI tier counts, L-share, cache hit rate, quota remaining, degradation mode as a gauge.
- Sentry (or equivalent) on both API and web, with `requestId` as the correlation tag.
- Alerts: settle lag > 30 s; 5xx rate > 1% for 5 min; L-share > 0.25 for 15 min; readiness failing
  on 2 consecutive probes; quota < 10% remaining.

**Acceptance:** a forced 500 on a staging route appears in Sentry with a matching `requestId`
from the response body, and fires the alert.

### 7.6 No backup or disaster recovery

No backup job, no restore runbook, no retention policy.

**Change:** `mongodump` on a schedule to object storage with 30-day retention; a documented
restore drill executed once before launch and quarterly after; documented RPO/RTO (target RPO 1 h,
RTO 30 min for a pilot).

---

## 8. Track 6 — Data governance (P2, but must exist before real learners)

1. **Retention schedule** — write it down per collection: `Learner` (until deletion), `Session`
   (2 years), `TelemetryEvent` (90 d), `LlmCall` (180 d), `CacheEntry` (TTL-driven), `XpLedger`
   (2 years).
2. **Export/delete** — §3.10. Soft-delete with a 30-day window, then hard purge including ledger
   and telemetry actor references (tombstone the id so aggregates stay correct).
3. **Consent copy** — a plain-language statement of what is stored (nickname, language, learning
   signals) and what is *not* (no real name, photo, gender, region — enforced by the schema gate).
   Surface it on `/enter`, not buried.
4. **Model-call disclosure** — the README documents C/L routing. Confirm no raw learner text
   leaves without the scrubber, and log a hash of what was sent, not the text (`LlmCall` already
   stores metadata; verify it stores no prompt body).
5. **Secrets** — `lint:secrets` exists; wire it into CI (§2.3) and add a pre-commit hook. Rotate
   `PROVIDER_API_KEY` and `TOKEN_SECRET` before launch, since both have been in a local `.env`.

---

## 9. Track 7 — Performance and capacity (P2)

1. **Load test the poller.** The design polls at 1.5 s/4 s/5 s with ETag/304. Verify under 200
   concurrent learners that 304s dominate and Mongo is not the bottleneck. Target: p95 < 50 ms on
   `GET /questions/:qid/state`, > 90% 304 hit rate.
2. **Payload budget.** The `<1 KB` rule is already enforced for the two poller paths —
   `cfas-slice.spec.ts:162` and `:256` assert `JSON.stringify(body).length < 1024`, and the
   truncation lives at `question.service.ts:287`. Extend the same assertion to the remaining
   polled routes (debate/health/circle) rather than inventing a new gate, and run them against a
   worst-case seeded session rather than a minimal one.
3. **AI cost ceiling.** `QUOTA_C=20`, `QUOTA_L=5` per window. Add a per-circle daily spend cap and
   a hard stop that flips to the offline pack rather than erroring, matching the BLACK contract.
4. **Cache effectiveness.** Measure `cacheHitRate` from `/metrics` over the eval set; if below the
   threshold defended in the report, fix the key (`cache-key.ts` hashes intent+level+lang+chunks+
   ladder) before adding capacity.

---

## 10. Track 8 — Release engineering (P2)

1. **Environments:** `local` → `staging` → `production`, same image, config by env var only.
2. **Migrations:** adopt a versioned migration runner (or an ordered `migrate/*.ts` with a
   `schemaVersion` doc). Rollback story: every migration is additive for one release; a destructive
   step lands only after the previous version is fully retired.
3. **Deploy:** rolling, `maxUnavailable: 0`, readiness-gated, with a smoke check post-deploy
   (`scripts/smoke-live.ts` already exists — run it against the new revision).
4. **Feature flags:** `chaos`, `lab`, and any half-finished surface behind flags defaulting off in
   production.
5. **Runbook:** one page — how to roll back, how to rotate `TOKEN_SECRET` (§3.9), how to force
   degradation, how to restore Mongo, who to page.

---

## 11. Sequencing

Order matters because several later fixes are unsafe before earlier ones.

| Phase | Contains | Exit gate |
|---|---|---|
| **0. Unblock** | §2.1 commit, §2.3 CI, §6.1 build assertion, §6.2 boundary | Clean clone builds; CI green on `main` |
| **1. Close the door** | §3.1–3.7, §3.4 route gating, §6.4 | Authorization test suite green; every leak endpoint 403s |
| **2. Make it survive** | §4.1–4.6, §4.6 replica set, §7.2 shutdown | Restart and two-replica tests green |
| **3. Make it correct** | §5.1–5.4 | Debrief battle readable; capsule localized; agenda from config; XP persists |
| **4. Make it operable** | §3.8, §3.9, §7.1–7.6 | Alerts firing in staging; restore drill done; rotation rehearsal passed |
| **5. Make it ownable** | §6.5–6.7, §8, §9 | Export/delete live; axe clean; load test meets SLO |
| **6. Launch** | §10 | Staging soak 72 h with zero P0/P1 incidents |

Phases 3 and 4 can run in parallel with 2 if staffed; 0 and 1 cannot be deferred.

---

## 12. Definition of production-ready

- [ ] Clean clone builds and tests on CI; `main` protected.
- [ ] No endpoint returns another learner's data; verified by an explicit authz test matrix
      (learner × mentor × admin × anonymous × cross-circle).
- [ ] Ids are opaque; `joinCode` never appears in a public response.
- [ ] Zero authoritative state in a `Map`; restart loses nothing a learner cares about.
- [ ] Expiry settles within 5 s of window close, exactly once, on any replica.
- [ ] Every AI-spending route is rate-limited at the edge and in-app.
- [ ] XP granted by the server, persisted, capped, and auditable via ledger.
- [ ] Debrief battle shows real options; capsule matches the learner's language and topic.
- [ ] Production build fails on a missing `VITE_API_BASE`; no localhost fallback can ship.
- [ ] Error boundary + chunk-load recovery; real 404; `/lab` absent from production.
- [ ] CSP enforced, not report-only; token rotation rehearsed without an outage.
- [ ] `/metrics` and `/dashboard` admin-only; Prometheus scrape + 5 alerts live.
- [ ] Graceful shutdown drains in-flight requests; deploy causes no dropped window.
- [ ] Mongo backed up, restore drill executed, `autoIndex: false` with explicit index migration.
- [ ] Export + delete endpoints live; retention documented and enforced by TTL.
- [ ] axe clean on all routes; keyboard walkthrough scripted in CI.
- [ ] Load test meets the §1 SLO at 200 concurrent learners.
- [ ] Runbook written and rehearsed by someone other than its author.

---

## 13. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Transaction wrapper needs a replica set; dev runs standalone | §4.6 blocked late | Switch compose + `dev-mongo.ts` to a single-node replica set **in phase 2 start**, not at the end |
| Query-param auth removal breaks the shared poller's ETag | Debrief/session flapping | Split asker-only fields into a separate route (§3.2) before changing the shared body |
| Sequential-id change touches seeds, tests, and shared links | Wide blast radius | Introduce opaque ids with a dual-read window; keep `C-1` resolvable for one release |
| In-memory → Mongo rewrite of gamification changes demo XP numbers | Demo regression | Seed the ledger to reproduce current numbers; snapshot the demo flow before/after |
| Provider outage mistaken for app failure | Pod churn during an AI outage | Provider health excluded from readiness (§7.4) |
| i18n regression while touching capsule/screens | Breaks the 4-language claim | The 341-key parity check already passes — add it to CI so it cannot silently break |

---

## 14. What is already production-grade (do not rebuild)

Worth stating so effort is not spent twice: the default-deny guard, the PBKDF-style scrypt
credential handling with `timingSafeEqual`, the schema-gate that forbids PII columns, the
degradation state machine with a UI banner and telemetry, the quota governor + semantic cache,
the ETag/304 polling discipline, the 4-language parity (341 keys, zero missing), the
reduced-motion and RTL handling, and the 99 backend unit tests. These are the parts that usually
take the longest to get right, and they are done.
