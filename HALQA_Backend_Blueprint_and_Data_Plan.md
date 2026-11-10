# HALQA v2 — Backend Blueprint & Data Plan (Build-Ready)

**Folder:** `challenge wie act/` · **Event:** IEEE WIE ACT 5.0 — EdNova GenAI Peer Learning Companion
**Companions:** `EdNova_Challenge_Specification.md` · `EdNova_Winning_Proposal.md` (v1) · `HALQA_v2_Problem-Fit_and_IEEE_Impact.md` (v2 idea) · `HALQA_v2_Explained_Derja.md`
**Phase 1 deadline:** 10 November · **Team:** 3 people · **Stack:** PWA frontend + FastAPI backend + SQLite + local retrieval (no fine-tuning, no secrets in repo)

**Conventions used below:** Tier **T0** = deterministic, zero model calls · **C** = compact/fast model · **L** = larger/capable model. Priority **P0** = Phase 1 must-have · **P1** = if on schedule by 29 Oct · **P2** = roadmap slide. All names/IDs are **synthetic** (L-01…, nicknames, no PII).

---

## 0. How to use this document

- **§1** = the complete feature catalogue (v2 new + v1 kept), each with logic, tier, calls, data, fallback, acceptance. This is the build checklist.
- **§2** = every data asset with schemas and ready-to-type seed content (KB chunks, DNA bank, hints, quizzes, languages, equity math, S-B-U math, gamification, fixtures).
- **§3** = backend blueprint (adapter, router, APIs with JSON, SQL DDL, cache/quota/queue, retrieval, degradation, deploy, tests).
- **§4** = build order + ownership + traceability to rubric/report/demo.

---

## 1. FEATURE CATALOGUE (complete, build-ordered)

### F-V2-1. Circle First, AI Second (CF-AS) — P0 — T0 + C (+L only on escalation)

- **Goal / rubric:** peers answer first (Relevance, Innovation); peer window hides latency (Feasibility); peer-first rate metric proves "support, not replace".
- **UX:** question card states: `OPEN (peer window 0:45)` → `NOVA THINKING (staged steps, asker-only)` → `RESOLVED`. Buttons: `I can help` · `Me too` · asker-only `Skip the wait`.
- **Logic (T0 orchestrator, no model for the state machine):**
  1. `POST /questions` creates row `{id, circle_id, asker_id, text, lang, anonymous, state=OPEN, window_s=45|60 host config}`.
  2. In parallel (background task): retrieval T0 → cache lookup → prepare C **Quick Take** silently (not shown); queue L **Deep Dive** only if escalation fires (see §3.3).
  3. On `window_expire` or `skip`: if ≥1 peer answer → Auditor path (F-AUD); elif none → Hint Ladder L1 (F-HINT); elif skip → direct answer path (routine→C, flagged→L).
  4. Staged progress visible **only to asker** (`retrieving → checking similar → writing`); peers see countdown.
- **Calls:** 0 model calls for orchestration; 1×C Quick Take (hidden prep); L only on escalation.
- **Fallback:** window + polls + roles work with zero model (Red/Black mode, §3.8). Quick Take served from cache/offline pack if C down.
- **Accept:** peer-first rate logged; skip path < 2 clicks; window configurable 30–90 s; works offline except Nova step.

### F-V2-2. "Explain-to-me" card + Style Coach — P0 — T0 (+C wording only)

- **Goal:** personalise the *peers*, not just the AI (Innovation + Relevance: "single explanation method" solved at peer level).
- **Data:** from passport → card template (T0 string render, 6 styles): e.g. `Explain to me: picture first → then example. Short sentences.` Opt-in visibility per learner.
- **Style Coach:** when explainer starts, private nudge rendered from template (0 calls). C used only if explainer taps `rephrase my explanation` (1 call, bounded ≤80 tokens).
- **"Make it click":** explainer re-explains in another style; Auditor checks **concept coverage** (claim checklist T0 + 1×C classify if needed).
- **Accept:** card renders from passport in <100 ms; coach nudge private (never public); coverage check runs on Whisper/Boss content too.

### F-V2-3. Circle Health S-B-U rings — P0 — T0

