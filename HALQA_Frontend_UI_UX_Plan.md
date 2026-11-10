# HALQA v2 — Frontend UI/UX Architecture & Page Plan

**Folder:** `challenge wie act /` · **Status:** Phase F0 built + browser-verified (F1 core loop next)
**Frontend:** `halqa-web/` (Vite + React 19 + TS strict + Router + PWA, `VITE_API_BASE` → api :3100)
**F0+F1 verified 26 Oct:** shell + 14 routes render live; full user journey proven
E2E (enter→DNA→create→by-code→join→lobby→session→ask→peer→skip→hint→capsule→quiz→whisper→mentor→solo→metrics→chaos); backend `by-code` route added; QR on create + solo invite
**Backend:** `halqa-api` (`/api/v1`, 23 modules, 35+ routes — all live-smoke verified 41/41)
**Sources:** `EdNova_Winning_Proposal.md` (product) · `HALQA_Backend_Blueprint_and_Data_Plan.md` (features) · `HALQA_NestJS_MongoDB_Implementation_Plan.md` (API §9) · `HALQA_v2_Explained_Derja.md` (v2 narrative)
**Deadline:** Phase 1 · 10 November · **Team:** P2 Frontend/UX owns this doc

> One-line design thesis: **the UI is the rubric made visible.** Every scored
> criterion has a screen region: routing → `/lab` metrics, equity → S-B-U rings,
> hints → ladder stepper, degradation → banners, multilingual → mid-session
> switch, ethics → anonymous IDs everywhere. If a judge can't *see* it in 90
> seconds, it doesn't score.

---

## 0. How to use this document

- **§1** = product truth (personas, loop, design principles — never re-decide these)
- **§2** = design system (tokens, type, color, RTL, a11y — the visual contract)
- **§3** = app shell + navigation (the frame every page lives in)
- **§4** = route map: every frontend route → backend endpoints → data shapes
- **§5** = screen-by-screen blueprints (layout, components, states, polling)
- **§6** = cross-cutting UX systems (latency, degradation, i18n, gamification, PWA)
- **§7** = endpoint→screen traceability matrix (nothing unrendered, nothing unfetched)
- **§8** = build order + file structure + definition of done

---

## 1. Product truth (locked — do not redesign)

### 1.1 Personas (5, all anonymous `L-##` + nickname + neutral avatar)

| Persona | Enters via | Core need | Signature moment |
|---|---|---|---|
| **Learner** ( Ferd / Yasmine ) | nickname, no signup | ask without fear, hints not answers | anonymous question + `Me too` → invited privately |
| **Host** | creates circle | run a 25-min session that ends well | agenda ticks, S-B-U rings brighten |
| **Peer / Explainer** | join code | help and be seen helping | Style Coach whisper + credits for bridging |
| **Mentor / Teacher** | observer seat | spend 3 min where it matters | `needs_human` flag → 60-word Brief → gentle Note |
| **Judge** (demo viewer) | `/lab` + video | tick rubric boxes in 90 s | route table + metrics + fallback firing |

### 1.2 The session loop (every screen serves it)

```
① DIAGNOSE (3 min) → ② DISCUSS (8 min) → ③ DO (9 min) → ④ DEBRIEF (5 min)
   DNA → passport     peer window 45–60 s   hint ladder L1–L4   capsule + quiz
```

### 1.3 Nova's 4 hats (always labelled on screen — judges tick boxes)

🟣 **Mediator** · 🟢 **Teammate** · 🔵 **Tutor** · 🟡 **Facilitator**.
Every Nova message carries a hat chip. Never an anonymous "AI:" bubble.

### 1.4 Non-negotiable UX principles

1. **Circle First, AI Second is visible.** The peer window countdown is the
   hero of the session room, not the AI input box.
2. **No silent states.** Every backend state (OPEN/NOVA_THINKING/RESOLVED,
   green/orange/red/black, quota-out, cached) has distinct UI + copy.
3. **Quality over volume.** Credits, not message counts. No public leaderboard — ever.
4. **Private correction, public celebration.** Nudges/dominance alerts are
   private; XP/badges/capsules are shared.
