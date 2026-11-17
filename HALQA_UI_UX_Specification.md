# HALQA — Complete UI/UX Specification (every route, every state, every backend feature)

**Status:** build-ready · **Owner:** P2 Frontend/UX · **Supersedes nothing — extends** `HALQA_Frontend_UI_UX_Plan.md` (§5 blueprints) to per-route, per-state, per-endpoint detail.
**Companions:** `HALQA_Backend_Blueprint_and_Data_Plan.md` (features) · `HALQA_NestJS_MongoDB_Implementation_Plan.md` (API §9) · `EdNova_Winning_Proposal.md` (rubric strategy) · `HALQA_v2_Explained_Derja.md` (v2 narrative).
**Codebase:** `halqa-web/` (React 19 + Vite + TS strict + Router + PWA) ↔ `halqa-api/` (NestJS 11 + Mongo, `/api/v1`).

> **Thesis: the UI is the rubric made visible.** Every scored criterion has a screen
> region. If a judge cannot *see* it in 90 seconds, it does not score. This document
> specifies every screen region, every backend-backed state, and every string.

---

## Table of contents

- §0 How to read this spec
- §1 Product truth (locked)
- §2 Design system contract (tokens, type, color, motion, a11y, RTL, dark surface)
- §3 App shell + navigation + global systems
- §4 Route blueprints R0–R13 (one block per route: purpose · data · layout · states · interactions · copy · a11y · judge moment · edge cases)
- §5 Component library specification
- §6 Cross-cutting systems (latency, polling, degradation, i18n, gamification, offline/PWA)
- §7 Endpoint → screen traceability matrix
- §8 Build order + definition of done + quality gates

---

## §0 How to read this spec

Every route block has the same nine fields. Nothing in a route may be shipped
that a field does not cover:

| Field | Meaning |
|---|---|
| **Purpose & judge moment** | What this screen proves to a judge (or to a learner) in one glance. |
| **Entry / exit** | How the learner arrives, where they go next (`next` param honoured everywhere). |
| **Data** | Exact endpoints, request/response shapes as the backend really returns them. |
| **Layout** | Structure, desktop vs mobile, hierarchy. |
| **States** | Loading · empty · error (codes) · degraded (ORANGE/RED/BLACK) · offline · auth edge cases. |
| **Interactions** | Every button, every transition, optimistic updates, disabled conditions. |
| **Copy** | Key strings; `t(key, lang)` keys listed with the 4 languages when non-obvious. |
| **A11y** | Focus order, roles, labels, contrast, touch targets, reduced motion. |
| **Edge cases** | Concurrent/async realities the backend produces. |

Two hard rules for implementation:

1. **Styling contract:** unlayered CSS in `pages.css` / `ui.css` (`.enter-*` precedent).
   Tailwind utilities are allowed only where they demonstrably outrank nothing
   (preflight is NOT imported; unlayered globals win — see `pages.css` note).
2. **Copy contract:** every visible string either comes from
   (a) `lib/i18n.ts` `STRINGS`, (b) backend `user_msg[lang]` via `ErrorNote`,
   or (c) server-rendered learner content (never client-translated).
   No literal English strings in JSX for chrome copy.

---

## §1 Product truth (locked — do not redesign)

### 1.1 The one-line loop

```
① DIAGNOSE (3 min) → ② DISCUSS (8 min) → ③ DO (9 min) → ④ DEBRIEF (5 min)
   DNA → passport     peer window 45–60 s   hint ladder L1–L4   capsule + quiz
```

### 1.2 Personas → routes

| Persona | Enters via | Served by |
|---|---|---|
| Learner (Ferd / Yasmine) | `/enter` nickname or account | R2 DNA, R7 session, R13 me |
| Host | create circle | R4, R6 lobby |
| Peer / Explainer | join code | R5, R7 (Style Coach whispers) |
| Mentor / Teacher | observer seat | R9 board, R10 mentor, R11 dashboard |
| Judge | `?lab=1` | R12 lab, landing proof strip |

### 1.3 Nova's 4 hats — always labelled

🟣 Mediator · 🟢 Teammate · 🔵 Tutor · 🟡 Facilitator. Every Nova message carries a
`HatChip`. Solo hats map to chips: `NOVA_NOVICE/CURIOUS → Teammate voice`,
`NOVA_SKEPTIC → Mediator voice`, `NOVA_EXAMINER → Facilitator voice`
(see `components/ui.tsx HatChip`).

### 1.4 The 7 non-negotiable UX principles (apply to every block of §4)

1. Circle First, AI Second is *visible* — the peer countdown is the session hero.
2. No silent states — every backend state (`OPEN / NOVA_THINKING / RESOLVED`,
   GREEN/ORANGE/RED/BLACK, quota-out, cached) has distinct UI + copy.
3. Quality over volume — credits, not message counts. **No leaderboard, ever.**
4. Private correction, public celebration — nudges/dominance alerts private;
   XP/badges/capsules shared.
5. No shame styling — low S-B-U tier = gentle pulse, never red; wrong answers get
   Socratic questions, never ✗ marks.
6. Offline is a first-class mode — polls, roles, flashcards, 30-snippet pack work at zero connectivity.
7. Synthetic-only — no photo/name/voice input anywhere. Avatar = neutral key.
   UI enforces the gate, not just the API schema.

---

## §2 Design system contract

