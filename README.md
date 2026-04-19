# BMT — Keep doing what you do best. We'll run the rest.

BMT is a business cockpit for small and medium businesses — hairdressers, plumbers, cafés, consultants. Running your business should be as easy as ordering a pizza. The front-end design (lifted from the handoff in `archive/design/`) drives the product: a 9-stage user flow, persona-adaptive cockpits, an always-on "COO" that nudges toward the lean-startup loop without ever saying the words.

**The design is the spec.** This repo is a first-pass implementation of it.

---

## The flow (what this repo implements)

| # | Stage | What happens |
|---|-------|--------------|
| 01 | **Land & verify** | Phone-number sign-in only — no Google, no Apple. SMS or voice code. Mandatory 2FA, explained in plain words. Trust receipt up front. |
| 02 | **Workbench** | A visual scene with six ambient drop zones — photos, notebook, URL, receipt, tool, business card. No forms, no options, nothing required. The bench never "finishes" — it's a permanent context inbox. |
| 03 | **Extrapolate** | Live narration as the AI reads whatever you dropped and guesses your business. Every step is visible. Every guess has a confidence score. |
| 04 | **Confirm** | One-page "receipt" of what the AI thinks. Every row has a `↳ why`. Tap any line to correct — the simulation learns from your correction. |
| 05 | **Cockpit** | Materializes in waves. Ghost modules (pale, dashed) show where more data would sharpen us. Sharpness meter in the header. |
| 06 | **Connect** | Every ghost module is a hint. Stripe, bank, calendar, inbox — all passthrough, never retained. If the user doesn't have a payment system, we suggest one. |
| 07 | **Adaptive** | One cockpit, four lives. Lina's is warm & mobile. Klaus's is a desktop command-post. Franka's is quiet & keyboard-driven. Nadia's is one-glance. |
| 07b | **React** | Situation rooms: RFP detected, rent letter scanned, employee retiring. Structured plan + an explicit "do nothing" path. |
| 08 | **COO** | Ambient / nudges / side panel — user-controlled loudness. Every nudge is secretly a Build → Measure → Learn loop (the secret teaching layer). |
| 09 | **Scenarios** | Grow / Stabilize / Move / Hire. Goal picker, sandbox with sliders, or COO-initiated — all feeding the same simulation engine. |

## How the back-end supports it

### An abstract business model that learns
`simulation.js` represents any business as a graph of stocks (cash, customers, capacity) and flows (acquisition, retention, price, cost, hours). Every parameter has a prior, a current value, and a weight. Every confirmation the user makes, every connected data source, and every outcome of a scenario becomes an **observation** that nudges a parameter toward reality — an EMA online-learning loop, not a big ML model. Sharpness = how much the parameter spreads have collapsed.

### AI calls at many steps
`ai.js` exposes distinct endpoints for every place in the flow the AI shows up:
- `extrapolate(bench)` — guesses a business profile from what was dropped
- `confirmNudge(field, guess)` — picks the right hedge copy per confidence
- `greet(profile)` — persona-tuned cockpit greeting
- `proposeNudges(state, sim)` — ambient + nudge cards for stage 8
- `draftShockPlan(shock, state)` — situation-room plans for stage 7b
- `narrateScenario(goal, simOut)` — plain-words narration for stage 9
- `confidenceLabel(c)` — `"pretty sure"` / `"a guess"` / `"hunch"` / `"shot in the dark"`

Every endpoint has a deterministic **offline fallback** so the app is usable without the proxy wired. The fallback is always flagged in the UI (`offline estimate`) — never silent.

### Attitude — talk to the user, be clear when unsure
Baked into `ai.js` system prompt:
- Plain words, no consultant jargon (`"leverage"`, `"stakeholder"`, `"synergy"` banned).
- Explicit uncertainty: "I'm not sure", "I guessed", "roughly".
- Every AI claim comes with a one-sentence `why`.
- The lean-startup loop is shape, not vocabulary — the words "hypothesis" or "MVP" never appear in user-facing copy.

Every extrapolated field carries a `confidence ∈ [0, 1]`. The UI renders a hedge chip (`pretty sure` / `hunch`) next to every guess. When we're shaky, we say so.

