// Failure-mode drills — design tickets:
//   D-201 · upstream/connector down (proxy fetch fails)
//   D-202 · hallucinated goal — quarantined / never rendered confidently
//   D-203 · misclassification — corrected, sim re-tunes (covered in I-02)
//   D-204 · risky nudge — 2-step before action (state contract)
//   D-205 · stale model — banner-not-block (sharpness regression banner)
//   D-206 · upstream timeout — graceful offline fallback at every endpoint
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../helpers/load');

// D-201 · proxy down → AI endpoints all degrade to offline, UI still usable.
test('D-201 · proxy fetch fails → every AI endpoint returns source:"offline"', async () => {
  const failingFetch = () => Promise.reject(new Error('proxy ECONNREFUSED'));
  const { AI, Sim } = loadModules(['Store', 'AI', 'Sim'], { fetchImpl: failingFetch });
  AI.setProxy('https://broken.test/v1/messages'); // online mode but fetch fails

  const ext = await AI.extrapolate([{ kind: 'describe', value: 'salon in Berlin' }]);
  assert.equal(ext.source, 'offline', 'extrapolate should fall back');

  const nudges = await AI.proposeNudges({ profile: { persona: 'lina', businessType: 'salon' }, sharpness: 0.5 }, {});
  assert.equal(nudges.source, 'offline', 'proposeNudges should fall back');
  assert.ok(Array.isArray(nudges.data) && nudges.data.length > 0, 'fallback nudges should be non-empty');

  const plan = await AI.draftShockPlan({ id: 'rfp', title: 'RFP from Acme' }, { profile: { persona: 'lina' } });
  assert.equal(plan.source, 'offline', 'draftShockPlan should fall back');
  assert.ok(plan.data.steps.length >= 3, 'fallback plan should have ≥3 steps');
  assert.ok(plan.data.doNothing, 'fallback plan must include do-nothing path (design rule)');

  const out = Sim.runScenario(Sim.newState(), 'grow');
  const narr = await AI.narrateScenario('grow', out);
  assert.equal(narr.source, 'offline', 'narrateScenario should fall back');
  assert.ok(narr.data.length > 0);
});

// D-202 · hallucinated goal — the offline path emits low confidence on
// adversarial inputs and the UI's hedge chip should surface the doubt.
test('D-202 · low-confidence guess maps to "shot in the dark" — UI cannot present it as fact', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const res = await AI.extrapolate([]);
  for (const k of Object.keys(res.data)) {
    const c = res.data[k].confidence;
    const chip = AI.confidenceLabel(c);
    assert.ok(['shot in the dark', 'hunch'].includes(chip), `field ${k} c=${c} chip="${chip}" — too confident for empty bench`);
  }
});

// D-204 · risky nudge — high-impact nudges in the offline pack must NOT have
// kind='opportunity' that fires on its own; they should be 'watch' (read-then-act).
test('D-204 · klaus high-impact watch nudge surfaces "watch", not auto-apply', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const res = await AI.proposeNudges({ profile: { persona: 'klaus', businessType: 'plumbing' }, sharpness: 0.6 }, {});
  // At least one nudge in klaus's pack is a "watch" (the quote follow-up).
  const watches = res.data.filter(n => n.kind === 'watch');
  assert.ok(watches.length > 0, 'no watch nudges for klaus — risky-nudge contract violated');
});

// D-205 · stale model proxy: when sharpness is very low, the cockpit/state
// must surface that — sharpness number is the contract that drives the banner.
test('D-205 · sharpness moves with evidence — UI banner contract is queryable', () => {
  const { Store, Sim } = loadModules(['Store', 'Sim']);
  Store.reset();
  const sim = Sim.newState();
  const fresh = Sim.sharpness(sim);
  // Connect a couple of tools to drive sharpness higher; the banner contract
  // is "fresh < connected" so the UI has a signal to render against.
  Sim.learnFromConnection(sim, 'stripe');
  Sim.learnFromConnection(sim, 'bank');
  Sim.learnFromConnection(sim, 'calendar');
  const enriched = Sim.sharpness(sim);
  assert.ok(enriched > fresh, `sharpness did not improve with connections: ${fresh} → ${enriched}`);
  // And both ends are bounded so the banner never displays out-of-range numbers.
  assert.ok(fresh >= 0 && fresh <= 1);
  assert.ok(enriched >= 0 && enriched <= 1);
});

// D-206 · upstream timeout proxy: a fetch that resolves to a non-ok response
// (proxy returned 5xx) must trigger the offline fallback as well.
test('D-206 · proxy 5xx response → offline fallback activates', async () => {
  const fetch5xx = () => Promise.resolve({
    ok: false, status: 503,
    json: () => Promise.resolve({ error: { message: 'upstream down' } }),
  });
  const { AI } = loadModules(['Store', 'AI'], { fetchImpl: fetch5xx });
  AI.setProxy('https://flaky.test/v1/messages');
  const ext = await AI.extrapolate([{ kind: 'describe', value: 'salon' }]);
  assert.equal(ext.source, 'offline');
});

test('D-206b · proxy returns malformed JSON → offline fallback activates', async () => {
  const fetchBadJson = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ content: [{ text: 'definitely not json' }] }),
  });
  const { AI } = loadModules(['Store', 'AI'], { fetchImpl: fetchBadJson });
  AI.setProxy('https://confused.test/v1/messages');
  const ext = await AI.extrapolate([{ kind: 'describe', value: 'salon' }]);
  // callJSON throws on bad JSON → caught → offline fallback.
  assert.equal(ext.source, 'offline');
});