- **Goal:** one glance = whole problem statement (Structured · Balanced · Understood); doubles as learning-analytics extension.
- **Math (all T0, recomputed on every event):**
  - `S = 0.4*agenda_completion + 0.3*time_discipline + 0.3*recap_done`, each 0..1.
  - `B = 1 - normalised_dispersion(credits)` (see F-V2-4); 1 = perfectly shared.
  - `U = 0.5*check_success_rate + 0.3*(1 - avg_hint_depth/3) + 0.2*(1 - corrections_per_answer_capped)`.
  - Ring display thresholds: ≥0.75 bright · 0.45–0.75 steady · <0.45 pulse gently (no red/shame styling).
- **Accept:** rings update live on events; mentor board aggregates same math per circle; values logged per session for report.

### F-V2-4. Contribution Credits (fair equity) — P0 — T0 (+C fields inside Group Pulse, no extra call)

- **Goal:** equity by quality, volume-capped; silent participation counts (Innovation + fairness).
- **Weights (config `equity.yaml`):** sharp_question 3 · good_explanation 3 · bridging 3 · kind_skeptic 3 · poll_vote 1 · me_too 1 · scribe_note 1 · plain_message 0.5 with **log cap**: `effective_plain = 2*ln(1+plain_count)` so volume ≠ dominance.
- **Classification source:** Group Pulse (1×C per turn window, schema-constrained JSON: `{intent, helpful_0_2, bridging_bool, skeptic_bool, confusion_0_1, lang}`) — F-V2-4 adds no new call.
- **Worked example:** A posts 12 plain messages (effective ≈ 2·ln13 ≈ 5.1) vs B asks 1 sharp question (3) + 1 bridging (3) + 1 vote (1) = 7 → B outranks A despite 12× fewer messages. Demo this exact slide.
- **Accept:** quiet learner voting reaches ≥60% of top contributor's credits in test script; dominance alert fires privately, never publicly.

### F-V2-5. Solo Circle "Teach Nova" — P0 (light) — T0 + C

- **Goal:** individual mode (spec: "both individual and group").
- **Hats:** Novice (default, probe questions from Concept Pack T0 templates) · Skeptic · Curious · Examiner. C adapts wording only (≤60 tokens, ≤8 calls/session cap enforced by Budget Governor).
- **Same** Auditor, hint ladder, capsule. Ends with `Invite a friend → converts solo session into circle` (deep link with topic+level).
- **Accept:** full solo loop ≤8 C calls, 0 L calls; conversion link preserves passport.

### F-V2-6. Circle Matcher + Workshop Mode — P1 — T0

- **Matcher (deterministic):** input nicknames + passports → circles of 3–5 optimising: complementary levels (mix, never all-same), compatible languages (share ≥1), diverse styles. Greedy algorithm, seeded shuffle, reproducible.
- **Workshop board:** grid of circles with live S-B-U + `needs_human` flag (B<0.45 or U<0.45 or misconception open >3 min). Mentor attention routed, not replaced.
- **Accept:** 30 nicknames → circles in <1 s; board highlights Circle 3 scenario from demo on seeded data.

### F-V2-7. Mentor Seat — P1 — T0 + C

- **Observer join** (no credits, no turns) + **Mentor Note** card (gentle styling) + **Mentor Brief** (1×C, ≤3 lines, on demand or on `needs_human`): *"Circle 3: stuck on sorted-array condition; two learners silent; one misconception flagged."*
- **Accept:** brief ≤60 words; notes logged as events; mentor never auto-answers (human decides).

### F-V2-8. Explanation Relay "Whisper Chain" — P1 (wow game) — C (1 call/game)

- **Flow T0:** A explains → hidden from B → B re-explains → hidden from C → C re-explains → **1×C compare** vs ground-truth claim checklist → **Drift Map** (`kept / lost / distorted / added` per claim, Sankey or highlighted text) → group repairs together.
- **Escalate to L** only if C confidence < threshold (logged). Claims checklist comes from Concept Pack (T0), so the call is bounded classification, not open reasoning.
- **Accept:** seeded run drops "must be sorted" at step 2 and map highlights exactly that; ≤1 C call typical.

### F-V2-9. Context modes — P0 (config only) — T0

Single `context` enum on circle: `class | study | community | workshop | program | solo`. Changes: agenda template, matcher on/off, mentor board on/off, spaced-repetition on/off, bandwidth mode (low = no avatars animation, smaller payloads). No code forks.

### F-V2-10. Gender-blind, bias-aware — P0 — T0 (+eval)