### 2.1 Tokens (from `styles/tokens.css` — source of truth)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#17242E` | body text |
| `--muted` | `#526472` | secondary text |
| `--navy` | `#123047` | headers, brand, primary buttons on light |
| `--aqua` | `#1EA7A1` | Nova, primary actions, focus rings |
| `--aqua-ink` | `#0C5A57` | aqua text (AA on paper) |
| `--gold` | `#D68A24` | XP, stars, Deep-Dive ✨ |
| `--green` | `#3D8B57` | verified / trusted |
| `--amber` | `#D68A24` | simplified / fallback notice |
| `--plum` | `#6546A6` | mentor / facilitator |
| `--paper` | `#F4F7F7` | app background |
| `--card` | `#FFFFFF` | surfaces |
| `--line` | `#C9D8DB` | borders |
| `--navy-deep` | `#070F16` | hero/enter panel (dark surface) |

Hat colors: mediator `#6546A6` · teammate `#3D8B57` · tutor `#1EA7A1` · facilitator `#D68A24`.
S-B-U tiers: `bright` = solid fill · `steady` = outline · `pulse` = gentle opacity
animation (static outline + label under `prefers-reduced-motion`).
Tiers **always labelled with text** (S/B/U + word), never color-only.
Dark mode: out of scope. The `--navy-deep` surface exists only for landing + `/enter`.

### 2.2 Type scale

Display 28 / H1 22 / H2 17 / body 15 / small 13 / micro 12 (px, `--text-*` tokens).
Darija/AR body +1px. Learner-content line-height 1.55. Numbers use `.tnum`.
One face only (SF Pro system stack); no webfont downloads on app screens.

### 2.3 Motion contract (mirrors hero-15 / enter)

- Spring reveals on first paint of a route's hero region:
  `hidden {opacity:0, y:16, blur(10px)} → visible`, staggered 0.12s, delay 0.15s,
  spring `mass 1.2, stiffness 40, damping 15`.
- **`useReducedMotion()` gate:** when reduced, start on the final frame — nothing
  travels, blurs, or scales.
- Press feedback: `scale(0.98)` on `:active` for every tappable ≥44px target.
- Transitions: transform/opacity/box-shadow/color only. **No `transition: all`.**
- Countdown ticks are number-only (`tnum`), no layout-affecting animation.

### 2.4 Accessibility contract

- Focus: single unlayered `:focus-visible` ring (tokens.css) — never erased.
- Touch targets ≥44px (`min-h-11` precedent) for all interactive elements.
- Radios/dropdowns: native inputs + styled labels (`aria-pressed`, `role="radiogroup"`).
- Live regions: `aria-live="polite"` for passport fill, poll tally, XP toasts, banners.
- Every icon-only control carries `aria-label`; every decorative emoji `aria-hidden`.
- Contrast: all text AA vs its surface (already verified on hero/enter — keep ratios).
- RTL: `dir="rtl"` on `<html>` for `ar`/`darija`; shell flips, thread bubbles stay
  logical, timestamps LTR (`.tnum` + `translate="no"`).

---

## §3 App shell + navigation + global systems

### 3.1 Structure

```
┌────────────────────────────────────────────────────────┐
│ ★ HALQA  [C-xxxxxx]  [S●B●U●]  [quota ▓▓▓░] [🌐 FR▾]   │ topbar
│ [degradation banner — only when ≠ GREEN]               │
├────────────────────────────────────────────────────────┤
│  <route outlet>                                        │
├────────────────────────────────────────────────────────┤
│ ◀ Circle · 👤 Passport · 📊 Board* · 🧪 Lab*            │ bottomnav (mobile) / side rail (≥1024px)
└────────────────────────────────────────────────────────┘
```

- Landing (`/`) and `/enter` opt out via `.shell:has(.landing-hero)` /
  `.shell:has(.enter-hero)` full-bleed escape (already implemented).
- Board/Lab nav items visible only in workshop context or `?lab=1` (judge mode).
- Header center: circle join code when inside a circle (tap → copy + QR popover).
- Header right: S-B-U mini-rings (latest session), quota meter
  (`cUsed/cCap` + `lUsed/lCap`, amber <20% left), language switcher (mid-session
  allowed), avatar chip → `/me`.
- Skip-to-content link first in tab order (already present).

### 3.2 Degradation banner (global, `session.metrics.degradation`)

| Mode | Banner | Copy key |
|---|---|---|
| GREEN | (none) | — |
| ORANGE | amber banner: queue notice + position + ETA | `orange_queue` |
| RED | deep-amber banner: `Quota out — simplified answers only` | `simplified` |
| BLACK | black banner: `Offline — circle tools still work` | `offline_mode` |

Transitions animate once (height+fade, 200ms) and are also written as a
telemetry event (`telemetry/sessions/:id/events`) that `/lab` renders.

### 3.3 Quota meter (global + per-session)

`QuotaMeter cUsed/cCap lUsed/lCap` — bar turns amber when any cap >80% used.
On `/lab` the same data renders with L-share target bar (<25%).

### 3.4 Passport sheet (slide-over, every route)

Trigger: avatar chip in topbar. Content = `GET /me` + `GET /learners/:id/xp` +
`GET /learners/:id/badges` + `GET /passports/:id/explain-card`:
level · style weight bars · lang · hint eagerness · `invite_me` · explain-card ·
XP + BadgeRow. Guest records render the upgrade hint → `/enter`
(`data.learner.handle == null`), accounts render the passphrase rotation panel
(already built in `Me.tsx`; the sheet reuses `PassportView` + the account card).

### 3.5 Boot gate

On app start: `GET /healthz`; on failure render `SetupHint` card
(backend not running — dev instructions) instead of a blank shell.

---

## §4 Route blueprints

### R0 `/` — Landing (hero-15, done — keep)