5. **No shame styling.** S-B-U low tier = gentle pulse, never red. Wrong
   answers get Socratic questions, never ✗ marks.
6. **Offline is a first-class mode**, not an error page. Polls, roles,
   flashcards and the 30-snippet pack keep working with zero connectivity.
7. **Synthetic-only.** No photo/name/voice upload exists in the UI. Avatar =
   neutral icon key (`fox|owl|star|deer…`). This is a gate — enforce in UI,
   not just API.

---

## 2. Design system

### 2.1 Stack (locked)

- **Vite + React 18 + TypeScript (strict) + React Router** — SPA, no SSR
  (venue Wi-Fi is hostile; the demo runs from a laptop hotspot).
- **Tailwind** for layout + a small token layer below. No heavy component kit
  (bundle must stay installable offline).
- **PWA:** `vite-plugin-pwa`, shell precached, runtime cache for
  `GET /state` + KB reads. Install prompt on `/enter`.
- **Data:** `fetch` + tiny typed client (`lib/api.ts`) + per-screen hooks.
  **No React Query** — polling semantics (ETag/304, asker-only) are bespoke
  and must stay explicit. No WebSocket — polling `GET /questions/:qid/state`
  every 1.5 s per the backend contract.
- **i18n:** local dictionary `lib/i18n/{ar,darija,fr,en}.ts` for chrome copy;
  learner content stays server-rendered. `dir="rtl"` on `<html>` for `ar`/`darija`.
- **Fonts:** system stack + bundled **Noto Naskh/Noto Sans Arabic** subset for
  AR/Darija (offline-safe). Dyslexia toggle swaps to a wide-spaced sans.

### 2.2 Tokens

```css
--ink:      #17242E  /* text */
--muted:    #526472  /* secondary */
--navy:     #123047  /* headers, brand */
--aqua:     #1EA7A1  /* Nova / primary actions */
--gold:     #D68A24  /* stars, XP, Deep-Dive ✨ */
--green:    #3D8B57  /* verified / trusted */
--amber:    #D68A24  /* simplified / fallback notice */
--plum:     #6546A6  /* mentor / facilitator */
--paper:    #F4F7F7  /* background */
--card:     #FFFFFF
--line:     #C9D8DB
```

S-B-U tiers: `bright` = solid fill · `steady` = outline · `pulse` = gentle
opacity animation (respects `prefers-reduced-motion` → static outline + label).
Tiers are **always labelled with text** (S/B/U + word), never color-only.

Dark mode: **out of scope** (projector + video legibility win over theming).

### 2.3 Type scale

Display 28 / H1 22 / H2 17 / body 15 / small 13 / micro 12. Darija/AR body
+1px. Line-height 1.55 for learner content (oral-register readability).

### 2.4 Shared components (`components/`)

`HatChip` · `SbuRings` · `CreditBar` · `QuotaMeter` · `DegradationBanner` ·
`CountdownRing` · `Poller` (generic ETag hook, not visual) · `QuestionCard` ·
`HintStepper` · `PollCard` · `CapsuleCard` · `DriftMap` · `XpToast` ·
`BadgeRow` · `LangSwitcher` · `ErrorNote` (renders `user_msg[lang]`) ·
`CiteChips` · `EmptyState` · `Skeleton` (per-screen shimmer shapes, never a
generic spinner for AI waits — staged step names instead).

---

## 3. App shell + navigation

```
┌────────────────────────────────────────────────────────┐
│ ★ HALQA  [C-xxxxxx]  [S● B● U●]  [quota ▓▓▓░] [🌐 FR▾] │ header (all pages)
│ [degradation banner — only when ≠ green]                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  <route outlet>                                        │
│                                                        │
├────────────────────────────────────────────────────────┤
│ ◀ Circle  👤 Passport  📊 Board*  🧪 Lab*              │ bottom nav (mobile)
└────────────────────────────────────────────────────────┘
* Board/Lab visible only in workshop context or ?lab=1 (judge mode).
```

