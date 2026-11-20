# HALQA — Final Phase Pitch (EdNova · IEEE WIE ACT 5.0)

**Script:** `PITCH-SCRIPT.md` — the 5:00 two-speaker speaking script (measured timings, staging,
scenarios, Q&A ownership). Rehearse from that; this file is the strategy behind it.
**Deck:** `presentation/index.html` · **PDF:** `HALQA-final-pitch.pdf` (17 pp)
**Keys:** `→/space` next · `←` prev · `N` notes · `T` reset timer · `F` fullscreen · `P` print · `#6` deep link

---

## 1. Official format

From the specification (§E), not assumed:

| Item | Official limit | Our plan |
|---|---|---|
| Presentation | **4:00 max** | 5:00 master timeline (see cut list) |
| Demo video | **1:30 max** | played **separately** — not inside this deck |
| Q&A | **2:00** | 9 prepared answers in §6 |
| Presenters | **exactly 2 members** | A = problem/solution/business · B = technology |

> **The 5:00 problem.** You asked for a 5-minute deck; the grid says 4:00 + 1:30 video.
> The deck is built as 17 slides with a 5:00 master timeline, and §5 gives the exact slides
> to drop to reach 4:00. Decide which version you're pitching before you rehearse.

---

## 2. Structure: five parts, each with a divider

You asked for problem → solution → tech → business → needs, with detail. That is exactly the
running order, and each part opens with a numbered divider slide so the jury always knows where
they are in the argument.

| Part | Slides | Time | What it proves |
|---|---|---|---|
| — | 1 Title | 0:00 | — |
| **01 Problem** | 2 divider · 3 four failure modes · 4 why today's tools fail | 0:03–1:00 | *Relevance* |
| **02 Solution** | 5 divider · 6 CF-AS · 7 one real turn · 8 six roles | 1:10–2:35 | *Innovation* |
| **03 Technology** | 9 divider · 10 architecture · 11 model routing · 12 degradation | 2:40–4:00 | *Technical Feasibility* |
| **04 Business** | 13 divider · 14 users/buyer · 15 revenue/moat | 4:00–4:45 | *Entrepreneurship* |
| **05 Needs** | 16 the ask + pilot plan | 4:45–5:00 | *Pitch & Demo* |
| — | 17 Close | 5:00 | — |

**Reserve slides** (appendix only, excluded from the main PDF): 18 engineering proof, 19 fairness maths.

### Why this beats the earlier version

The previous deck led with a mechanic ("Circle First, AI Second") before establishing the problem.
That reads as clever to engineers and as unexplained to a mixed jury. This version earns the
mechanic: slide 3 establishes four concrete failures, slide 4 explains why existing tools
*don't* fix them, and only then does slide 6 present the rule that does. Slide 4 is the slide
that most pitches skip, and it's the one that makes the solution feel inevitable rather than novel.

---

## 3. Detail per part

### 01 · Problem (slides 2–4)

Four failure modes — dominance, unasked questions, spreading errors, one-size-fits-all explanation —
each stated as a *mechanism*, not a complaint.

Slide 4 is the argumentative core: **AI tutors answer too fast** (helpfulness and learning are
different objectives), **collaboration tools don't teach** (they manage logistics, not comprehension),
**analytics arrive too late** (a post-mortem is not a teaching aid). This is what positions HALQA as
a missing layer rather than another chatbot.

### 02 · Solution (slides 5–8)

- **6 · CF-AS** — the OPEN → NOVA THINKING → RESOLVED state machine, with the three payoffs.
- **7 · One real turn** — the Darija question, two peer answers, the Auditor catching the seeded
  misconception, the cited resolution. This is the slide that makes the product concrete without video.
- **8 · Six roles** — mediator, tutor, teammate, facilitator, personal tutor, archivist. Breadth
  without turning into a feature list, because each role maps to a named rubric concern.

### 03 · Technology (slides 9–12)