Avatars neutral (animals/stars), nicknames random/self-chosen, **no gender/region fields anywhere** (schema-enforced: migration review checklist). Nova never infers demographics. Bias test set (§2.9) runs in CI; parity reported honestly including gaps.

### Kept v1 features (unchanged behaviour, wired into v2)

| ID | Feature | Tier | Notes for v2 wiring |
|---|---|---|---|
| F-DNA | Learning DNA + bandit | T0+C | 4 micro-items; bandit updates style weights from check success (§2.2) |
| F-PACK | Concept Packs (KB) | T0 | curated synthetic chunks + probes + misconceptions (§2.1) |
| F-HINT | Hint Ladder (3+answer) | C | hard system-prompt no-answer-leak; templates per level (§2.3) |
| F-CONF | Confusion meter | C inside Pulse | 5 signals: rephrase loop, wrong retry, silence, short-reply-after-long, frustration words |
| F-EQ | Equity Ring | T0 | now fed by credits (F-V2-4) |
| F-FEAR | Ask Without Fear + Question Coach | T0+C | anonymous box, me-too, coach rubric rephrase (1×C optional) |
| F-AUD | Auditor (verify peer answers) | C, poll-first | poll if doubtful; L only on low confidence |
| F-BOSS | Co-op Boss Battle (collaborative quiz) | C | team vs personas, from KB, adaptive level |
| F-CAP | Capsule (revision notes) | C draft (+L polish iff quota) | 3 bullets + visual desc + 3Q mini-quiz + next step |
| F-DASH | Teacher Dashboard | T0+C briefs | aggregates only; stuck concepts, talk-share, style mix |
| F-WAIT | Waiting UX (staged honest progress) | T0 | real pipeline stage names; asker-only detail |
| F-CHAOS | Capacity/Chaos Switch | T0 | Green/Orange/Red/Black (§3.8); dev toggle, filmed |
| F-LANG | Multilingual 4 + Arabizi | C | register guides (§2.8); Darija ≤60 words oral |
| F-GAME | Gamification | T0 | XP tied to learning signals (§2.6) |
| F-VOICE | Voice output opt-in | declared ext | browser TTS; no voice stored; declared in report |
| F-A11Y | Accessibility | T0 | dyslexia font/spacing toggle, keyboard nav, low-bandwidth |
| F-ANAL | Analytics | T0 | events taxonomy (§2.11) → S-B-U + progress + telemetry |

---

## 2. DATA PLAN (every asset, schema + seed content)

### 2.1 Concept Packs (KB) — the demo lives here

**Chunk schema (JSON):**
```json
{"chunk_id":"bs-fr-03","topic":"binary_search","lang":"fr","level":"intro","kind":"lesson",
 "title":"Condition : tableau trié","text":"...","claims":["c1","c2"],
 "source":"synthetic-team-written","license":"own"}
```
`kind ∈ {lesson, example, probe, misconception, glossary, visual_desc}`. 60–120 chunks total; **demo topic binary_search ≥ 24 chunks** (6 per language minimum: FR/AR/Darija/EN), second topic fractions ≥ 12, rest ≥ 6.

**Seed chunks (type these verbatim into `kb/seeds/`):**

- `bs-fr-01` lesson: "La recherche dichotomique (binary search) trouve un élément en divisant par deux un **tableau trié**. Complexité O(log n). Sans tri préalable, elle est fausse." claims: [needs-sorted, halving, log-n]
- `bs-fr-02` example: "Chercher 7 dans [1,3,5,7,9] : milieu=5 <7 → garder [7,9] → milieu=7 ✔ en 2 étapes."
- `bs-ar-01` lesson: "البحث الثنائي يقسم **مصفوفة مرتبة** إلى نصفين في كل خطوة. التعقيد O(log n). بدون ترتيب مسبق النتيجة خاطئة."
- `bs-darija-01` lesson (short oral): "الـbinary search كي تلوج على حاجة في ليستة **مرتبة**. تقسم على زوز كل مرة. كان الليستة موش مرتبة، ما تخدمش."
- `bs-en-01` lesson: "Binary search halves a **sorted** array each step to find a target in O(log n). On unsorted input it is wrong, not slow."
- `bs-probe-01/02/03` (T0 quiz source): P1 "La condition pour binary search ? (a) trié (b) non trié (c) peu importe" → a. P2 trace `[2,4,6,8]` find 8 (answer: 3 steps). P3 "unsorted [5,1,4] find 4 — why does it fail?"
- `bs-misc-01/02/03` (seeded errors for Auditor/Whisper tests): M1 "binary search works on any array" (wrong: needs sorted). M2 "complexity O(n)" (wrong: log n). M3 "mid = (low+high) always safe" (distortion: overflow nuance — flagged as nuance, not error).
- `bs-gloss`: sorted/مرتبة, milieu/الوسط, complexité/التعقيد, indice/الخانة.
- `frac-*` (second topic, 12 chunks): identify/compare/word-problem tiers + 1 Darija oral + 2 probes + 1 misconception ("bigger denominator = bigger fraction").
- Sources manifest `kb/SOURCES.md`: every chunk `synthetic-team-written` or `public-domain`; **no textbook excerpts, no copyrighted text**.