- **Header left:** Nova star + HALQA wordmark → `/`.
- **Header center:** circle join code (tap → copy + QR) when inside a circle.
- **Header right:** S-B-U mini-rings (live, from latest session) · quota meter
  (`cUsed/cCap`, `lUsed/lCap`, turns amber <20% left) · language switcher ·
  passport avatar chip (→ passport sheet).
- **Degradation banner** (global, below header): copy per mode × session lang —
  ORANGE `Nova is queuing deeper answers — peers keep going` · RED `Quota out —
  simplified answers only` · BLACK `Offline — circle tools still work`.
- **Bottom nav (mobile) / side nav (desktop ≥1024px):** Circle · Passport ·
  Dashboard (mentor/teacher) · Lab (metrics + chaos, gated).
- **Passport sheet** (slide-over, everywhere): level · style weights bars ·
  lang · hint eagerness · `invite_me` · explain-card text · XP + badges.

---

## 4. Route map

Base API: `/api/v1`. Token: `Authorization: Bearer <HMAC>` (sessionStorage,
never localStorage — survives reload, dies with tab).

| # | Route | Purpose | Backend endpoints (method + path) | Key data rendered |
|---|---|---|---|---|
| R0 | `/` landing | product + 2 CTAs | none (static) + `GET /kb/stats` (social proof: 39 chunks) | hero, 4-hat strip, loop diagram, CTA solo/circle |
| R1 | `/enter` | nickname + avatar + context | `POST /auth/session` → token+learner | avatar grid (neutral only), context cards (6) |
| R2 | `/dna` | 4 micro-items → passport | `GET /dna/items`, `POST /dna` | L1/S1/G1/C1 steppers, passport preview card |
| R3 | `/solo` | Teach Nova loop | `POST /solo/sessions`, `POST /solo/sessions/:sid/turn`, `POST .../hat`, `POST .../invite` | hat switcher, probe thread, progress 0–1, invite QR |
| R4 | `/circles/new` | create circle | `POST /circles`, `GET /contexts/:mode/config` | topic picker, context cards, window slider 30–90, joinCode+QR result |
| R5 | `/circles/join` | join by code | `GET /circles/by-code/:code` → `POST /circles/:id/join` | code input, topic preview, nickname |
| R6 | `/c/:circleId` lobby | members + start | `GET /circles/:id`, `POST /circles/:circleId/sessions`, `GET /passports/:id/explain-card` | member list, explain-cards, agenda template, Start button |
| R7 | `/c/:circleId/s/:sessionId` **session room** | the core screen | questions CRUD, `/state` poller, hints, polls, health, credits, metrics (quota), chaos (lab) | §5.7 — the biggest blueprint below |
| R8 | `/c/:circleId/s/:sessionId/debrief` | close the loop | `POST /sessions/:id/capsule` (+GET), `POST /quiz/battle` + answer, `POST /whisper` + repair, `POST /sessions/:id/end`, XP endpoints | capsule card, boss battle, whisper game, XP/badges, end summary |
| R9 | `/board` | workshop grid | `POST /circles/match`, `GET /board`, `GET /circles/:id/health` | matcher form, circle grid with S-B-U + `needs_human` flags |
| R10 | `/mentor` | mentor seat | `POST /circles/:id/mentor/join`, `POST /mentor/notes`, `GET /mentor/brief` | observer banner, note composer, brief card (≤60w) |
| R11 | `/dashboard` | teacher view | `GET /dashboard`, `GET /sessions/:id/credits` | stuck sessions, talk-share bars, style mix, trends |
| R12 | `/lab` | engineering proof (judges) | `GET /metrics`, `GET /degradation`, `POST /chaos`, telemetry events | route table, live meters, chaos buttons, event log |
| R13 | `/me` | identity | `GET /me` | learner + passport (also a sheet everywhere) |

Join-code QR encodes the circle id (camera → `/circles/join?code=`).

---

## 5. Screen blueprints

### 5.1 R0 `/` — Landing

- Hero: `الحلقة تعلّم — No voice left behind.` + subline + 2 CTAs
  (`▶ Solo — علّم Nova` → `/enter?context=solo`, `👥 Circle` → `/enter`).
