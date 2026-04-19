// Integration tests — design tickets:
//   I-01 · onboard → confirm → cockpit (happy path)
//   I-02 · correction round-trip — fix a field, sim relearns
//   I-05 · scenario sim end-to-end — scenario picked, result persists
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../helpers/load');

test('I-01 · auth → bench → extrapolate → confirm → cockpit (state machine)', async () => {
  const { Store, AI, Sim } = loadModules(['Store', 'AI', 'Sim']);
  Store.reset();

  // Stage 1 — auth
  Store.set(s => { s.auth.phone = '+49 30 1234 5678'; s.auth.verified = true; s.auth.backup = 'phone2'; });
  assert.equal(Store.get().auth.verified, true);

  // Stage 2 — bench
  Store.set(s => { s.bench.push({ kind: 'describe', value: '2-chair hair salon in Berlin', addedAt: Date.now() }); });
  Store.set(s => { s.bench.push({ kind: 'url', value: 'https://linahair.example', addedAt: Date.now() }); });
  assert.equal(Store.get().bench.length, 2);

  // Stage 3 — extrapolate (offline path)
  const ext = await AI.extrapolate(Store.get().bench);
  Store.set(s => {
    for (const k of Object.keys(ext.data)) {
      s.profile[k] = ext.data[k].value;
      s.profile.confidence[k] = ext.data[k].confidence;
      s.profile.whys[k] = ext.data[k].why;
    }
  });
  // Bench mentioned salon → persona should be lina (offline keyword path).
  assert.equal(Store.get().profile.persona, 'lina');

  // Stage 4 — confirm a correction (high confidence)
  Store.set(s => { s.profile.priceTier = 'premium'; s.profile.confidence.priceTier = 0.95; s.profile.whys.priceTier = 'you told me'; });
  assert.equal(Store.get().profile.priceTier, 'premium');

  // Stage 5 — cockpit greet (no error on the path)
  const greet = AI.greet(Store.get().profile);
  assert.match(greet, /Lina/);

  // Sim learns from confirmed profile (Cockpit.simState would do this).
  const sim = Sim.newState();
  Sim.learnFromProfile(sim, {
    persona: { value: Store.get().profile.persona, confidence: 0.95, why: '' },
    priceTier: { value: Store.get().profile.priceTier, confidence: 0.95, why: '' },
  });
  // Premium price → avgTicket should be much higher than the prior of 55.
  assert.ok(sim.params.avgTicket.value > 55, `expected premium avgTicket above default, got ${sim.params.avgTicket.value}`);
});

test('I-02 · correction round-trip — wrong persona → user fixes → sim re-tunes', () => {
  const { Store, Sim } = loadModules(['Store', 'Sim']);
  Store.reset();
  // Initial extrapolate guessed lina with low confidence.
  Store.set(s => {
    s.profile.persona = 'lina';
    s.profile.confidence.persona = 0.3;
    s.profile.whys.persona = 'rough keyword match';
  });
  const sim1 = Sim.newState();
  Sim.learnFromProfile(sim1, { persona: { value: 'lina' }, priceTier: { value: 'mid' } });
  const linaTicket = sim1.params.avgTicket.value;

  // User corrects to klaus.
  Store.set(s => {
    s.profile.persona = 'klaus';
    s.profile.confidence.persona = 0.95;
    s.profile.whys.persona = 'you told me';
  });
  assert.equal(Store.get().profile.persona, 'klaus');

  const sim2 = Sim.newState();
  Sim.learnFromProfile(sim2, { persona: { value: 'klaus' }, priceTier: { value: 'mid' } });
  // Klaus profile: avgTicket=480 prior pulls ticket way up.
  assert.ok(sim2.params.avgTicket.value > linaTicket * 2, 'klaus correction did not retune the sim');
});

test('I-05 · scenario picker → runScenario → store, replayable from inputs', () => {
  const { Store, Sim } = loadModules(['Store', 'Sim']);
  Store.reset();
  const s = Sim.newState();
  const out = Sim.runScenario(s, 'grow');
  Store.set(state => { state.scenarios.unshift({ id: 'sc_1', goal: 'grow', params: {}, result: out, createdAt: Date.now() }); });

  const stored = Store.get().scenarios[0];
  assert.equal(stored.goal, 'grow');
  assert.deepEqual(stored.result, out);

  // Replay from {state seed + goal}: rerunning yields identical bytes (no
  // hidden RNG between calls — design rule for U-105).
  const replay = Sim.runScenario(Sim.newState(), 'grow');
  assert.equal(JSON.stringify(replay), JSON.stringify(out));
});

test('I-06 · sharpness rises monotonically as connections come online', () => {
  const { Store, Sim } = loadModules(['Store', 'Sim']);
  Store.reset();
  const sim = Sim.newState();
  let prev = Sim.sharpness(sim);
  const tools = ['stripe', 'calendar', 'gmail', 'bank'];
  for (const t of tools) {
    Store.set(state => { state.connections[t] = { status: 'on', lastSeen: Date.now() }; });
    Sim.learnFromConnection(sim, t);
    Store.set(state => { state.sharpness = Sim.sharpness(sim); });
    const next = Store.get().sharpness;
    assert.ok(next >= prev, `sharpness regressed after connecting ${t}: ${prev} → ${next}`);
    prev = next;
  }
});