**Retrieval wiring:** chunk text embedded locally (TF-IDF baseline always; optional local embeddings if declared, no external service by default) + keyword fallback. Hybrid score: `0.7*vector + 0.3*bm25-ish keyword`, top-k=5, language-boost `+0.15` for session lang. Every grounded answer cites `chunk_ids`.

### 2.2 Learning DNA bank + Passport + bandit

**Items (4, ≤3 min total):** L1 level probe (topic MCQ, 3 tiers) · S1 style A/B ("which helped more: picture-desc vs daily-life analogy vs numbered steps") · G1 language pick (AR/Darija/FR/EN + autodetect confirm) · C1 confidence ("sure/unsure/lost" → hint eagerness + quiet-invite flag).
**Passport schema:** `{learner_id, level: A1..C1-ish per topic, style_weights:{visual,analogy,steps,example,repetition,practice}, lang, hint_eagerness, invite_me: bool, updated_at}`.
**Bandit (T0):** after each check-question, `w_style += 0.1*(success - baseline)` renormalised; adaptation picks top style; report shows one learner's weight shift as personalisation evidence.

### 2.3 Hint Ladder templates (per level, no answer leak)

L1 nudge (question only): *"شنو الشرط اللي لازم قبل ما نقسمو؟ شوف الـcarte bs-fr-01."* · L2 focus: *"الليستة [5,1,4] مرتبة؟ جرّب خطوة وحدة."* · L3 worked micro-example (numbers shown, target analogous but not identical) · L4 answer + why + cite chunks. System prompt hard rule: *"never output L4 content before ladder_state≥3 or asker pressed skip"* — enforced by T0 gate, not trust.

### 2.4 Quiz banks (Boss Battle + capsule mini-quiz)

Schema `{qid, topic, level, lang, stem, choices[4], answer, explain_chunk}`. Seed 12 binary_search (3/level × 4 langs rotated) + 9 fractions. Generation (1×C) only fills gaps from chunks; bank covers offline mode.

### 2.5 Capsule template

`{bullets[3] (≤15 words each), visual_desc (≤40 words, alt-text ready), mini_quiz[3 qids], next_step (one action + one link chunk), xp_earned}`. Darija capsules: bullets ≤12 words, oral.

### 2.6 Gamification (T0, learning-tied only)

XP: sharp_question +20 · good_explanation +20 · bridging +25 · kind_skeptic +20 · capsule_complete +15 · whisper_repair +25 · vote/me-too +3 (cap 15/day) · streak +10/day (cap 5). Badges: `First Light` (first contribution) · `Bridge Builder` (3 bridging) · `Kind Skeptic` · `Chain Healer` (whisper repair) · `Polyglot` (2 langs one session). **No public leaderboard** (private-first; circle shows S-B-U, not ranks).

### 2.7 Personas (neutral, stereotype-free)

`NOVA_NOVICE` (curious, asks probe-derived questions) · `NOVA_SKEPTIC` ("what if unsorted?") · `NOVA_EXAMINER` (checks). Peer-sim personas for Solo: `🦊 RAYEN (level low, asks naive)` · `🦉 NOUR (level mid, sometimes slightly wrong → learner corrects)`. Note: names unisex/neutral, behaviours assigned randomly per session, documented in report (answers §12-reminder on stereotypes).

### 2.8 Language assets