---

## Run locally

No build step, no bundler. Just open in a browser:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The app works fully offline — the keyword-based fallback produces plausible guesses and the simulation runs deterministically.

## Wire up live AI (optional)

The AI layer goes through a Cloudflare Worker proxy that hides your Anthropic API key. Same setup as v1:

```bash
cd worker
npx wrangler login
npx wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ALLOWED_ORIGIN      # e.g. https://schlenga.github.io
```

Then open `app.js` and set `AI.setProxy('https://bmt-proxy.<subdomain>.workers.dev/v1/messages')` at the bottom of `start()`.

### Cost protection (in the worker)
- Model forced to `claude-sonnet-4-20250514`
- `max_tokens` capped at 2048
- 60 requests / minute / IP (new flow fires more per session)
- Only POST forwarded
- ALLOWED_ORIGIN lock
- Unknown request fields stripped before proxying

Expected cost per onboarding: ~6 AI calls × ~€0.01 each = **~€0.06 per new user**.

---

## File map

```
index.html          # App shell + all 9 views
styles.css          # Design system — lifted from the handoff
app.js              # Router / state machine across the 9 stages
store.js            # Single-key localStorage persistence
ai.js               # Claude API layer — attitude + offline fallbacks
simulation.js       # Abstract stocks/flows model with online learning
onboarding.js       # Stages 01-04 (auth, workbench, extrapolate, confirm)
cockpit.js          # Stages 05 + 07 (materialize + persona variants)
connect.js          # Stage 06 (sharpness-ranked connections)
shocks.js           # Stage 07b (situation rooms)
coo.js              # Stage 08 (ambient/nudges/panel + BML coach)
scenarios.js        # Stage 09 (goal picker / sandbox / COO-initiated)

worker/worker.js    # Cloudflare Worker proxy (cost protection + origin lock)

tests/              # node:test suite mapped 1:1 to the BMT Test Suite design
archive/v1/         # The previous product (BMC + hypothesis tracker)
archive/design/     # The handoff bundles this was built from (User Flow + Test Suite)
```

## Tests

```bash
npm test          # 68 tests, 0 dependencies, ~1.7s
```

The suite is the implementation of
[`archive/design/project/BMT Test Suite.html`](archive/design/project/BMT%20Test%20Suite.html)
— see [`tests/README.md`](tests/README.md) for the per-ticket coverage map
(U-101..U-107, C-101/105/110, I-01..I-06, V-01/02/05/06, D-201..D-206,
S-01/02/04/06).

## Where this is still thin (honest TODO)

- Bench upload is text-only — real photo/file upload, OCR on receipts, and actual tool OAuth are stubs.
- Auth doesn't actually call an SMS provider — any 6-digit code passes.
- Shock detection is seeded (RFP, rent, retirement). A real detector would watch an inbox/calendar feed.
- The `/v1/messages` Cloudflare Worker is unchanged from v1 except for the tighter field allowlist and the bumped rate limit.
- ~~No tests in this pass.~~ Suite implemented per `archive/design/project/BMT Test Suite.html` — see [`tests/README.md`](tests/README.md). 68 tests, 0 dependencies, ~1.7s total. v1's jest suite is preserved in `archive/v1/tests/` for reference.
- The simulation is intentionally simple. It's *useful abstraction*, not a deep simulator. More parameters and more observation sources (bank, calendar, POS) are the next big unlock.

## Personas the design is built for

| | Lina · 26 | Klaus · 51 | Franka · 43 | Nadia · 38 |
|---|---|---|---|---|
| Business | 2-chair hair salon | Plumbing · 12 staff · 4 vans | Marketing agency · 2 freelancers | Café · 6 staff · 2 kids |
| Tech | Insta-native | Prefers a real keyboard | Tries every new tool | No spare bandwidth |
| What she/he'd love | "Tell me who to text, what reel worked" | "Where should 4 vans be tomorrow" | "Draft the proposal, chase the invoice" | "One glance. One nudge. That's it." |
| Cockpit mood | warm, mobile, big type | green, dense, desktop | slate, minimal, ⌘K | cream, one-glance, tablet |
