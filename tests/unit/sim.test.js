// Unit tests for simulation.js — maps to design tickets:
//   U-105.1 · sim runner determinism (same inputs → same outputs)
//   U-107.1 · connector status machine (only legal transitions)
//   U-Sim.observe · EMA convergence + spread shrinks
//   U-Sim.sharpness · bounded in [0,1]
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../helpers/load');

// Cheap structural hash — for asserting byte-identical run outcomes without
// pulling in crypto. Runs are small JSON-friendly trees so this is enough.
function structHash(o) {
  return JSON.stringify(o, Object.keys(o).sort());
}

function deepEqualNumeric(a, b, tol = 1e-9) {
  if (Array.isArray(a)) {
    assert.equal(a.length, b.length);
    a.forEach((v, i) => deepEqualNumeric(v, b[i], tol));
    return;
  }
  if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) deepEqualNumeric(a[k], b[k], tol);
    return;
  }
  if (typeof a === 'number') { assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`); return; }
  assert.equal(a, b);
}

test('U-105.1 · sim runner determinism — same inputs produce identical outputs', () => {
  const { Sim } = loadModules(['Sim']);
  const a = Sim.newState();
  const b = Sim.newState();
  for (let i = 0; i < 52; i++) Sim.step(a);
  for (let i = 0; i < 52; i++) Sim.step(b);
  deepEqualNumeric(a.stocks, b.stocks);
  deepEqualNumeric(a.history, b.history);
});

test('U-105.2 · forecast() is pure — does not mutate the source state', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const beforeStocks = JSON.stringify(s.stocks);
  const beforeParams = JSON.stringify(s.params);
  Sim.forecast(s, 26);
  Sim.forecast(s, 52, { newPerWeek: 999 });
  assert.equal(JSON.stringify(s.stocks), beforeStocks);
  assert.equal(JSON.stringify(s.params), beforeParams);
});

test('U-105.3 · runScenario · 100 calls with identical inputs all match (no hidden RNG)', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  Sim.learnFromProfile(s, {
    persona: { value: 'klaus', confidence: 0.9, why: 'crew of 12' },
    priceTier: { value: 'mid', confidence: 0.8, why: '' },
  });
  const first = structHash(Sim.runScenario(s, 'grow'));
  for (let i = 0; i < 99; i++) {
    const r = structHash(Sim.runScenario(s, 'grow'));
    assert.equal(r, first, `divergence at iter ${i}`);
  }
});

test('U-Sim.observe · EMA pulls value toward observation, never overshoots', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const before = s.params.avgTicket.value;
  Sim.observe(s, { param: 'avgTicket', value: 200, weight: 1 });
  const after1 = s.params.avgTicket.value;
  Sim.observe(s, { param: 'avgTicket', value: 200, weight: 1 });
  const after2 = s.params.avgTicket.value;
  assert.ok(after1 > before, 'first observation moved value up');
  assert.ok(after2 >= after1 - 1e-9, 'second observation regressed');
  assert.ok(after2 <= 200, 'should not overshoot the observation');
  // A higher subsequent observation still pulls further up.
  Sim.observe(s, { param: 'avgTicket', value: 400, weight: 1 });
  assert.ok(s.params.avgTicket.value > after2, 'higher observation did not pull further up');
});

test('U-Sim.observe · spread shrinks as evidence accumulates (sharpness ↑)', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const beforeSpread = s.params.avgTicket.spread;
  for (let i = 0; i < 10; i++) {
    Sim.observe(s, { param: 'avgTicket', value: 60, weight: 1 });
  }
  assert.ok(s.params.avgTicket.spread < beforeSpread, 'spread did not shrink');
  assert.ok(s.params.avgTicket.weight >= 10, 'weight did not accumulate');
});

test('U-Sim.observe · unknown param is a no-op (no throw, no silent state change)', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const before = JSON.stringify(s.params);
  Sim.observe(s, { param: 'doesNotExist', value: 999, weight: 5 });
  assert.equal(JSON.stringify(s.params), before);
});

test('U-Sim.sharpness · bounded in [0,1] for any observation history', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  assert.ok(Sim.sharpness(s) >= 0 && Sim.sharpness(s) <= 1);
  for (let i = 0; i < 50; i++) {
    Sim.observe(s, { param: 'avgTicket', value: 60, weight: 1 });
    Sim.observe(s, { param: 'cacEuros', value: 5, weight: 1 });
  }
  const sh = Sim.sharpness(s);
  assert.ok(sh >= 0 && sh <= 1, `sharpness=${sh} out of range`);
});

// U-107 · connector status machine — v2 doesn't have an explicit
// FSM, but learnFromConnection is the only legal way to mutate connection
// effects on the sim. Property: connecting a tool only ever sharpens.
test('U-107.1 · learnFromConnection is monotonic — sharpness never decreases', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const tools = ['stripe', 'bank', 'calendar', 'gmail', 'insta', 'pos'];
  let prev = Sim.sharpness(s);
  for (const t of tools) {
    Sim.learnFromConnection(s, t);
    const next = Sim.sharpness(s);
    assert.ok(next >= prev, `connecting ${t} reduced sharpness ${prev} → ${next}`);
    prev = next;
  }
});

test('U-107.2 · learnFromConnection on unknown tool is a no-op', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  const before = Sim.sharpness(s);
  Sim.learnFromConnection(s, 'something-we-dont-support');
  assert.equal(Sim.sharpness(s), before);
});

test('U-Sim.summary · returns a finite-number object suitable for AI prompts', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  for (let i = 0; i < 10; i++) Sim.step(s);
  const sm = Sim.summary(s);
  for (const k of ['cash', 'customers', 'capacity', 'lastWeekRevenue', 'lastWeekProfit', 'cash12mo', 'sharpness']) {
    assert.equal(typeof sm[k], 'number', `summary.${k} not a number`);
    assert.ok(Number.isFinite(sm[k]), `summary.${k} is not finite (${sm[k]})`);
  }
});

test('U-Sim.runScenario · produces the design-required keys', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  for (const goal of ['grow', 'stabilize', 'move', 'hire']) {
    const out = Sim.runScenario(s, goal);
    assert.equal(out.goal, goal);
    assert.equal(typeof out.cash12mo, 'number');
    assert.ok(out.confidence >= 0 && out.confidence <= 1, `confidence ${out.confidence} out of range`);
    assert.ok(Array.isArray(out.history), 'history not an array');
    assert.equal(out.history.length, 52);
  }
});