- **10 · Architecture** — five labelled layers (client / API / pure domain / AI platform / data) with
  the stack named in each. Three engineering claims underneath: polling not sockets, bounded spend,
  verified not claimed.
- **11 · Model routing** — the C/L split with the **13.3 %** measured number. This is the single
  number the rubric asks for.
- **12 · Degradation** — GREEN/ORANGE/RED/BLACK, plus privacy-by-schema.

### 04 · Business (slides 13–15)

- **14 · Users vs buyer** — the learner never pays; the department buys the facilitator board.
  Why now: institutions must adopt GenAI, and lack a way to do it that doesn't replace teaching.
- **15 · Revenue, cost, moat** — a real table, plus four defensible moats, plus an **explicit honesty
  note** that these are modelled from the call budget, not from paying customers. Juries reward
  that line; inflated traction numbers get punished in Q&A.

### 05 · Needs (slide 16)

Four specific asks plus a five-week pilot shape. The first is marked *The ask* because a pitch
needs one thing the jury remembers you wanting.

---

## 4. Verbatim script (5:00 master)

**A — 0:00 Title**
> "Every one of us has been in a study group that felt productive and taught us nothing. HALQA — Arabic for *circle* — is a GenAI companion built on one rule: **the circle teaches first, and the AI speaks second.** Five parts: the problem, the solution, the technology, the business, and what we need."

**A — 0:03 Problem**
> "Peer learning is the highest-yield method we have and the least instrumented. Four failures, every time. One voice dominates and airtime gets mistaken for understanding. The simplest question never gets asked, because asking it costs status. A confident wrong answer spreads before anyone checks. And one explanation style is imposed on six people who each need a different one.
>
> The tools we have made this worse. AI tutors answer too fast — the learner gets a correct answer in seconds and the thinking stops; helpfulness and learning are not the same objective. Collaboration tools manage logistics, not comprehension. And analytics arrive a week later, when the facilitator can no longer act.
>
> So the missing piece isn't information. It's **sequenced, scarce peer attention** — and nobody has instrumented it."

**A — 1:10 Solution**
> "Our rule: a question belongs to your peers for forty-five seconds. While they answer, Nova prepares a cited answer invisibly and releases it only when the window closes. Human knowledge is spent first. The forty-five-second countdown *becomes* the loading state, so latency is the lesson rather than an error. And peer answers are verified before a mistake spreads.
>
> Concretely: someone asks in Darija, anonymously, why binary search fails on an unsorted list. Two people answer — one right, one repeating the exact misconception we seeded. A third learner taps *me too*, which is the quietest person in the circle making themselves visible without speaking. When the window closes, the Auditor checks both answers against the concept checklist and opens a poll rather than correcting anyone in public. The right peer gets the credit, the answer lands in Darija with two cited sources, and a revision capsule is queued.
>
> That's the whole product in one turn: **the AI's job was to check the circle, not to replace it.**"

**B — 2:40 Technology**
> "The stack is a React PWA over a NestJS and MongoDB API, in thirty-two modules. The important decision isn't the framework — it's the boundary. All the maths that decides fairness and health is pure TypeScript with zero framework imports, so it's testable without a database. Above it sits one AI platform layer, and a single adapter file is the only code that knows which model we use.
>
> That split lets us be strict about cost. The compact model does everything it can do correctly: one batched call per turn carries intent, language, safety screening and difficulty together, so credits and confusion detection cost zero extra calls. The larger model has to earn its call — synthesis with conflict, polished prose, or an explicit escalation. Five calls per session, and every one reserves quota atomically first; a test fails the build if any path skips it.
>
> Measured on a live run across forty-one endpoint checks: **thirteen point three percent of calls were larger-model calls**, against a target of under twenty-five.
>
> And when capacity runs out, it degrades rather than going blank — green, orange, red, black, down to a thirty-snippet offline pack where polls and quizzes keep working. Privacy is enforced the same way: a build-blocking test rejects any schema field for name, photo, gender or region."