Polished reference. Regions: nav (brand/Circles/Board/Passport + lang), headline
"No voice left behind", description, CTAs (`Join a circle` → `/enter`,
`Have a code?` → `/circles/join`, `Sign in` → `/enter`), proof strip
(`4 → 0 AI calls once the network drops · H1 → H4 · 4 languages`), footnote
ethics line. Optional enhancement when time allows: live `GET /kb/stats` chips
(`39 KB chunks · 4 languages`) in the proof strip — T0, cached, cheap.

---

### R1 `/enter` — completed auth (done, spec recorded for parity)

Three modes on one glass card over `--navy-deep` + `hero-bg.avif`:

| Mode | Fields | Endpoint | Notes |
|---|---|---|---|
| Create account | handle (3–20 `[a-z0-9][a-z0-9_-]*`) + passphrase (8–128) + nickname(≤24) + avatar + context | `POST /auth/register` | upgrades current guest record → progress kept |
| Sign in | handle + passphrase | `POST /auth/login` | `LOGIN_FAILED` → gentle localized copy, field-level error, no lockout UI |
| Try it | nickname (≤24) + avatar + context | `POST /auth/session` | guest record; `Me` shows upgrade hint |

- Inline validation mirrors `security/credentials.ts` exactly
  (`HANDLE_RE`, `PASSPHRASE_MIN/MAX`) — never submit to learn.
- Show/Hide passphrase toggle (`aria-pressed`, min 44px target).
- Autocomplete semantics: `username` / `new-password` / `current-password` / `nickname`.
- Errors render `user_msg[lang]` through `ErrorNote` — codes:
  `HANDLE_INVALID`, `PASSPHRASE_LENGTH`, `ACCOUNT_EXISTS`, `LOGIN_FAILED`.
- Success: `login(token, learnerId)` → `next` param, else context routing
  (`solo → /solo`, else `/board`). `?context=` preselects the context pill.
- No email/phone fields exist. Ever. (Ethics gate — UI-enforced.)

---

### R2 `/dna` — Diagnose (≤3 min, 4 taps)

**Purpose & judge moment.** The brief's "diagnostic step" made literal and
inspectable. Live-filling passport = "wow, it sees me".

**Data.** `GET /dna/items` → `items: [{id:'L1|S1|G1|C1', prompt, options[]}]`
(T0 content, bilingual prompts already in the service).
`POST /dna {nickname?, context, answers:{L1,S1,G1,C1}}` →
`{learnerId, passport}`. Passphrase accounts get the passport written on
*their* record (`Authorization` header), guests get a fresh learner id.

**Layout.** Two columns desktop (stepper stack + live passport aside), stacked
mobile (passport collapsible, sticky at bottom as a mini card that grows).
Progress hairline across the top: 4 segments, each lights as its item is answered.

**States.**
- Loading: 4 skeleton cards with shimmer (same shapes as cards).
- Error: `ErrorNote` (retryable) — "Could not load the diagnostic."
- Partial: submit disabled until all 4 answered; helper text shows `2/4` count.
- Offline: items are T0/static — fetch failure falls back to the same 4 items
  hardcoded in the client mirror (identical ids/options), submit queues into
  the offline outbox (polls/flashcards pattern).

**Interactions.**
- Option tap → instant `aria-pressed` selection + passport field updates live
  (`aria-live="polite"`).
- `L1` (level) → passport `Level`. `S1` (style) → `Style: X-first`.
  `G1` (language) → also sets the *session UI language* suggestion prompt
  ("Follow your answers in Darija?" one-tap accept → `setLang`). `C1` (confidence)
  → hint eagerness word (eager/normal/light from `hintEagerness`).
- Submit → quiet confirmation (`Passport ready ✓`, no confetti) → 900ms →
  `next` param (default `/circles/join`; solo flow: `/enter?context=solo` → `/solo`).

**Copy keys.** `dna_1_level`, `dna_2_style`, `dna_3_lang`, `dna_4_confidence`,
`dna_ready`, `dna_progress` — 4 langs in `i18n.ts`. Option labels stay
`translate="no"` (server values).

**A11y.** Each item is a `fieldset` + `legend` (semantic); options are real
radio inputs styled as cards (mirroring `.enter-context`). Stepper order
enforced by DOM order; keyboard one-pass.

**Edge cases.** Returning with an existing passport → preselect previous
answers (from `GET /me` passport) and label the screen "Review your passport";
`POST /dna` is idempotent per learner.

---

### R3 `/solo` — Teach Nova

**Purpose & judge moment.** Covers "individual AND group learning" with one
codebase; protégé effect on screen; ≤8 compact calls, larger = 0 — visible budget.

**Data.**
- `POST /solo/sessions {topic, lang, learnerId}` → `{sessionId, hat:'NOVA_NOVICE', probe}`.
- `POST /solo/sessions/:sid/turn {learnerId, text, lang}` → `{novaTurn, progress}`.
- `POST /solo/sessions/:sid/hat {hat}` → `{hat}` (`NOVA_NOVICE|SKEPTIC|CURIOUS|EXAMINER`).
- `POST /solo/sessions/:sid/invite` → `{deepLink:'halqa://join?code=…', code}`.
- Budget line from `metrics.quotaUsage.find(sessionId === sid)`.

**Layout.** Single column (max 30rem) like `/enter`-era polish:
- Header: hat chip-row (4 chips, `.hatchip` 44px targets, `aria-pressed`) +
  progress bar `n/8` with words ("Teach Nova 3 of 8 turns").
- Thread: bubbles — Nova probes carry `HatChip`, learner bubbles right-aligned
  (RTL flips, logical order kept). Thread is `role="log" aria-live="polite"`.
