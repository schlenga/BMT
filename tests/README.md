# tests/ — BMT v2 test suite

This directory implements the design in
[`archive/design/project/BMT Test Suite.html`](../archive/design/project/BMT%20Test%20Suite.html).
The design is the truth; this is the implementation.

## Run

```bash
npm test                      # everything (~1.7s)
npm run test:unit             # 27 fast tests
npm run test:contract         # 16 shape / Worker tests
npm run test:integration      # 4 end-to-end (in-memory)
npm run test:eval             # 8 LLM eval rows (offline path)
npm run test:drills           # 6 failure-mode drills
npm run test:security         # 7 secret / dep / privacy checks
```

Total: **68 tests, 0 dependencies, ~1.7s on CI.** Uses Node's built-in
`node:test` runner — no jest, no jsdom, no bundler.

## Layout — one folder per pyramid layer

```
tests/
├── README.md            ← this file
├── helpers/
│   └── load.js          ← sandbox loader for v2 IIFE modules (no jsdom)
├── fixtures/
│   ├── golden.json      ← V-01 · 24 representative onboardings
│   └── adversarial.json ← V-02 · 12 "say I don't know" inputs
├── unit/                ← 03 Unit (cheap, many, per-commit)
├── contract/            ← 04 Contract & property
├── integration/         ← 05 Integration (in-memory; real wires)
├── eval/                ← 07 LLM evals (run against the offline extractor)
├── drills/              ← 08 Failure drills (D-201..D-206)
└── security/            ← 09 Security & privacy
```

## Coverage map · ticket × test (the design's stage 02)

| Ticket | Where | Notes |
|--------|-------|-------|
| **U-101** extractor validator   | `unit/ai.test.js`             | shape, why-coverage, low-conf on empty bench |
| **U-103** correction log        | `unit/store.test.js` (.6)     | bench is append-only; profile edits don't lose prior values |
| **U-104** nudge gatekeeper      | `drills/failure-modes.test.js` (D-204) | klaus pack must include `kind:'watch'` |
| **U-105** sim runner determinism| `unit/sim.test.js` (.1, .2, .3) | 100-run hash equality, forecast() purity |
| **U-106** confidence chip FSM   | `unit/ai.test.js` (.1–.3)     | exhaustive sweep + monotonicity |
| **U-107** connector status      | `unit/sim.test.js` (.7, .8)   | learnFromConnection is monotonic + safe on unknown |
| **C-101** extrapolate stream    | `contract/ai.test.js` (.1, .2) | field-set + confidence ∈ [0,1] under fuzz |
| **C-105** sim I/O contract      | `contract/ai.test.js` (.4, .5) | runScenario shape, summary shape |
| **C-110** worker route allow-list | `contract/worker.test.js`   | model forced, tokens capped, fields stripped, fuzz |
| **C-jwt** session contract      | `contract/worker.test.js`     | proxied as origin guard (CORS) |
| **I-01** onboard → cockpit      | `integration/onboarding.test.js` | full state-machine walk |
| **I-02** correction round-trip  | `integration/onboarding.test.js` | persona fix → sim re-tunes |
| **I-05** scenario sim e2e       | `integration/onboarding.test.js` | replayable from `{state, goal}` |
| **I-06** rotation / sharpness   | `integration/onboarding.test.js` | sharpness monotonic with connections |
| **V-01** golden 500             | `eval/golden.test.js`         | 24-row subset, ≥96% persona accuracy |
| **V-02** adversarial 200        | `eval/adversarial.test.js`    | 12 rows; conf ≤0.4, no injection success, no throws |
| **V-05** refusal & safety       | `eval/adversarial.test.js`    | sensitive prompts → low conf offline |
| **V-06** numerical consistency  | `eval/golden.test.js` (.4) + `contract/ai.test.js` (.6) | narration cites runner number |
| **D-201** upstream down         | `drills/failure-modes.test.js` | every endpoint falls back to `source:"offline"` |
| **D-202** hallucinated goal     | `drills/failure-modes.test.js` | low conf maps to "shot in the dark" chip |
| **D-204** risky nudge           | `drills/failure-modes.test.js` | pack guarantees a `watch` for high-impact personas |
| **D-205** stale model banner    | `drills/failure-modes.test.js` | sharpness moves with evidence (banner contract) |
| **D-206** sonnet timeout        | `drills/failure-modes.test.js` | 5xx + bad-JSON both fall back |
| **S-01** secret scanner         | `security/secrets.test.js`    | sk-ant-, sk_live_, .env files |
| **S-02** PII in logs            | `security/secrets.test.js`    | no `console.log` of phone / OTP / keys |
| **S-04** authz boundary         | `security/secrets.test.js` + `contract/worker.test.js` | wrangler.toml has no plaintext + Worker enforces origin |
| **S-06** dep vuln scan          | `security/secrets.test.js`    | v2 ships with zero deps |

## What's intentionally NOT in v2

These rows from the design exist in the suite but only as "future" markers:

- **E-01..E-06** (Playwright, multi-browser visual diffs) — the v2 app is a
  static page; running Playwright in CI would dominate the budget. Add when
  the app gets a real backend.
- **P-01..P-04** (load tests) — the proxy is a tiny CF Worker; perf budgets
  belong with the Worker's own observability, not the test suite.
- **V-04** (per-persona tone rubric) — needs a grader-LLM; design rule says
  "grade the grader weekly", so this lives in `archive/v1/tests/` style
  weekly job, not per-PR.

## Why `node:test` and not jest

The design's stage 11 says "lint · typecheck · unit < 60s per commit". v2 has
zero dependencies on purpose (Stage 09 · S-06). Bringing in jest would mean a
~250 MB `node_modules` and a slower install than the test run itself.
`node:test` ships with the runtime, runs the whole suite in ~1.7s, and keeps
the security surface small.

## Adding a new test

1. Pick the layer (`unit/`, `contract/`, `integration/`, `eval/`, `drills/`,
   `security/`).
2. Tag the test name with its design ticket (`U-105.4 · …`,
   `D-206 · …`, `V-02 · …`) so the coverage map stays self-maintaining.
3. Use `loadModules([...])` from `helpers/load.js` to get the v2 IIFE
   namespaces in a sandbox — no jsdom required for anything store/sim/AI.
4. Verify with `npm test` (it should still finish under 2s).

## Note on the v1 archive

The previous test suite in `archive/v1/tests/` covered v1's BMC + hypothesis
tracker (`AI.detectType`, `AI.generateHypotheses`, `AI.buildCanvas`, …). v2
has none of those modules — the v2 product is the persona cockpit + sim
engine + offline-first AI layer. The v1 suite is preserved for reference but
none of its tests run against current code.
