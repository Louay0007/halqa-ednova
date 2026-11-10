# HALQA — Phase 1 Demo Video Script

**File:** `demo/halqa-demo.webm` · 1280×720 · **69 s** (limit: 90 s)
**Flow:** real app, real backend, real model answers (tier C with knowledge-base citations).

## Shot list & narration

| # | Time | Screen | What happens | Narration (subtitled) |
|---|------|--------|--------------|------------------------|
| 1 | 0–8 s | Landing | App opens; the two promise lines | "HALQA — a peer-first learning companion, in Darija." / "Learners answer each other first — Nova fills the gaps." |
| 2 | 8–20 s | `/enter` → `/dna` | Rim-07 signs in, picks *study* context, taps the 4 DNA steps (level · style · language · confidence) | "A 1-minute passport: context and how you learn." / "DNA check — level, style, language, confidence." / "Nova now adapts to Rim — not the reverse." |
| 3 | 20–27 s | `/circles/new` | Topic *binary search*, Darija, host nickname → circle created with a 6-letter join code | "Rim opens a circle on binary search — in Darija." / "A join code classmates can open from any phone." |
| 4 | 27–32 s | Lobby | Peer-Yassine joins from the code (Members 1 → 2) | "Yassine joins from the code — two learners, one circle." |
| 5 | 32–41 s | Live session | Host asks *"علاش الـ binary search تخدم كان على ليستة مرتبة؟"* — a 45-s peer window opens | "Live — a 45-second window for peers first." / "Rim asks: 'Why does binary search need a sorted list?'" |
| 6 | 41–44 s | Peer window | Yassine answers first; his credit bar fills (+3) | "Yassine answers first — peer knowledge counts." |
| 7 | 44–47 s | `Passer l'attente` | Window closed → Nova's staged preparation | "Window over → Nova prepares a cited answer, staged." |
| 8 | 47–56 s | RESOLVED | Nova answers **in Darija**, `tier C`, with 5 KB citations (bs-darija-05 …); budget C 2/20 | "In Darija, tier-C, with knowledge-base citations." |
| 9 | 56–63 s | `/lab` | Live meters + chaos console: green → orange → red → black | "The Lab: live meters + a chaos console for resilience." / "Graceful degradation, never blank." |
| 10 | 63–69 s | Debrief | S-B-U health rings, shared credits, next step + citations, +15 XP | "The debrief: S-B-U health, shared credits — equity by design." / "HALQA — built for learners. Merci." |

## Why this flow matches the spec

- **Peers-first pedagogy (item 2):** the question opens a peer window; a peer answer earns credits *before* Nova is ever called.
- **Tiered AI (item 4):** the RESOLVED card shows the real tier (`tier C`) and the cited KB chunks — no hallucinated sources.
- **Degradation (spec 6.4):** the Lab chaos console walks the four degradation modes on camera.
- **Equity & governance (item 5):** S-B-U rings, shared credit bar, and budget counters are visible on every screen.

## Repro

Recorded headlessly with Playwright (cursor overlay + subtitles injected):

```bash
node record.cjs   # host context records video; peer context runs off-camera
```

Environment: `halqa-api` (:3000) with a live OpenAI-compatible provider
(`COMPACT_MODEL`/`LARGER_MODEL` in `halqa-api/.env`), `halqa-web` (:5173),
seeded KB (`npm run seed:demo`).