- 4-hat strip (Mediator/Teammate/Tutor/Facilitator one-liners — rubric vocabulary).
- Loop diagram ①→②→③→④ with minute badges.
- Trust strip: `39 synthetic KB chunks · 4 languages · offline-ready · no signup`.
- Footer: ethics line (anonymous, synthetic, teacher-support) + IEEE SB/WIE note.

### 5.2 R1 `/enter` — Join (no signup, <60 s)

- Nickname input (≤24, live counter) · avatar picker grid (8 neutral icons,
  random default) · 6 context cards (class/study/community/workshop/program/solo
  with one-line descriptions from `GET /contexts/:mode/config`).
- Submit → `POST /auth/session` → store token → route by context
  (`solo` → `/dna?next=/solo`, else `/dna?next=/circles/join`).
- Errors render `user_msg[uiLang]` via `ErrorNote`. No password field exists anywhere.

### 5.3 R2 `/dna` — Diagnose (≤3 min, 4 taps)

- 4 stepper cards: **L1** level (3 tiers, topic-aware e.g. binary_search) ·
  **S1** style A/B (picture-desc vs analogy vs steps) · **G1** language
  (AR/Darija/FR/EN + autodetect note) · **C1** confidence (sure/unsure/lost).
- Live passport preview card on the side (fills as you tap — the "wow, it sees me" moment).
- Submit → `POST /dna` → full passport → confetti-free quiet confirmation
  (`Passport ready ✓`) → `next`.
- The passport card format is fixed everywhere:
  `Level: beginner · Style: visual-first · Lang: Darija · Hints: eager · Invite me ✓`.

### 5.4 R3 `/solo` — Teach Nova

- Header: hat switcher (Novice/Skeptic/Curious/Examiner chips) + progress bar (n/8).
- Thread: Nova probe bubbles (hat-labelled) ↔ learner answer composer.
  Each turn → `POST .../turn` → `novaTurn` + `progress`.
- Quota note when C cap nears (`Solo budget: 5/8 compact calls` — from
  `/metrics quotaUsage`, honesty as a feature).
- End state: capsule teaser + **invite card** (`halqa://join?code=` + QR +
  `اعزم صاحبك وردّها حلقة`).
- L is never spent here — if the UI ever shows a Deep-Dive in solo, that's a bug.

### 5.5 R4/R5 — Create / Join circles

- Create: topic picker (binary_search, fractions + `GET /kb/stats` counts) ·
  context cards · language · window slider 30–90 s (default 45) ·
  host nickname → result screen: **big join code + QR + copy + Start lobby**.
- Join: code input (auto-uppercase, forgiving spaces) → nickname →
  member-preview → enter lobby.

### 5.6 R6 `/c/:circleId` — Lobby

- Member roster (avatar + nickname + passport style dot) · agenda template
  timeline (from context config) · explain-cards strip (opt-in visible only) ·
  **Start session** (host) → `POST .../sessions` → `/s/:sessionId`.
- Late joiners land here and get a `Catch me up` recap (last capsule if any).

### 5.7 R7 — Session room (the core screen, ~60% of frontend effort)

Desktop 3-column (≥1024px) / stacked mobile. Columns:

```
┌──────────┬────────────────────────────┬──────────────┐
│ AGENDA + │  QUESTION FEED (center)    │ HEALTH +     │
│ MEMBERS  │  composer → open card →    │ PEOPLE       │
│ (left)   │  resolved → hints/polls    │ (right)      │
└──────────┴────────────────────────────┴──────────────┘
```

**Left — Agenda & members:**
- Agenda checklist (goal/explain/challenge/teachback/recap, done ticks) from
  session `agenda` (`GET /sessions/:id`).
- Member list with credit dots (from `/sessions/:id/credits`, polled 5 s).
  Quiet members get a private `Invite` affordance for the host (never public).

**Center — Question feed (the CF-AS state machine, rendered literally):**

