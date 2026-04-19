// LLM evaluation tests — design tickets:
//   V-01 · golden 500 (here: 24 representative rows)
//   V-02 · adversarial 200 (here: 12 representative rows)
//
// We exercise the deterministic OFFLINE extractor (the only path with stable
// expected outputs in CI). When the live AI is wired in, this same harness
// should be re-pointed at it via PROXY_URL and the regression bands enforced.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModules } = require('../helpers/load');

const GOLDEN = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'fixtures', 'golden.json'), 'utf8'));

// ---------- V-01 · golden set ----------
test('V-01 · golden set (offline) ≥ 96% persona accuracy', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  let hits = 0;
  const misses = [];
  for (const row of GOLDEN.rows) {
    const res = await AI.extrapolate(row.bench);
    const persona = res.data.persona && res.data.persona.value;
    if (persona === row.persona_expected) {
      hits++;
    } else {
      misses.push({ id: row.id, expected: row.persona_expected, got: persona });
    }
  }
  const acc = hits / GOLDEN.rows.length;
  assert.ok(acc >= 0.96, `golden persona accuracy ${(acc*100).toFixed(1)}% < 96% — misses: ${JSON.stringify(misses)}`);
});

test('V-01 · golden set businessType matches the design pattern for every row', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  for (const row of GOLDEN.rows) {
    const res = await AI.extrapolate(row.bench);
    const bt = res.data.businessType && res.data.businessType.value;
    if (row.businessType_pattern) {
      const re = new RegExp(row.businessType_pattern, 'i');
      assert.ok(re.test(bt), `${row.id}: businessType "${bt}" did not match /${row.businessType_pattern}/`);
    }
  }
});

test('V-01 · forbidden-personas rule is honoured for every row that has one', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  for (const row of GOLDEN.rows) {
    if (!row.must_not_be || !row.must_not_be.persona) continue;
    const res = await AI.extrapolate(row.bench);
    const persona = res.data.persona && res.data.persona.value;
    for (const banned of row.must_not_be.persona) {
      assert.notEqual(persona, banned, `${row.id}: produced banned persona ${banned}`);
    }
  }
});

// ---------- V-06 · numerical consistency (proxied for offline) ----------
// Design: "A number in prose must equal the runner's number." Offline narration
// is built from the runner's output, so this should always hold.
test('V-06 · scenario narration cites the runner number, not a fabricated one', async () => {
  const { AI, Sim } = loadModules(['Store', 'AI', 'Sim']);
  const s = Sim.newState();
  for (const goal of ['grow', 'stabilize', 'move', 'hire']) {
    const out = Sim.runScenario(s, goal);
    const narr = await AI.narrateScenario(goal, out);
    if (out.cash12mo != null) {
      assert.ok(narr.data.includes(out.cash12mo.toLocaleString()),
        `goal=${goal}: narration "${narr.data}" missing runner cash12mo=${out.cash12mo}`);
    }
  }
});