- Composer pinned at bottom of thread (input + Send).
- Footer: budget line (`Solo budget: 5/8 compact · 0 larger — honesty as a
  feature`) + invite affordance.

**States.**
- Start (no session): hero-lite card "Start — Nova is the curious student"
  (disabled with hint if no token).
- Turn in flight: learner bubble appears instantly (optimistic); Nova bubble
  shows the *staged* skeleton with the real stage vocabulary is NOT available
  in solo — use a simple pulsing dot row (3 dots, 1.2s cycle, pauses reduced-motion).
- Error on turn: learner bubble stays + inline `ErrorNote` with Retry (resends).
- Progress cap: at `progress >= 1` the composer is replaced by the capsule
  teaser + invite card.

**Interactions.**
- Hat switch mid-conversation: allowed, next probe uses new hat; a subtle
  divider line marks the switch in-thread.
- Invite: opens card with `halqa://join?code=` deep-link, big code, QR
  (`QRCodeSVG`, `role="img"` labelled), copy button (navigator.clipboard),
  "اعزم صاحبك وردّها حلقة" line. L is never spent in solo — if a Deep-Dive chip
  ever appears here, that is a bug.

**Edge cases.** Reload mid-solo: sessions are server-held; on mount, if a
`halqa.soloSession` id exists in sessionStorage, `GET`-rehydrate by resuming
thread from telemetry events or start fresh with a clear "New circle with Nova"
(deterministic, no zombie threads).

---

### R4 `/circles/new` — Create circle

**Purpose & judge moment.** The 90-second "under a minute" promise; big code +
QR payoff.

**Data.** `POST /circles {topic, context, lang, windowS, hostNickname}` →
`{circleId, joinCode, token, hostLearnerId}`. `GET /kb/stats` → topic chunk
counts (proof chips). `GET /contexts/:mode/config` → agenda template preview.

**Layout.** One card, `page narrow`:
- Topic picker — **cards, not selects**: two big option tiles (binary_search,
  fractions) with KB chunk-count chips (`12 chunks · 4 langs`).
- Context picker — 6 pill cards (reuse `.enter-context`).
- Language — 4 pills with native names (français / دارجة / العربية / English).
- Peer window slider 30–90s (default 45) — value shown as a big `45s` with the
  word "Peers answer for this long before Nova steps in."
- Host nickname input (prefilled from session nickname when present).
- Agenda preview strip from context config (goal/explain/challenge/teachback/recap).

**Result state** (full-screen replace): giant join code (`code-big`, tnum),
URL, QR, Copy, **Open lobby →**. Copy button confirms with a transient
"Copied ✓" (state, not toast lib).

**States/edge.** Nickname empty → disabled submit. Error → `ErrorNote` retryable.
Back from result → confirm-leave (result is a created circle; leaving is safe,
lobby reachable from Board too).

---

### R5 `/circles/join` — Join by code

**Data.** `GET /circles/by-code/:code` → preview (topic, members count, context)
→ `POST /circles/:id/join {nickname, avatarKey?}` → member record + token adopt
if fresh learner.

**Layout.** Code input as **6-box code entry** (auto-uppercase, forgiving
spaces/dashes, paste-anything normalizes) OR auto-filled from `?code=` (QR
camera path). Below: preview card (topic + `n members` + window seconds) +
nickname (prefilled) + avatar row (compact, 8) + Join button.

**States.** Invalid code → inline field error `CIRCLE_NOT_FOUND` copy, shake
once (transform only, reduced-motion static). Full circle → localized error.
Already a member → straight to lobby (`GET /circles/:id` returns membership).

**Judge moment.** QR scan → in under 5 seconds you are in a lobby.

---

### R6 `/c/:circleId` — Lobby

**Purpose & judge moment.** The circle feels alive before the session: roster,
explain-cards, agenda — Start is one tap.

**Data.**
- `GET /circles/:id` → `{topic, members[{learnerId, role, nickname?}], joinCode, windowS}`.
- `GET /passports/:learnerId/explain-card` per member → `{card, visible}` —
  **only render when `visible === true`** (opt-in privacy).
- `POST /circles/:circleId/sessions` → `{sessionId}` (idempotent: joining a
  live session returns it — no fork).

**Layout.**
- Header: topic + join code chip (copyable) + window badge (`45s window`).
- Roster: avatar glyph + nickname + passport style-dot + optional explain-card
  (small italic quote cards). Host crown on the creating member.