1. **Composer** (top, sticky): textarea + lang auto-note (`detectRegister` hint:
   `Arabizi → Darija ✓`) + `Anonymous` toggle + `Ask` button → `POST /questions`
   → card appears `OPEN` with `CountdownRing` (derived from `windowEndsAt`,
   client clock, 45–60 s) + `I can help` / `Me too` buttons for peers.
2. **OPEN card:** countdown hero · peer answers streaming in · asker-only
   `Skip the wait` (≤2 clicks) · peers see countdown only (no staged detail).
   Poll `GET .../state?asker=<me>` every **1.5 s with ETag/If-None-Match**
   (304 = no render — venue-Wi-Fi discipline).
3. **NOVA_THINKING card (asker-only detail):** staged steps
   (`retrieving → checking_similar → writing → verifying` — real pipeline
   names) as a vertical stepper; peers see `Nova is thinking…`.
4. **RESOLVED card** by `resolution`:
   - `peers_verified` → peer answer text + `✓ verified by Nova` + cites chips + `peerFirst` badge.
   - `hint_path` → auto-L1 hint + `HintStepper` L1–L4 (locks enforced: L4 needs
     `hintState≥3` or skip; locked levels show 🔒 with reason).
   - `skip_direct` → Quick Take answer + tier chip (`C` / `T0-offline`) + `cached` tag when served from cache.
   - `poll` → embedded `PollCard` (choices, live tally, vote once, close → winner).
   - Every grounded answer shows `CiteChips` (`bs-fr-01`…) — tap → KB drawer
     (`GET /kb/chunks?topic&lang` excerpt). Empty cites = render a warning
     (contract violation, file it).
5. **Answer truncation:** poller preview ≤600 chars + `Read full` expands
   (keeps payload <1 KB — the contract, not just perf).

**Right — Health & people:**
- `SbuRings` (S/B/U + tier words + `needs_human` flag → mentor nudge CTA).
- `CreditBar` ranked desc (quality totals, log-capped — show the formula on
  hover for judges: `2·ln(1+n)`).
- `QuotaMeter` (C/L used vs cap, session-scoped; amber <20%).
- `CoachPanel` (explainer view): target's explain-card + `Nudge` (private) +
  `Rephrase` (1×C) buttons.

**Banner + meter behavior (degradation, global):**
ORANGE → queue notice + ETA · RED → `simplified answer` tags on all AI output ·
BLACK → offline banner + snippet answers labelled `offline` + polls keep working.

### 5.8 R8 — Debrief

- `CapsuleCard`: 3 bullets + visual_desc + mini-quiz (3 tappable qids → KB) +
  next step + `tier` chip (C/L) + `✨ deeper answer ready` slide-in when
  Deep-Dive lands late.
- `BossBattleCard`: 3 items, team answers, correct → +20 XP toast.
- `WhisperCard`: chain steps → `DriftMap` (kept/lost/distorted/added color+label
  chips) → repair composer → coverage %.
- `XpPanel`: total + `BadgeRow` (First Light, Bridge Builder, Kind Skeptic,
  Chain Healer, Polyglot) + streak.
- `EndSession` → summary (S-B-U final, peer-first rate, credits) → lobby.

### 5.9 R9 `/board` — Workshop board

- Matcher card: pasted nickname list → `POST /circles/match` → groups with
  rationale lines (`levels: novice/beginner langs: fr/darija mixed complementary`).
- Grid of circles: each with S-B-U mini + `needs_human` pulse border →
  tap → mentor brief preview. The "Circle 3 needs a human now" shot lives here.

### 5.10 R10 `/mentor` — Mentor seat

- Observer banner (`You are invisible — no credits, no turns`).
- Brief card: ≤60 words, `Refresh` (1×C) · Notes composer (≤500) → gentle
  card style (plum, never red).
- Aggregate-only reminder footnote.

### 5.11 R11 `/dashboard` — Teacher dashboard

- Stuck-concepts list (low-U sessions first — the user-test-requested order).
- Talk-share bars per session (credits, anonymized `L-##`).
- Style-mix donut. Trends (S-B-U over sessions). All cards labelled
  `aggregates only`.

### 5.12 R12 `/lab` — Engineering proof (judge mode, `?lab=1` or workshop)