- **Register guides** (`prompts/registers/{ar,darija,fr,en}.md`): Darija = ≤60 words, oral, FR technical terms kept (`la complexité`, `le tableau`), code-switch mirrored not corrected.
- **Arabizi map** (T0 normaliser): `ch→ش, gh→غ, 7→ح, 3→ع, 5→خ, dh→ذ, th→ث, ou→و, y→ي` + cue list (`3lech, kifeh, bech, chnia, برشا`) → Darija detect.
- **Bias test set** (`eval/lang_parity.jsonl`, ≥24 rows): same binary_search question × {AR, Darija, Arabizi, FR, EN} × 3 nicknames → assert tone/helpfulness parity (human-rated 1–5 + automated length/toxicity guard).

### 2.9 Eval & seeded-error fixtures

`eval/confusion_set.jsonl` (20 turns: 10 confused / 10 not, labelled) · `eval/seeded_errors.jsonl` (3 wrong claims/session script) · `eval/whisper_groundtruth.json` (claim checklists per topic) · user-test fixtures: 5 synthetic learners (levels/styles/langs spread incl. 1 quiet + 1 dominant), 1 teacher, 1 mentor, 30-nickname matcher list.

### 2.10 S-B-U + credits config (with worked numbers)

`config/equity.yaml` (weights §1 F-V2-4 + log cap k=2) and `config/sbu.yaml` (S/U weights §1). Telemetry test asserts the §1 worked example (12 plain vs 1Q+1bridge+1vote → B wins 7 vs 5.1).

### 2.11 Analytics events taxonomy (all T0 emits)

`session_start/end, dna_done, question_open/peer_answer/nova_verify/hint_L1..L4/skip, poll_open/vote/close, confusion_flag, correction, quiz_answer, capsule_done, whisper_run/drift_found, mentor_note/brief, cache_hit, quota_event, fallback_state, lang_switch`. Every event: `{ts, session_id, circle_id, actor(L-##/NOVA/mentor), payload}` — feeds S-B-U, dashboard, report metrics, business unit-economics.

### 2.12 Offline pack manifest

`offline/pack.json`: 30 snippets `{id, topic, lang, kind: explanation|hint_L1|example, text, chunk_refs}` covering binary_search (12) + fractions (8) + 10 generic (confusion comfort, next-step, poll prompts). Served in Red/Black with `offline:true` label.

---

## 3. BACKEND BLUEPRINT

### 3.1 Architecture + repo layout

```
browser PWA ──REST/Poll──▶ FastAPI api/ ─┬─ router/ (gate+escalation+governor)
                                          ├─ retrieval/ (hybrid search, cites)
                                          ├─ pipeline/ (cfas, hints, auditor, whisper, capsule, quiz, matcher, sbu, credits, pulse)
                                          ├─ store/ (sqlite + cache + queue + ledger)
                                          └─ llm/ provider adapter (compact.complete / larger.complete / available)
halaka/
  api/ routes/ models/  router/  retrieval/  pipeline/  store/  llm/
  prompts/ (router, tutor, hints, auditor, personas, brief, registers/)
  kb/seeds/ + SOURCES.md  config/equity.yaml config/sbu.yaml config/budget.yaml
  offline/pack.json  eval/  tests/  web/  Dockerfile  .env.example  README.md
```

### 3.2 Provider Adapter (the build-day insurance — one file swap)

```python
class ProviderAdapter:  # llm/adapter.py — ONLY file that knows model names/keys
    def compact(self, prompt: str, *, max_tokens: int, schema: dict|None) -> LLMResult: ...
    def larger(self, prompt: str, *, max_tokens: int) -> LLMResult: ...
    def available(self, tier: str) -> bool: ...   # quota/health probe
# LLMResult = {text, tokens_in, tokens_out, latency_ms, cached: False}
```
Rules: keys from env only; no key in repo/logs; every call logged to `llm_calls{step,tier,tokens,latency,cache,fallback}`; `available()` failure → degradation machine (§3.8). Budget Governor caps per session: **≤20 C, ≤5 L, Solo ≤8 C, capsule-polish L only if ledger allows**.

### 3.3 Router: Stage-0 gate + escalation (documented, deliberate)

Per turn: `intent(6-way) · lang/register · safety/PII · difficulty+synthesis gate` — all C, schema-constrained, batched into **1 call (Group Pulse)** where possible. Escalation to L iff: multi-source synthesis needed (≥3 chunks + conflict) OR final polished prose flagged by gate OR C confidence low OR Whisper/Auditor explicitly escalates. Route table (10 steps: 0a–10 with why+fallback) lives in report verbatim — source: v1 §5 / Analysis §3. **Targets declared:** L-share <25% calls; skeleton <1.5 s; C-complete <4 s; L-complete <12 s; cache hit rate reported.