- Agenda template timeline (5 rows with minute budget from context config).
- Primary: **Start session** (host only) → navigate `/c/:id/s/:sessionId`.
- Non-hosts see "Waiting for the host…" with a live roster pulse.
- Late-joiners with an existing capsule in this circle see a `Catch me up`
  recap card (last capsule's bullets).

**States.** Empty roster (host only, pre-join) → share-the-code card again
(compact variant of R4 result). Error → ErrorNote.

---

### R7 `/c/:circleId/s/:sessionId` — Session room (the core screen)

**Purpose & judge moment.** The CF-AS state machine rendered literally:
countdown hero, peers-first, staged honest progress, ladder, polls, cites,
credits, rings. This screen alone must prove M1/M2/M3.

**Data & pollers.**

| Poller | Endpoint | Interval | Contract |
|---|---|---|---|
| question list | `GET /questions?sessionId=` | 4s | qids only, merge-append |
| question state | `GET /questions/:qid/state?asker=<me>` | 1.5s | ETag/304, <1KB, asker-only detail |
| circle health | `GET /circles/:id/health` | 5s | `{S,B,U,tiers,needsHuman,inputs}` |
| credits | `GET /sessions/:id/credits` | 5s | `[{learnerId,total}]` |
| metrics | (from session store, 5s) | | `quotaUsage` per session |

All pollers pause on `document.hidden`; two consecutive failures show a
`stale 12s` age chip — never silent.

**Layout.** Desktop 3-column (`.room-grid` ≥1024px): left rail (agenda+members),
center feed (max 42rem), right rail (health+people+budget). Mobile: feed first,
rails collapse into two top chips that expand as sheets.

**Center — the question feed, state by state:**

1. **Composer** (sticky top):
   textarea (2 rows) + live lang note (`Arabizi → Darija ✓` via the existing
   regex heuristic — mirror, don't correct) + `Anonymous` checkbox styled as a
   mask icon toggle + Ask button. On submit → optimistic OPEN skeleton card.
   Character hint at 240+ chars (`≤60 words` guidance for Darija oral register).

2. **OPEN card:**
   - Hero: `CountdownRing` — big 0:MM:SS derived from `windowEndsAt − clientNow`
     (client clock only; server `now` would break ETags), tick 1s.
   - Peer answers list (avatar glyph + nickname + text), newest first.
   - Buttons: `I can help` (focuses the peer composer), `Me too`
     (`POST /:qid/me-too`, idempotent, button becomes "✓ you're counted",
     disabled after success), `Skip the wait` (**asker-only** — peers never see
     it; ≤2 clicks to answer).
   - Peer inline composer under the list.
   - Skel shimmer for the first 200ms, never a spinner.

3. **NOVA_THINKING card (asker-only detail):**
   vertical stepper with the *real* pipeline stage names from `view.stages`
   (`retrieving → checking_similar → writing → verifying`), each row:
   done = ✓ aqua, active = pulsing dot, pending = grey. Peers see exactly one
   line: `Nova is thinking…` + a thin indeterminate bar. Add the plan's budget
   note as micro copy under the stepper: `compact < 4s · larger < 12s`.

4. **RESOLVED card** — by `view.resolution`:
   - `peers_verified`: winning peer answer (or Nova completion if Nova
     completed peers' answer — the backend appends), `✓ verified by Nova`
     (green), `peer-first` badge (gold chip) when `view.peerFirst`,
     `CiteChips` (tap → KB drawer `GET /kb/chunks?topic&lang`, excerpt card).
     Empty cites → the warning chip (contract violation made visible).
   - `hint_path`: auto-L1 hint text + `HintStepper` — 4 steps (H1 H2 H3 ◆):
     reachable if unlocked, 🔒 + reason (`l4_locked` key) when locked
     (backend `403 HINT_L4_LOCKED` — the UI pre-locks visually once L1–L3 are
     taken, never sends the request blind); each taken hint renders its text
     under the ladder in a numbered block. Only the asker's client renders the
     ladder (backend: `HINT_ASKER_ONLY`).
   - `skip_direct`: Quick Take text (≤600 chars preview + `Read full` expands
     inline) + tier chip (`C`/`T0-offline`) + `cached` tag when served from
     cache + cites.
   - `poll`: embedded `PollCard` — choices as big tappable rows with live
     tally bars (`GET /polls/:pid` on state change), one vote per learner
     (voted state persisted visually), Close button (asker/host) → winner
     announcement banner inside the card. **Hardened copy: choice labels come
     from the poll resource, never `JSON.stringify`.**
   - Deep-Dive (`view.deepDiveReady`, asker-only): slide-in card
     `✨ deeper answer ready` (gold border, `--gold`), never replaces the
     earlier text (append-only per the latency protocol).

**Left rail — Agenda & members:**
- Agenda checklist (from `GET /sessions/:id` agenda) — 5 rows with done ticks.
- Member list with credit dots + totals; **host-only private `Invite`**
  affordance next to members with 0 contributions (opens the Coach nudge
  composer — see right rail; never public).
- Link out: Debrief → (styled as a real footer action, not a "Links" card).

**Right rail — Health & people:**
- `SbuRings` with tier words (`bright/steady/pulse` → `bright = 0.75+`,
  labels always text): Structured / Balanced / Understood; `needsHuman` →
  gentle plum pulse border + `Needs a human — invite quiet voices` + button
  → Coach panel.
- `CreditBar` ranked desc; hover/focus shows the formula tooltip
  `2·ln(1+n) on plain talk · quality actions weigh 3` — the judge shot.
- `QuotaMeter` (session-scoped) amber <20% left.
- **Coach panel** (peer view of one member): target's explain-card +
  `Nudge` (`POST /coach/nudge/:targetId` → `{nudge, private:true}` — rendered
  as a private whisper chip, only on the nudged learner's screen per backend
  contract; here we show confirmation "Nudge sent privately ✓") +
  `Rephrase` (`POST /coach/rephrase` — 1×C budget, disabled with reason when
  `lUsed`-style budget flag trips).

**States summary (this route):** skeleton cards per poller (never full-screen
spinner) · empty feed (`Ask the first question` CTA) · per-action ErrorNotes
with backend codes (`HINT_L4_LOCKED`, `HINT_ASKER_ONLY`, `RATE_LIMITED`,
`AUTH_*`) · ORANGE (queue ETA banner + pollers keep going) · RED (every AI
output tagged `Simplified answer (quota)`) · BLACK (offline banner + composer
disabled with explanation; polls/me-too/whisper-repair stay live) · 401 →
unauthorized handler → `/enter?next=` (already wired in `lib/api.ts`).

**A11y.** Cards are `<article aria-label="Question … state">`; countdown is
`role="timer"` with polite announcements every 15s only (not every tick);
poll tally `aria-live="polite"`; ladder buttons have explicit labels
(`Hint 2 — locked until Hint 1`).

---

### R8 `/c/:circleId/s/:sessionId/debrief` — Close the loop

**Data.**
- `POST /sessions/:id/capsule` → `Capsule {bullets[3], visual_desc, mini_quiz[3 qids], next_step, xp_earned, tier:'C'|'L'|'T0'}` (+ `GET` same path).
- `POST /quiz/battle {sessionId, circleId, topic?, level?}` → `{bid, items[{qid, stem, choices, level, lang}]}`; `POST /quiz/battle/:bid/answer {learnerId, qid, choice}` → `{correct, explain, xp}`.
- `POST /whisper {sessionId, circleId, steps[]}` → `{chainId, steps, driftMap:{kept,lost,distorted,added}, tier}`; `POST /whisper/:cid/repair {checklist}` → `{coverage}`.
- `POST /sessions/:id/end` → `{endedAt, health, credits, usage}`.
- `GET /learners/:id/xp`, `GET /learners/:id/badges`.

**Layout.** Vertical celebration stack, one card per subsystem, each with its
hat chip (Tutor for capsule, Facilitator for battle, Mediator for whisper):

1. **CapsuleCard** — 3 numbered bullets (≤15 words each — backend enforced),
   visual_desc rendered as an elegant `alt`-described diagram placeholder card
   (a drawn placeholder with the description text — no image gen), 3 mini-quiz
   chips (tap → KB drawer), `next_step` as a forward arrow card, `tier` chip
   (`C · ready now` / `L · polished` / `T0 · offline`). Deep-Dive slide-in
   mirrors R7 when a late L polish lands.
2. **BossBattleCard** — 3 items MCQ; team answers collectively; each answer →
   `{correct, explain, xp}` inline with explanation citing `qid`; correct →
   `+20 XP` toast (transient, top-right, `aria-live`); wrong → guidance, never ✗.
3. **WhisperCard** — chain steps listed; `DriftMap` as 4 labeled columns
   (kept ✓ green / lost ✗ amber / distorted ⤳ amber / added ✚ grey — words
   always visible, color secondary); repair composer (one shared text) →
   coverage % ring; ≤1 C call total.
4. **XpPanel** — total, BadgeRow (First Light · Bridge Builder · Kind Skeptic ·
   Chain Healer · Polyglot), streak flame (cap 5, plain text).
5. **EndSession** (host) → summary (final S-B-U, peer-first rate, credits
   total) → CTA back to lobby / board. Non-hosts see read-only summary.

**States.** Capsule build in flight → staged skeleton with real step names
(`extracting → formatting`); battle not started → `Start the battle` CTA;
whisper needs ≥2 steps → disabled with reason; all errors ErrorNote-retryable.

---

### R9 `/board` — Workshop board

**Data.** `POST /circles/match {nicknames[]}` → groups with rationale lines;
`GET /board` → circle grid with health; `GET /circles/:id/health` per card (5s).

**Layout.**
- Matcher card: pasted nickname list (textarea, one per line) → preview
  groups as rows of 3–5 avatar+nickname chips + rationale line
  (`levels: novice/beginner · langs: fr/darija · styles complementary`) →
  `Create circles` creates them (loop `POST /circles`).
- Grid of circle cards: topic + members + S-B-U mini rings + `needs_human`
  **pulse border** (gentle plum, 2s cycle, reduced-motion = static outline) —
  the "Circle 3 needs a human now" shot. Card tap → mentor brief preview
  (`GET /mentor/brief` scoped) or lobby.

**States.** No circles → EmptyState with matcher CTA. Stale (2 failed polls) →
age chip. Judges: this page is reachable from nav only in workshop context.

---

### R10 `/mentor` — Mentor seat

**Data.** `POST /circles/:id/mentor/join` → observer token/role;
`GET /mentor/brief` → ≤60-word brief; `POST /mentor/notes {text}` → gentle
Note card (plum).

**Layout.**
- Observer banner: `You are invisible — no credits, no turns` (plum chip).
- Brief card: ≤60 words, `Refresh` (1×C, disabled with reason after use),
  plum left border.
- Notes composer (≤500 chars, live counter) → sent notes listed as gentle
  plum cards (never red).
- Footnote: aggregates-only reminder.

**States.** No circle selected → circle picker (list from board). Error codes
localized via ErrorNote.

---

### R11 `/dashboard` — Teacher view

**Data.** `GET /dashboard` → aggregate sessions; `GET /sessions/:id/credits`
per selected session.

**Layout.** Ordered by the user-test decision (stuck concepts first):
1. Stuck-concepts list (low-U sessions first).
2. Talk-share bars per session (credits, anonymized `L-##`, log-capped note).
3. Style-mix (stacked bar, not a donut — cheaper + labelable).
4. S-B-U trends over sessions (sparkline rows).
Every card labelled `aggregates only · anonymous` (micro chip).

**States.** No data → EmptyState (`Run a session to fill this`).

---

### R12 `/lab` — Engineering proof (judge mode)

**Data.** `GET /metrics` (3s): callsByTier C/L, lShare, p50/p95 per tier,
cacheHitRate, peerFirstRate, fallbackCounts, quotaUsage, degradation, KB docs,
offline snippets. `GET /degradation`, `POST /chaos {mode}`, 
`GET /telemetry/sessions/:id/events` (5s).

**Layout.**
- Route table card (router policy frozen — C vs L per step, mirrors report §5).
- **L-share target bar** with `< 25%` marker line and live value — the scored
  number, biggest element on the page.
- Live meters grid: each metric a labelled stat card with sparkline-ish bar.
- Chaos console: 4 buttons GREEN/ORANGE/RED/BLACK (`POST /chaos`) + a
  `Replay walk` button that steps through all four for filming.
- Event log: timestamped `reading → verdict → decision → action` chain rows
  (`actor`, `type`, `payload`), append-only rendering.
- Declared budgets footer: `skeleton < 1.5s · compact < 4s · larger < 12s`.

**States.** Chaos errors → ErrorNote; metrics unreachable → stale chip.

---

### R13 `/me` — Identity (done; sheet variant shares components)

Existing: identity card (`@handle` when account, `L-##` when guest), passport,
XP, passphrase rotation (accounts) or upgrade hint (guests), sign out (epoch
revoke → `/enter`). Add: BadgeRow + explain-card block + avatar/context
editing (`PATCH /me {avatarKey, context}`) inline.

---

## §5 Component library specification

All in `components/` + `components/ui.tsx` (shared) — one visual language.

| Component | API | Notes |
|---|---|---|
| `HatChip` | `hat` | 4 hats + solo NOVA_* mapping; bilingual labels (fr · ar) |
| `SbuRings` | `S,B,U` | tiers with **text labels**; pulse respects reduced-motion |
| `SbuMini` | — | topbar/board variant (dots + tooltips) |
| `CountdownRing` | `endsAt` | client-clock; `role="timer"`; 15s announcements |
| `QuotaMeter` | `cUsed,cCap,lUsed,lCap` | amber <20% left |
| `CreditBar` | `credits[]` | formula tooltip `2·ln(1+n)` |
| `HintStepper` | `taken[], locked, onTake(level)` | 🔒 + reason; never blind-request L4 |
| `PollCard` | `pid` | choices, live tally bars, voted-state, close→winner |
| `CiteChips` | `cites[], onOpen` | empty → warning chip |
| `KbDrawer` | `topic,lang` | slide-over, `GET /kb/chunks`, excerpt cards |
| `QuestionCard` | `qid` | the R7 state machine |
| `CapsuleCard` | `capsule` | bullets/visual/quiz/next/tier chip |
| `DriftMap` | `driftMap` | 4 labeled columns |
| `XpToast` | `amount, reason` | transient, polite live region |
| `BadgeRow` | `badges[]` | names + glyphs |
| `ErrorNote` | `code,msg,retryable,onRetry` | `user_msg[lang]`; code chip `translate="no"` |
| `EmptyState` | `title,hint,action` | CTA-bearing |
| `Skeleton` | `shape` | per-screen shimmer shapes — never a generic spinner for AI waits |
| `StaleChip` | `ageS` | "stale 12s" after 2 failed ticks |
| `DegradationBanner` | `mode` | §3.2 |
| `PassportSheet` | — | §3.4 |
| `SetupHint` | — | boot-gate fallback |

---

## §6 Cross-cutting systems

### 6.1 Latency protocol (no streaming — design around it)

1. Skeleton-first (<200ms) → Quick Take fills → Deep-Dive slides in later
   (append-only, never retract).
2. Staged honest progress: real pipeline stage names only; asker-only granularity.
3. Peer window hides the wait: the countdown IS the loading state.
4. Countdown math: `windowEndsAt − clientNow`, tick 1s, no server `now`.
5. Prefetch DNA/passport at session start while learners read.
6. Declared budgets displayed in `/lab` footer.

### 6.2 Polling discipline

Intervals per §7/R7. ETag/If-None-Match → 304 no-render. Payloads <1KB
(asserted: `truncated` honored + `Read full` expands from preview — the
600-char contract, not just perf). Pause on `document.hidden`. `StaleChip`
after two failures. Re-key pollers on route change (no leaked intervals).

### 6.3 Degradation UX (all four states visible, never silent)

GREEN → ORANGE (banner + queue ETA; C continues) → RED (quota out:
`simplified` tag on all AI output, copy key `simplified`) → BLACK (offline:
banner `offline_mode`, composer disabled with explanation; polls, me-too,
whisper repair, quiz stay live; snippet answers tagged `offline`).
After recovery, Deep-Dive arrival = `✨ deeper answer ready`.

### 6.4 Multilingual

- Header switcher, mid-session allowed; learner content keeps its own lang.
- Arabizi input → `Arabizi→Darija ✓` note (mirror, never correct).
- Darija: short bubbles (≤60 words server-enforced; UI adds no chrome).
- RTL: `dir=rtl` for ar (darija stays LTR per current `RTL` array — keep);
  thread logical; timestamps LTR.
- Parity proof linkable in `/lab` (B2 bonus inspectable).

### 6.5 Gamification display rules

XP toasts (+20 sharp question…), BadgeRow, streak flame cap 5.
**No leaderboard component may be built.** Circle shows S-B-U, not ranks.
Low rings pulse gently; never red, never shaming.

### 6.6 PWA + venue survival

Precache shell + offline pack view; runtime-cache GETs. `?demo=1` seeds
demo nicknames. Recovery = reload → seed state → offline pack, ≤2 minutes.
Install prompt on `/enter`.

### 6.7 Copy deck additions (add to `lib/i18n.ts`, 4 langs each)

`orange_queue` · `quota_out` · `stale` · `read_full` · `i_can_help` ·
`nudge_sent` · `rephrase` · `start_session` · `waiting_host` · `catch_me_up` ·
`share_code` · `copied` · `code_invalid` · `circle_full` · `dna_ready` ·
`dna_progress` · `solo_budget` · `invite_friend` · `battle_start` ·
`battle_win` · `whisper_start` · `whisper_repair` · `coverage` ·
`end_session` · `aggregates_only` · `needs_human` · `l_share` ·
`simplified_tag` · `offline_tag` · `setup_hint`.

---

## §7 Endpoint → screen traceability (nothing unrendered, nothing unfetched)

| Endpoint | Screen(s) | Component/state |
|---|---|---|
| `GET /healthz` | boot gate | SetupHint |
| `GET /readyz` | boot gate (dev) | SetupHint |
| `POST /auth/session` | R1 guest | Enter |
| `POST /auth/register` | R1 signup | Enter |
| `POST /auth/login` | R1 signin | Enter |
| `POST /auth/passphrase` | R13 + sheet | AccountCard |
| `POST /auth/signout` | R13 | signOut (epoch revoke) |
| `GET /me`, `PATCH /me` | R13, sheet | identity + avatar/context edit |
| `GET /dna/items`, `POST /dna` | R2 | Dna + passport live preview |
| `GET /passports/:id/explain-card` | R6, coach panel, sheet | explain-card (visible-gated) |
| `POST /coach/nudge/:targetId`, `/coach/rephrase` | R7 right | CoachPanel (private) |
| `POST /circles`, `/circles/:id/join`, `/circles/by-code/:code`, `GET /circles/:id` | R4, R5, R6 | code+QR, roster |
| `GET /contexts/:mode/config` | R1, R4, R6 | agenda templates |
| `POST /circles/:circleId/sessions` | R6 | idempotent start |
| `GET /sessions/:id`, `POST /sessions/:id/end`, `GET /sessions/:id/credits` | R7, R8 | agenda, credits 5s |
| `GET /circles/:id/health` | R7 right, R9 | SbuRings 5s |
| `GET /questions?sessionId=` | R7 | list poller 4s |
| `POST /questions` | R7 | Composer (optimistic) |
| `GET /questions/:qid/state` | R7 | 1.5s ETag poller |
| `POST /questions/:qid/peer-answer|answer|me-too|skip|hint` | R7 | OpenBody / ladder |
| `POST /polls`, `/polls/:pid/vote`, `/close`, `GET /polls/:pid` | R7, R8 | PollCard |
| `POST|GET /sessions/:id/capsule` | R8 | CapsuleCard |
| `POST /quiz/battle`, `/quiz/battle/:bid/answer` | R8 | BossBattleCard |
| `POST /whisper`, `/whisper/:cid/repair` | R8 | WhisperCard + DriftMap |
| `POST /solo/sessions|turn|hat|invite` | R3 | Solo (≤8C invariant) |
| `POST /circles/match`, `GET /board` | R9 | matcher + grid |
| `POST /circles/:id/mentor/join`, `/mentor/notes`, `GET /mentor/brief` | R10 | observer seat |
| `GET /dashboard` | R11 | aggregates |
| `GET /learners/:id/xp|badges`, `POST /learners/:id/xp` | R8, sheet | XpPanel |
| `GET /kb/chunks|stats` | R0, R4, KbDrawer | proof + cites |
| `GET /metrics`, `GET /degradation`, `POST /chaos` | shell, R7, R12 | quota + chaos |
| `GET /telemetry/sessions/:id/events` | R12 | audit chain |

---

## §8 Build order + definition of done

### 8.1 Polish order (demo-visible value first)

| # | Scope | Exit criterion |
|---|---|---|
| P1 | R7 session room full rebuild (layout, countdown hero, thinking stepper, RESOLVED variants, PollCard, credits, S-B-U, coach panel) | judge can watch ask→peers→Nova→ladder without reading code |
| P2 | R2 DNA live passport + R3 solo polish | "sees me" moment filmed |
| P3 | R4/R5/R6 create-join-lobby (code cards, roster, agenda) | QR→lobby < 5s |
| P4 | R8 debrief (capsule, battle, whisper, XP) | full loop close on screen |
| P5 | R9/R10/R11/R12 pro screens + chaos walk | fallback shot rehearsable from /lab |
| P6 | i18n sweep (§6.7), RTL pass, banners/skeletons, a11y audit, PWA offline check | DoD below all green |

### 8.2 Definition of done (gate list)

- [ ] Every §7 row rendered by exactly one owner screen.
- [ ] All pollers: 1.5s/4s/5s per table, ETag/304, <1KB payloads, hidden-pause, StaleChip.
- [ ] Ladder truth-table clickable on screen: 409 in-window → settle → 403 L4 → L2/L3 → L4.
- [ ] Chaos walk GREEN→ORANGE→RED→BLACK visible from `/lab` and in the room.
- [ ] Darija short-oral + RTL + Arabizi note; parity set linked in `/lab`.
- [ ] No leaderboard, no photo/name upload, no secrets in bundle.
- [ ] Every chrome string via `i18n.ts` (grep: zero raw literals in routes).
- [ ] Touch targets ≥44px, focus ring intact, reduced-motion honored everywhere.
- [ ] Works from laptop hotspot with backend down after first load (offline pack).
- [ ] Report-figure screenshots exportable: passport, ladder, drift map, dashboard, metrics.
- [ ] tsc clean, oxlint clean, unit tests green, `npm run build` green.

### 8.3 Quality gates before any route ships

1. Visual: matches tokens/§2 (no ad-hoc colors, radii, or shadows).
2. States: loading/empty/error/degraded/offline all specified AND implemented.
3. Copy: 4-lang parity for every new key.
4. A11y: keyboard-only walkthrough of the route succeeds.
5. Backend parity: every endpoint call uses `lib/api.ts` typed client; no ad-hoc fetch.