- **Route table card** (the report's Table §5, rendered from `config/router.yaml`
  content frozen at build + live `LlmStep` list).
- **Live meters** from `GET /metrics`: callsByTier C/L, **lShare with <25% target
  bar**, p50/p95 per tier, cacheHitRate, peerFirstRate, fallbackCounts,
  quotaUsage per session, degradation mode, KB docs, offline snippets.
- **Chaos console:** GREEN/ORANGE/RED/BLACK buttons (`POST /chaos`, dev-gated)
  + `replay` walk — the filmed fallback shot is rehearsed here.
- **Event log** (`GET /telemetry/sessions/:id/events`): timestamped
  reading → verdict → decision → action chain for the report screenshot.

### 5.13 Error/empty/offline states (every screen)

- `ErrorNote`: `user_msg[sessionLang]`, retryable → Retry button, else guidance.
- Empty: agenda-empty, no-questions-yet (with `Ask the first question` CTA),
  no-capsule-yet, board-no-circles.
- Offline (BLACK): full-app banner + per-card `offline` tags; composer disabled
  with explanation except polls/whisper-repair/quiz which stay live.

---

## 6. Cross-cutting UX systems

### 6.1 Latency protocol (no streaming from models — design around it)

1. **Skeleton-first:** question card skeleton (<200 ms, T0) → Quick Take fills →
   Deep-Dive slides in later with `✨ deeper answer ready` (never retract text).
2. **Staged honest progress:** real stage names only; asker-only granularity.
3. **Peer window hides the wait:** the 45–60 s countdown IS the loading state.
4. **Countdown math:** `remaining = windowEndsAt − clientNow`, tick 1 s, no
   server `now` (keeps ETags stable per contract).
5. **Prefetch:** DNA/bandit/passport at session start while the learner reads.
6. **Budgets displayed:** skeleton <1.5 s · compact <4 s · larger <12 s
   (declared in UI footer of `/lab` — maturity is scored).

### 6.2 Polling table

| Poller | Endpoint | Interval | Notes |
|---|---|---|---|
| Question state | `GET /questions/:qid/state?asker=` | 1.5 s | ETag/304, <1 KB, asker-only detail |
| Session credits | `GET /sessions/:id/credits` | 5 s | bars animate on change |
| Circle health | `GET /circles/:id/health` | 5 s | rings recompute |
| Metrics (lab) | `GET /metrics` | 3 s | meters + quota bars |
| Events (lab) | `GET /telemetry/.../events` | 5 s | append-only render |
| Board | `GET /board` | 5 s | grid refresh |

All pollers pause when `document.hidden` (venue battery discipline) and show
`stale` age if a tick fails twice (never silent).

### 6.3 Multilingual UX

- **Switcher in header**, mid-session allowed; learner content keeps its own
  `lang` (mirror-don't-normalize: Arabizi input → Darija handling, shown as a
  small `Arabizi→Darija ✓` note, never a correction).
- **Darija rendering:** short bubbles (≤60 words enforced server-side; UI adds
  no extra chrome), FR technical terms untouched.
- **RTL:** `dir=rtl` flips shell, thread stays logical (timestamps stay LTR).
- **Parity proof:** `/lab` shows the 24-row parity set status (human 1–5 +
  automated guard) — the B2 bonus, inspectable.

### 6.4 Gamification display rules

XP toasts (+20 sharp question…), badge row, streak flame (cap 5).
**No leaderboard component may be built** — the plan forbids the endpoint;
  the UI must not reconstruct rankings publicly. Circle shows S-B-U, not ranks.

### 6.5 PWA + venue survival

- Precached shell + fonts + offline pack view; runtime-cache GETs.
- `?demo=1` seeds nicknames (quiet+dominant+teacher+mentor) for rehearsal.
- Second-laptop hotspot instructions in README; nothing installed on stage;
  2-minute recovery = reload → `seed:demo` state → offline pack.

### 6.6 Copy deck (banner + key strings, 4 langs — chrome minimum)