### 3.4 Core flows (sequence)

**Ask flow (CF-AS):** `POST /questions → 45–60 s window (peers answer/vote) → [parallel: retrieval→cache→C Quick Take hidden, L queued iff escalation] → window end/skip → Auditor-verify (poll if doubtful) | hint L1 | direct answer → staged asker-only progress → RESOLVED + events + credits + S-B-U recompute.`
**Solo flow:** same minus window (default skip) with persona turns interleaved (C ≤60 tok).
**Whisper flow:** collect chain T0 → 1×C compare vs claim checklist → drift map → repair round → credits.
**Capsule flow:** transcript+chunks → C draft → L polish iff governor allows → stored + dashboard event.

### 3.5 API contract (v1 surface — JSON)

- `POST /dna {nickname, context, answers[4]} → {passport}` · `POST /circles {topic, context, lang, nicknames[]} → {circle_id, matcher_result?}` · `POST /circles/{id}/join {nickname} → {learner_id L-##}`
- `POST /questions {circle_id, text, anonymous} → {qid, state: OPEN, window_s}` · `POST /questions/{qid}/peer-answer {text} → {aid}` · `POST /questions/{qid}/skip → {answer, tier_used, cached, cites[]}`
- `POST /questions/{qid}/hint {level} → {hint}` · `POST /polls {qid|claim} → {pid}` · `POST /polls/{pid}/vote {choice}`
- `POST /whisper {circle_id, topic} → {chain_id, drift_map{kept,lost,distorted,added}}` · `POST /quiz/battle {circle_id} → {items[3]}` · `POST /capsule {session_id} → {capsule}`
- `GET /circles/{id}/health → {S,B,U, credits[], needs_human}` · `GET /board?workshop → {circles[{id,S,B,U,needs_human}]}` · `POST /mentor/notes · GET /mentor/brief?circle → {brief≤60w}`
- `GET /metrics → {calls_by_tier, l_share, p50/p95, cache_hit, peer_first_rate, fallback_counts}` · `POST /chaos {mode: green|orange|red|black}` (dev-only, auth-gated, excluded from prod build)
- Error shape always `{error, code, retryable, user_msg[lang]}` — never silent, never a stack trace to learners.

### 3.6 DB schema (SQLite, DDL sketch)

```sql
learners(id TEXT PK, nickname, avatar, context, created_at);  -- NO name/photo/gender/region cols (enforced)
passports(learner_id PK, level, style_weights JSON, lang, hint_eagerness, invite_me, updated_at);
circles(id PK, topic, context, lang, state, window_s, created_at);
memberships(circle_id, learner_id, role);  sessions(id PK, circle_id, agenda JSON, s,b,u REAL);
questions(id PK, session_id, asker_id, text, lang, anonymous INT, state, created_at);
peer_answers(id PK, qid, author_id, text, created_at);  polls(id PK, qid, claim, state, result JSON);
hints(qid, level, text);  events(id INTEGER PK, ts, session_id, circle_id, actor, type, payload JSON);
llm_calls(id INTEGER PK, ts, step, tier, tokens_in, tokens_out, latency_ms, cache_hit, fallback_used);
cache(key PK, value, cites JSON, created_at);  quota_ledger(session_id PK, c_used, l_used);
artifacts(id PK, session_id, kind, body JSON);  mentor_notes(id PK, circle_id, text, created_at);
CREATE INDEX idx_events_session ON events(session_id); CREATE INDEX idx_calls_step ON llm_calls(step);
```

### 3.7 Cache / quota / queue

- **Semantic cache key:** `sha1(normalise(intent)+level+lang+sorted(chunk_ids)+ladder_state)`; exact-equivalent re-asks served without model (brief requirement implemented literally). TTL session + cross-session for probes/glossary.
- **Quota ledger** per team/session; governor blocks L when exhausted → auto fallback + meter + banner (no silent fail).
- **Queue:** in-process FIFO for L requests with position + ETA in UI; retry once as guided, then C fallback; full outage → offline pack.

### 3.8 Degradation state machine (filmed)