**A — 4:00 Business**
> "The learner never pays. The buyer is the department or training center, and what they buy is the facilitator board — health rings, needs-human routing, and cohort evidence they can put in a report.
>
> Revenue is an institutional licence per active circle per semester; entry is a free pilot. There's no GPU, model spend is bounded at twenty-five calls per session, and caching pushes repeat cost toward zero. I'll be honest: those figures are modelled from our call budget, not from paying customers — the pilot is what turns them into measured numbers.
>
> Four things are hard to copy: the protocol is enforced in the state machine rather than a prompt; the equity maths is measured, not asserted; Darija and Arabizi are normalised deterministically before any model sees them; and every pilot produces evidence a generic chatbot cannot."

**A — 4:45 Needs + close**
> "So, specifically: two pilot circles — one instructor, thirty learners, one revision cycle. A facilitator who'll use the board weekly and tell us where it's wrong. Model credits, which we can bound in advance. And introductions to student branches for a second cohort.
>
> The best explanation in the room is usually not the AI's. HALQA is the first companion that makes the AI **wait** for the room — and then measures whether the room learned. Thank you."

---

## 5. Cutting 5:00 → 4:00

Drop these, in this order, and keep the argument intact:

1. **Slide 8 (six roles)** — 0:30. Breadth is already implied; keep it as reserve.
2. **Slide 4 → compress to one sentence** — 0:20. Merge "AI tutors answer too fast" into the divider.
3. **Slide 12 → one sentence** — 0:15. "It degrades through four states down to an offline pack."

Result: 4:00 with problem, solution, tech, business and needs all intact.
**Never** cut slide 7 (one real turn) or slide 11 (the 13.3 % number) — those are what gets scored.

---

## 6. Q&A defence (2:00)

Answer in two sentences, then stop.

| Question | Answer |
|---|---|
| Is this just a chatbot with extra steps? | "No — the AI is structurally prevented from answering first; the window is a state in the machine, not a prompt instruction. Remove the AI entirely and the session still runs." |
| How do you know peer answers are correct? | "We don't assume it — that's the Auditor. It checks claims against a concept checklist and opens a poll when doubtful. Seeded-error fixtures replay this in CI." |
| Why not use the large model for everything? | "The brief penalises it and the maths does too: slower, scarcer, five times the budget for work the compact model does correctly. We measure the split and publish it." |
| What if the API is down? | "Black mode: thirty-snippet offline pack, polls and quizzes keep working. The learner sees an offline label, never a blank screen." |
| Do you have real users? | "Not yet — that's precisely the ask. We have five synthetic learner fixtures and a thirty-nickname roster; the next step is two real circles. We'd rather say that than invent a number." |
| Isn't Darija hard for models? | "It is, so it's treated as an oral register of sixty words or fewer, French technical terms are preserved, and Arabizi is normalised deterministically before any call. Mirror the learner, don't correct them." |
| Privacy? | "A schema gate, not a policy. A test fails the build if a name, photo, gender or region field appears. PII is screened before any model call and logs are scrubbed." |
| Who actually pays? | "The institution, not the student. The facilitator board is the product; the learner app is how it spreads. Each new course is a JSON pack, so marginal cost is near zero." |
| What did you cut? | "Voice interaction and the open-web knowledge base. Both were planned; both would have eaten the latency budget the peer window needs." |

**Rehearse until automatic:** *"The circle teaches first. The AI speaks second."*

---

## 7. Pre-stage checklist

- [ ] Decide 4:00 or 5:00, and cut per §5 if 4:00
- [ ] Confirm the two presenters are the two registered members (spec requirement)
- [ ] `index.html` in Chrome, `F` fullscreen, `N` notes tested on the **presenting** laptop
- [ ] Video on desktop **and** USB — it plays outside this deck, so it needs its own player
- [ ] API + Mongo running: `curl :3000/api/v1/healthz`; `npm run seed:demo` for clean data
- [ ] Wi-Fi **off** test: deck opens, app shows the offline banner
- [ ] Three full run-throughs, out loud, standing, with the timer
- [ ] Replace `[Speaker A]`, `[Speaker B]`, `[your-repo]`, `[N]`
- [ ] Export PDF for the submission portal (`P`, or use the two built PDFs)

