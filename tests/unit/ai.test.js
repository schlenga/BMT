// Unit tests for ai.js — maps to design tickets:
//   U-106  · confidence chip state machine (chipState → confidenceLabel)
//   U-101  · extractor validator      (offline extrapolate field shape)
//   U-greet (persona-tuned greeting)  (small but covers persona switch)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../helpers/load');

// ---------- U-106 · confidence chip state machine ----------
// Design: "Chip never enters an undefined state."
// v2 has confidenceLabel(c) returning one of four labels; we treat it as the
// state machine until a 'stale' state is added.
test('U-106.1 · confidenceLabel covers the full [0..1] domain with no gaps', () => {
  const { AI } = loadModules(['Store', 'AI']);
  const cases = [
    [0.95, 'pretty sure'], [0.75, 'pretty sure'],
    [0.74, 'a guess'],     [0.50, 'a guess'],
    [0.49, 'hunch'],       [0.25, 'hunch'],
    [0.24, 'shot in the dark'], [0.00, 'shot in the dark'],
  ];
  for (const [c, expected] of cases) {
    assert.equal(AI.confidenceLabel(c), expected, `c=${c}`);
  }
});

test('U-106.2 · confidenceLabel exhaustive sweep yields a defined label for every step', () => {
  const { AI } = loadModules(['Store', 'AI']);
  const labels = new Set(['pretty sure', 'a guess', 'hunch', 'shot in the dark']);
  for (let i = 0; i <= 100; i++) {
    const label = AI.confidenceLabel(i / 100);
    assert.ok(labels.has(label), `c=${i/100} produced "${label}"`);
  }
});

test('U-106.3 · monotonic — never returns "more confident" for a lower input', () => {
  const { AI } = loadModules(['Store', 'AI']);
  const rank = { 'shot in the dark': 0, 'hunch': 1, 'a guess': 2, 'pretty sure': 3 };
  let last = -1;
  for (let i = 0; i <= 100; i++) {
    const r = rank[AI.confidenceLabel(i / 100)];
    assert.ok(r >= last, `non-monotonic at c=${i/100}`);
    last = r;
  }
});

// ---------- U-AI.confirmNudge · copy switches by confidence band ----------
test('U-AI.confirmNudge · confident, fairly-sure, and unsure bands produce distinct copy', () => {
  const { AI } = loadModules(['Store', 'AI']);
  const a = AI.confirmNudge('industry', { confidence: 0.9 });
  const b = AI.confirmNudge('industry', { confidence: 0.5 });
  const c = AI.confirmNudge('industry', { confidence: 0.1 });
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.match(c.toLowerCase(), /not sure/);
});

// ---------- U-101 · extractor validator (offline path is deterministic) ----------
test('U-101.1 · offline extrapolate emits the full field set with shape {value,confidence,why}', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const res = await AI.extrapolate([{ kind: 'describe', value: '2-chair hair salon in Berlin' }]);
  assert.equal(res.source, 'offline'); // no PROXY_URL set
  const data = res.data;
  for (const field of ['persona', 'businessType', 'location', 'priceTier', 'customers', 'staff']) {
    assert.ok(data[field], `missing field ${field}`);
    assert.ok(Object.prototype.hasOwnProperty.call(data[field], 'value'), `${field}.value missing`);
    assert.equal(typeof data[field].confidence, 'number', `${field}.confidence not a number`);
    assert.ok(data[field].confidence >= 0 && data[field].confidence <= 1, `${field}.confidence out of range`);
    assert.equal(typeof data[field].why, 'string', `${field}.why not a string`);
  }
});

// Design rule (BMT Test Suite stage 00 · #3 "The UI never lies"): a confident
// guess with no 'why' is invalid. Offline path must always supply a why.
test('U-101.2 · every offline-extrapolated field has a non-empty why string', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const res = await AI.extrapolate([{ kind: 'describe', value: 'plumbing crew, 12 staff, 4 vans' }]);
  for (const k of Object.keys(res.data)) {
    assert.ok(res.data[k].why.length > 0, `${k}.why is empty`);
  }
});

test('U-101.3 · empty bench returns low-confidence guesses (≤0.4) — no fabrication', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const res = await AI.extrapolate([]);
  for (const k of Object.keys(res.data)) {
    assert.ok(res.data[k].confidence <= 0.4, `${k} confidence too high for empty bench: ${res.data[k].confidence}`);
  }
});

// ---------- U-AI.greet · persona switch ----------
test('U-AI.greet · returns persona-specific copy and never falls into undefined', () => {
  const { AI } = loadModules(['Store', 'AI']);
  const linaG = AI.greet({ persona: 'lina' });
  const klausG = AI.greet({ persona: 'klaus' });
  const frankaG = AI.greet({ persona: 'franka' });
  const nadiaG = AI.greet({ persona: 'nadia' });
  assert.match(linaG, /Lina/);
  assert.match(klausG, /Dispatch/);
  assert.match(frankaG, /Franka/);
  assert.match(nadiaG, /Café/);
  // Unknown persona falls back to lina (no undefined / null).
  const unk = AI.greet({ persona: 'who-knows' });
  assert.equal(typeof unk, 'string');
  assert.ok(unk.length > 0);
  // Missing persona key entirely → still safe.
  const empty = AI.greet({});
  assert.equal(typeof empty, 'string');
});

// ---------- U-AI.isOnline · gate on PROXY_URL ----------
test('U-AI.isOnline · false unless setProxy() called with a URL', () => {
  const { AI } = loadModules(['Store', 'AI']);
  assert.equal(AI.isOnline(), false);
  AI.setProxy('https://example.test/v1/messages');
  assert.equal(AI.isOnline(), true);
  AI.setProxy('');
  assert.equal(AI.isOnline(), false);
});