| Key | EN | FR | AR | Darija |
|---|---|---|---|---|
| peers_first | Peers answer first — Nova prepares quietly | Les pairs d'abord — Nova prépare en silence | الزملاء أولاً — Nova تحضّر بصمت | الزملاء هوما لولين — Nova تحضّر في صمت |
| skip | Skip the wait | Passer l'attente | تخطَّ الانتظار | فوّت الاستنا |
| simplified | Simplified answer (quota) | Réponse simplifiée (quota) | إجابة مبسطة (الحصة) | إجابة مختصرة (الكوطا) |
| offline_mode | Offline — circle tools still work | Hors ligne — les outils du cercle marchent | دون اتصال — أدوات الحلقة تعمل | بلا connexion — أدوات الحلقة تخدم |
| ai_sleeps | Even when the AI sleeps, the circle keeps learning | Même quand l'IA dort, le cercle continue d'apprendre | حتى عندما تنام الـAI، تواصل الحلقة التعلم | حتى كي الـAI ترقد، الحلقة تكمّل تتعلّم |
| l4_locked | Answer unlocks after hints 1–3 | La réponse vient après les indices 1–3 | الإجابة بعد التلميحات 1–3 | الإجابة تجي بعد الـhints 1–3 |

Backend `user_msg.{ar,darija,fr,en}` covers error copy — the client only selects the key.

---

## 7. Endpoint→screen traceability (every route rendered, every fetch owned)

| Backend endpoint | Screens | Notes |
|---|---|---|
| `POST /auth/session`, `GET /me` | R1, R13, shell | token sessionStorage |
| `GET /dna/items`, `POST /dna` | R2 | 4 steppers |
| `GET /passports/:id/explain-card` | R6, coach panel, sheet | T0 <100 ms |
| `POST /coach/nudge/:targetId`, `POST /coach/rephrase` | coach panel | private + 1×C |
| `POST /circles`, `POST /circles/:id/join`, `GET /circles/:id` | R4, R5, R6 | code+QR |
| `GET /contexts/:mode/config` | R1, R4, R6 | agenda templates |
| `POST /circles/:circleId/sessions`, `GET /sessions/:id`, `POST /sessions/:id/end`, `GET /sessions/:id/credits` | R6, R7, R8 | agenda, credits 5 s |
| `GET /circles/:id/health` | R7 right, R9 | S-B-U 5 s |
| `POST /questions`, `GET /questions/:qid/state` | R7 center | 1.5 s ETag |
| `POST /questions/:qid/peer-answer`, `/answer`, `/me-too`, `/skip`, `/hint` | R7 center | ladder locks |
| `POST /polls`, `/polls/:pid/vote`, `/close`, `GET /polls/:pid` | R7, R8 | idempotent votes |
| `POST /sessions/:id/capsule` + GET | R8 | tier chip |
| `POST /quiz/battle`, `POST /quiz/battle/:bid/answer` | R8 | offline-capable |
| `POST /whisper`, `POST /whisper/:cid/repair` | R8 | drift map ≤1 C |
| `POST /solo/sessions`, `/turn`, `/hat`, `/invite` | R3 | 0 L invariant |
| `POST /circles/match`, `GET /board` | R9 | deterministic |
| `POST /circles/:id/mentor/join`, `POST /mentor/notes`, `GET /mentor/brief` | R10 | observer |
| `GET /dashboard` | R11 | aggregates |
| `GET /learners/:id/xp`, `/badges`, `POST /learners/:id/xp` | sheet, R8 | caps |
| `GET /kb/chunks`, `GET /kb/stats` | R0, R4, cite drawer | 39 docs |
| `GET /metrics`, `GET /degradation`, `POST /chaos` | shell, R7, R12 | quota + chaos |
| `GET /telemetry/sessions/:id/events` | R12 | audit chain |
| `GET /healthz`, `/readyz` | boot gate | fail → setup hint |

---

## 8. Build order + structure + done

### 8.1 Phases (P2 stream, FE starts at the poller contract)