---

## 8. Rebuilt deck — 5:00 two-speaker run sheet

Rebuilt after feedback: text simplified for a mixed jury, business section restructured
around **one named customer**, and the missing **Impact** criterion added.

### Why the business section changed

The official grid scores **Impact** and **Entrepreneurship & Business Viability** separately,
with bonus points for **Real User Testing** and **Multilingual Support**. The old deck spent
that slot on "What we need" — an investor ask a jury cannot grant — and left Impact empty.
The last three slides were therefore re-pointed: one customer, then cost/moat, then Impact.

> **Superseded.** The authoritative run sheet is now `PITCH-SCRIPT.md`, whose timing was
> measured from the spoken text (749 words, 4:59 at 150 wpm). The table below was estimated
> per slide and drifts by up to 40 seconds by the close. Use the script for rehearsal; this
> table is kept only to show the original slide budget.

### Timing (estimates — use `PITCH-SCRIPT.md` instead)

| # | Time | Slide | Who | Seconds |
|---|---|---|---|---|
| 1 | 0:00 | Title | A | 12 |
| 2 | 0:12 | 01 · The problem (divider) | A | 6 |
| 3 | 0:18 | 01 · Four ways group study fails | A | 32 |
| 4 | 0:50 | 01 · Tools make it worse | A | 26 |
| 5 | 1:16 | 02 · The solution (divider) | A | 6 |
| 6 | 1:22 | 02 · Circle first, AI second | A | 30 |
| 7 | 1:52 | 02 · One real turn | A | 38 |
| 8 | 2:30 | 02 · Four helpers | A → **hand to B** | 16 |
| 9 | 2:46 | 03 · Technology (divider) | B | 6 |
| 10 | 2:52 | 03 · Architecture and stack | B | 26 |
| 11 | 3:18 | 03 · Two kinds of AI call | B | 20 |
| 12 | 3:38 | 03 · Slows down, never blank | B | 16 |
| 13 | 3:54 | 04 · The business (divider) | B | 6 |
| 14 | 4:00 | 04 · One customer we can name | B | 20 |
| 15 | 4:20 | 04 · Cheap to run, hard to copy | B | 15 |
| 16 | 4:35 | 05 · Impact | B | 13 |
| 17 | 4:48 | Close | **A + B** | 12 |

**Speaker A:** slides 1–8 (0:00 → 2:46), then the close.
**Speaker B:** slides 9–16 (2:46 → 4:48), then the close.

The handover at slide 8 is deliberate — A finishes on "that is the product", B opens on
"technology, quickly". Rehearse that seam more than any other.

### To reach the official 4:00

Drop **slide 8** (four helpers — it is a surface-area recap) and **slide 12** (behaviour
under load — say one sentence instead: "it slows down, it never goes blank"). That recovers
56 seconds. Cut the divider slides 13 and 5 for another 12 seconds if needed.

### Numbers now used in the deck (all verified against the repo)

| Claim | Value | Where checked |
|---|---|---|
| Server modules | 25 | `ls -d halqa-api/src/modules/*/` |
| Collections | 15 | `@Schema({collection:...})` declarations |
| Screens | 14 | `halqa-web/src/routes/*.tsx` |
| Unit tests | 99 | `npm run test:unit` |
| Integration tests | 48 | `npm run test:int` |
| KB chunks | 39 | `kb/seeds/*.json` |
| Offline snippets | 30 | `halqa-api/offline/pack.json` |

The old deck said 83 unit / 46 endpoint checks on two slides and 41/41 on another. Those are
gone; if you cite a test number, use 99 and 48.
