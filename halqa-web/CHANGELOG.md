# HALQA — Frontend change log, corrected

**Range:** `1ec1875..2cdc565` — 7 commits · **28 files** · **+3,884 / −692**
(An earlier draft quoted the range as `7ba0ef0..HEAD`. That range contains **8**
commits — it also includes `1ec1875` "completed auth on /enter", +648/−85 — so
it never matched the 7-commit table. `7ba0ef0..HEAD` is +4,512/−757; both
numbers are true, for different bases. The per-commit list below is complete as
written; only the base line was wrong.)

---

## Per commit

| Commit | Scope | Files | ± |
|---|---|---|---|
| `33e8198` | Spec §0–§3 — design tokens + shell systems | spec, tokens, motion, reduced-motion hook, Shell, SetupHint, PassportSheet, shell.css, i18n | +1,422 / −18 |
| `4da826b` | P1 — session room rebuild (§4 R7) | Session.tsx, pages.css, api, i18n, backend `StateView.text` | +537 / −139 |
| `884bfc4` | P2 — DNA live passport + Solo (§4 R2/R3) | Dna, Solo, i18n, motion, pages.css | +255 / −91 |
| `debe5f4` | P3+P4 — create/join/lobby + debrief (§4 R4–R6, R8) | CirclesNew, CirclesJoin, Lobby, Debrief, i18n, pages.css | +574 / −269 |
| `440873e` | P5 — pro screens + lab (§4 R9–R12) | Board, Mentor, Dashboard, Lab, i18n, pages.css | +414 / −153 |
| `e2b0e92` | P6 — i18n parity, RTL, touch targets (§8 DoD) | Enter, Me, Session, i18n, css | +79 / −24 |
| `2cdc565` | Night field shell + UI fix pass | night.css, Shell, tokens, ui.tsx, App | +616 / −11 |

---

## Verified claims

- **i18n parity:** 220 keys × 4 languages (`en`, `fr`, `ar`, `darija`) — **0 missing**.
  (`t()` gained a *third* parameter, `vars`, for `{n}` interpolation; the signature
  is backwards compatible.)
- **Pollers (R7):** questions 4 s · state 1.5 s (ETag/304) · health+credits+agenda
  5 s · all gated on `document.hidden`.
- **PWA:** precache **36 entries** (workbox's own count; 31 distinct URLs — the
  manifest and the four icons are listed twice) — app shell, every route chunk,
  both brand SVGs, the night-field backdrop and the single bundled stylesheet
  (`night.css` and `night.fixes.css` are separate sources, one emitted file).
- **Gates:** `tsc -b` clean · oxlint **0 errors, 0 warnings** (36 files) ·
  `vite build` green · secrets scan clean · Jest **99/99 unit**, **48/48 integration**.
- **Backend:** `GET /questions/:id/state` now returns a truncated `text` so peers
  can see what is being asked.

## Corrected claims

1. **"12 app routes audited"** — `App.tsx` registers **14** routes plus a `*`
   fallback. The audit covered the 12 routes rendered inside the app shell (8 of
   them behind `RequireAuth`; `/board`, `/mentor`, `/dashboard` and `/lab` are
   intentionally public); `/` and `/enter` carry their
   own full-bleed chrome and were reviewed separately. Stated here so the numbers
   reconcile.
2. **"night.css, 581 lines, glass over navy-deep"** — the file was a theme *and*
   a defect-fix pass, and it contained unscoped rules that deliberately reached
   `/enter`. Now split:
   - `styles/night.css` (366 lines) — the dark re-skin only, all scoped to `.shell.is-app`.
   - `styles/night.fixes.css` (220 lines) — the corrections, each with its reason.
   Both are imported in `App.tsx`. "Landing and /enter untouched" is now accurate
   for the theme, and `/enter`'s three intentional overrides live in the fixes file
   where they are labelled as such.
3. **PWA splash/status bar** — `theme_color` and `background_color` were still the
   light-theme values (`#123047` / `#f4f7f7`), so an installed PWA showed an
   off-brand splash against the night shell. Both are now `#070f16` (the
   `--navy-deep` token), with a comment tying them to it.
4. **`hero-bg.avif` was not precached** — first load with no network painted the
   veil over nothing. Now included via an explicit `globPatterns`.
5. **`StaleChip` rendered `stale …s`** — it takes a measured age and ticks once a
   second, per spec §6.2 (`stale 12s`).

---

## Fixed in this pass

| Item | Fix |
|---|---|
| oxlint 10 warnings | **0.** Split non-component exports into `lib/motion-variants.ts` and `lib/degradation-copy.ts`; `useCallback` for `load`/`lookup`; derived health state instead of set-state-in-effect; `allowExportNames` for the deliberate provider-hook re-exports. |
| `IN EFFECTIVE_DYNAMIC_IMPORT` on Dna | `PassportView` moved to `components/PassportView.tsx`; the route chunk is lazy again. |
| Duplicated `.ring-*` rules | One rule set in `ui.css`, driven by `--tier-*` tokens; `night.css` only re-points the tokens. Ten override rules deleted. |
| Redundant `.enter-hint` rule | Collapsed to one declaration. |
| `Session.tsx` 695 lines | **169 lines** — composes the room; feed in `session/QuestionFeed.tsx` (414), rails in `session/MembersRail.tsx` (120), shared bits in `session/Shared.tsx` (36). |
| `demo/record.cjs` referenced but missing | Written and **run end-to-end: 10/10 shots pass**, video written. |

## Found while recording (real defects, now fixed)

**`POST /dna` always failed with a 400.** `GET /dna/items` returned display
strings for `S1` (`"picture-desc (visual)"`) while the controller validated
`visual | analogy | steps`. The diagnostic screen could therefore never be
submitted — the whole passport flow was dead in the UI while every backend test
passed, because the tests posted the enum directly.

Fixed by giving options an explicit `{ value, label }` shape: `value` is what
`POST /dna` validates, `label` is what the learner reads. Both the integration
test and the live smoke now assert that **every option value is accepted by the
validator**, so this cannot regress.

---

## Environment note (not a code defect)

The demo was recorded on a stack whose inference provider returned
**429 `FreeUsageLimitError`** ("free models work in OpenCode…"). Nova therefore
served its **T0 fallback**, and the RESOLVED card showed the app's visible
`no cites` warning — the documented degradation path (spec §6.4), not a silent
failure. `record.cjs` now fails the shot unless the resolution is one of:
citations present · `peers_verified` · an explicitly labelled degraded state.
To film the "tier C with citations" narration line, point `halqa-api/.env` at a
provider with quota and re-run `node demo/record.cjs`.