| Phase | Screens | Exit |
|---|---|---|
| F0 shell | tokens, i18n+RTL, shell, ErrorNote, api client, PWA scaffold | `/healthz` gate + `/enter` mock |
| F1 core loop | R1→R2→R4→R5→R6→R7 (composer, OPEN, skip, state poller) | ask→skip→answer E2E on live backend ✅ 26 Oct (41/41 smoke + browser walkthrough, incl. real-AI skip answer + poller ETag/304/404B) |
| F2 trust UI | hints ladder + locks, polls, cites drawer, credits, S-B-U | ladder truth-table passes on screen ✅ 26 Oct (409→settle→403→L2/L3→L4 proven; poll idempotent; cites on every answer) |
| F3 close | R8 (capsule, battle, whisper, XP, end) + R3 solo | debrief + solo ≤8 C visible |
| F4 pro | R9 board, R10 mentor, R11 dashboard, R12 lab + chaos | fallback shot rehearsable |
| F5 harden | offline mode, dyslexia, low-bandwidth, `?demo=1`, screenshots | video storyboard × report figures |

### 8.2 Proposed structure (`halqa-web/`)

```
halqa-web/
  index.html  vite.config.ts (pwa)  tailwind.config.ts
  src/
    main.tsx  router.tsx  shell/ (Header, Nav, Banner, PassportSheet)
    lib/ (api.ts — all 35+ typed calls, i18n/, usePoller.ts, quota.ts)
    domain/ (sbu.ts, credits.ts — mirror backend pure fns for optimistic UI)
    components/ (HatChip, SbuRings, QuotaMeter, QuestionCard, HintStepper,
      PollCard, CapsuleCard, DriftMap, XpToast, …)
    routes/ (landing, enter, dna, solo, circlesNew, circlesJoin, lobby,
      session, debrief, board, mentor, dashboard, lab, me)
    styles/ (tokens.css, rtl.css, dyslexia.css)
  public/ (manifest, icons, fonts subset)
  e2e/ (playwright: enter→dna→ask→skip→capsule; ladder locks; offline)
```

### 8.3 Definition of done (frontend)

**Phase F0 — DONE 26 Oct (verified):**
- [x] Tokens, i18n+RTL shell (`tokens.css`, `session.tsx`, `Shell.tsx`), typed client (35+ calls `lib/api.ts`), PWA scaffold (precache + runtime cache, `vite build` green with sw.js)
- [x] All 14 routes mount in a live browser: `/`, `/enter`, `/dna`, `/solo`, `/circles/new`, `/circles/join` (real `by-code` lookup), `/c/:id`, `/c/:id/s/:sid`, `/debrief`, `/board`, `/mentor`, `/dashboard`, `/lab`, `/me`
- [x] Backend contract additions: `GET /circles/by-code/:code` (service + controller, smoke-covered)
- [x] Room renders 3 rails + live S-B-U + quota meter against live backend (`tsc -b` clean, `vite build` green, CORS wired, boot gate fixed)
- [x] Guidelines audit: no `transition:all`, no div-onclick, no missing alt/autofocus/ellipsis; single `:focus-visible` reset carries a ring replacement (compliant)
- [x] Skills applied: ui-ux-pro-max (design-system query + a11y/stack searches), emil-design-eng (easing/duration/press/scale rules), web-design-guidelines (audit rules), design-taste-frontend (app-screen run)

- [ ] Every §7 row has a screen; every screen maps to §4 endpoints.
- [ ] Pollers honor 1.5 s + ETag/304; payloads <1 KB asserted in e2e.
- [ ] Ladder truth-table clickable: 409 in-window → settle → 403 L4 → L2/L3 → L4.
- [ ] Chaos walk GREEN→ORANGE→RED→BLACK filmable from `/lab` + visible in room.
- [ ] Darija short-oral + RTL + Arabizi note; parity set linked in `/lab`.
- [ ] No leaderboard, no photo/name upload, no secret in bundle (`lint:secrets` covers web).
- [ ] Lighthouse PWA installable; works on laptop hotspot with backend down
      (offline pack + polls) after first load.
- [ ] Report figures exported: passport, ladder, drift map, dashboard, `/metrics`.
- [ ] Video storyboard shots mapped 1:1 to routes (§8.4 of proposal).