`GREEN normal → ORANGE (L slow/unavailable: queue+retry, C continues) → RED (quota out: C-only + simplified labels) → BLACK (service down: offline pack + polls/roles/flashcards, sync later)`. Every transition = banner + event + metrics count. Dev toggle forces each state for rehearsal/video. Venushot line: *"When the AI sleeps, the circle still works."*

### 3.9 Retrieval detail

Ingest: `kb/seeds/*.json → chunk → TF-IDF index (built at startup, <1 s) + optional local embeddings (declared, default off)`. Query: rewrite (T0 templates, 3 variants) → hybrid `0.7·vec + 0.3·keyword + 0.15·lang_boost` → top-5 + claim checklists attached. Citation required in every grounded answer (`cites[]` rendered as chips).

### 3.10 Latency UX protocol

Skeleton-first: T0 agenda/skeleton renders instantly (<200 ms) → C fills sections → L deep-dives slide in later with `✨ deeper answer ready`. Polling `/questions/{qid}/state` every 1.5 s (no WS dependency for venue Wi-Fi); stagedstep names are real pipeline stages. No fake streaming; no text retraction.

### 3.11 Config, security, deploy

`.env.example` (no values): `PROVIDER_BASE_URL, COMPACT_MODEL, LARGER_MODEL, TEAM_KEY_NAME (key itself never committed), QUOTA_C, QUOTA_L, WINDOW_S, CHAOS_ENABLED=false`. PII screen regexes (phones, emails, addresses, faces/voice: rejected at input with explanation) before any model call; logs scrubbed (`scrub.py`) before screenshots/video. **Dockerfile:** single container `uvicorn api:app` + SQLite volume + `kb/` + `offline/`; runs on laptop hotspot; no build-time secrets. External services (hosting, optional browser TTS) declared in report+README.

### 3.12 Tests (CI = `pytest` + eval scripts)

Unit: S-B-U math, credits log-cap, matcher determinism, cache normaliser, PII scrub, Arabizi map. Integration: full ask flow mocked-LLM (3 scripts: peers-answer / nobody-answers / skip). Evals: confusion set (report precision), seeded errors (caught rate), whisper groundtruth, lang parity (human 1–5). Chaos: force orange/red/black, assert UI states + queued sync. Gate: `grep -r` for key patterns + schema lint (no gender/region/photo cols) fails build.

---

## 4. BUILD ORDER, OWNERSHIP, TRACEABILITY

### 4.1 Who builds what (3 people)

- **P1 AI/Backend:** adapter, router+governor, retrieval, pulse/auditor/hints, metrics, chaos, tests.
- **P2 Frontend/UX:** PWA shell, circle/question/poll/whisper/capsule/dashboard/board screens, S-B-U rings, meter+banners, skeleton-first, a11y, offline.
- **P3 Data/Eval/Biz:** all §2 seeds, registers, evals, user tests (2 contexts + solo + mentor), report+video+README, LOI/interviews.
- Milestones: W1 vertical slice (DNA→explain→capsule, C-only, KB bs+fractions) · W2 router+L+cache+ledger+hints+confusion+metrics · W3 circles+personas+credits+quiz+dashboard+Darija pass · W4 degradation+offline+tests+numbers frozen · W5 report/video/pitch. **Freeze rule:** unfinished 3 Nov → roadmap slide.

### 4.2 Traceability (report § + demo moment per feature)

CF-AS→report§2→video 0:20–0:40 · Explain-card→§2→0:08–0:20 · S-B-U→§2/§5→0:20–0:40+board · Credits→§2→silence-lights-up · TeachNova→§2→solo card · Matcher/Workshop→§2→1:10–1:22 · MentorSeat→§2/§6→1:10–1:22 · Whisper→§2→wow#3 · Router/governor/cache→§4→0:52–1:10+metrics · Degradation→§5→0:52–1:10 (dry, legible) · RAG→§3→cited chips · Langs→§5/B2→0:40–0:52 Arabizi-in-Darija-out · Capsule/gamif/dashboard/quizzes/analytics→§2→1:10–1:22 · Business+IEEE→§6→1:22–1:30+LOI · Ethics→§6→Q&A answers.

### 4.3 Definition of done (Phase 1)

Clean-checkout run via README <10 steps · route table + metrics screenshot current · seeded demo (quiet+dom+wrong+Arabizi+chaos) rehearsed · report ≤6 pp PDF · video ≤90 s, no secrets · eval numbers in report = `/metrics` output · LOI filed · keys rotated before public repo.
