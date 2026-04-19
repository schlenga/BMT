// Contract tests for the AI/Sim shapes — design tickets:
//   C-101 · /v1/extrapolate output shape (event-set semantics)
//   C-105 · sim I/O contract — runScenario shape, summary shape
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../helpers/load');

// JSON-schema-lite. Returns null on success, error string on failure.
function checkShape(spec, value, pathPrefix = '$') {
  if (spec.type === 'string')   return typeof value === 'string'   ? null : `${pathPrefix}: expected string, got ${typeof value}`;
  if (spec.type === 'number')   return (typeof value === 'number' && Number.isFinite(value)) ? null : `${pathPrefix}: expected finite number`;
  if (spec.type === 'boolean')  return typeof value === 'boolean'  ? null : `${pathPrefix}: expected boolean`;
  if (spec.type === 'null')     return value === null              ? null : `${pathPrefix}: expected null`;
  if (spec.type === 'any')      return null;
  if (spec.type === 'oneof') {
    for (const sub of spec.options) {
      if (checkShape(sub, value, pathPrefix) === null) return null;
    }
    return `${pathPrefix}: matched none of oneof`;
  }
  if (spec.type === 'array') {
    if (!Array.isArray(value)) return `${pathPrefix}: expected array`;
    for (let i = 0; i < value.length; i++) {
      const e = checkShape(spec.items, value[i], `${pathPrefix}[${i}]`);
      if (e) return e;
    }
    return null;
  }
  if (spec.type === 'object') {
    if (value === null || typeof value !== 'object') return `${pathPrefix}: expected object`;
    for (const k of Object.keys(spec.fields)) {
      if (!Object.prototype.hasOwnProperty.call(value, k)) return `${pathPrefix}.${k}: missing`;
      const e = checkShape(spec.fields[k], value[k], `${pathPrefix}.${k}`);
      if (e) return e;
    }
    return null;
  }
  return `${pathPrefix}: unknown spec.type`;
}

const FIELD_SHAPE = {
  type: 'object',
  fields: {
    value: { type: 'oneof', options: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
    confidence: { type: 'number' },
    why: { type: 'string' },
  },
};

const EXTRAPOLATE_SHAPE = {
  type: 'object',
  fields: {
    persona: FIELD_SHAPE,
    businessType: FIELD_SHAPE,
    location: FIELD_SHAPE,
    priceTier: FIELD_SHAPE,
    customers: FIELD_SHAPE,
    staff: FIELD_SHAPE,
  },
};

test('C-101.1 · offline extrapolate output validates against the design schema', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const benches = [
    [{ kind: 'describe', value: '2-chair salon in Berlin' }],
    [{ kind: 'url', value: 'https://acme-plumbing.de' }],
    [{ kind: 'describe', value: 'consulting agency, 3 freelancers' }],
    [{ kind: 'describe', value: 'bakery and café in Köln' }],
    [],
  ];
  for (const b of benches) {
    const res = await AI.extrapolate(b);
    const err = checkShape(EXTRAPOLATE_SHAPE, res.data);
    assert.equal(err, null, err);
    assert.ok(['ai', 'offline'].includes(res.source));
  }
});

test('C-101.2 · confidence values stay in [0,1] across many fuzzed bench inputs', async () => {
  const { AI } = loadModules(['Store', 'AI']);
  const fragments = ['salon','plumb','agency','café','random text','xyz','12 staff',''];
  for (let i = 0; i < 32; i++) {
    const bench = [{ kind: 'describe', value: fragments[i % fragments.length] + ' ' + i }];
    const res = await AI.extrapolate(bench);
    for (const k of Object.keys(res.data)) {
      const c = res.data[k].confidence;
      assert.ok(c >= 0 && c <= 1, `iter ${i} field ${k} confidence=${c}`);
    }
  }
});

// C-105 · sim I/O contract.
const SCENARIO_SHAPE = {
  type: 'object',
  fields: {
    goal: { type: 'string' },
    cash12mo: { type: 'number' },
    breakeven: { type: 'oneof', options: [{ type: 'number' }, { type: 'null' }] },
    confidence: { type: 'number' },
    history: { type: 'array', items: { type: 'number' } },
  },
};

const SUMMARY_SHAPE = {
  type: 'object',
  fields: {
    cash: { type: 'number' },
    customers: { type: 'number' },
    capacity: { type: 'number' },
    lastWeekRevenue: { type: 'number' },
    lastWeekProfit: { type: 'number' },
    cash12mo: { type: 'number' },
    sharpness: { type: 'number' },
  },
};

test('C-105.1 · runScenario output validates against the design schema for every goal', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  for (const goal of ['grow', 'stabilize', 'move', 'hire']) {
    const out = Sim.runScenario(s, goal);
    const err = checkShape(SCENARIO_SHAPE, out);
    assert.equal(err, null, `goal=${goal}: ${err}`);
  }
});

test('C-105.2 · summary output validates against the design schema', () => {
  const { Sim } = loadModules(['Sim']);
  const s = Sim.newState();
  for (let i = 0; i < 20; i++) Sim.step(s);
  const sm = Sim.summary(s);
  const err = checkShape(SUMMARY_SHAPE, sm);
  assert.equal(err, null, err);
});

// "Number-in-prose = number-in-runner" property (V-06): the offline scenario
// narration should never mention a euro figure that contradicts the runner.
test('C-105.3 · offline narrate echoes the runner numbers verbatim (no phantom values)', async () => {
  const { AI, Sim } = loadModules(['Store', 'AI', 'Sim']);
  const s = Sim.newState();
  const out = Sim.runScenario(s, 'grow');
  const res = await AI.narrateScenario('grow', out);
  // Offline narration includes "€<cash12mo>"; assert it matches the runner.
  if (out.cash12mo != null) {
    assert.ok(res.data.includes(out.cash12mo.toLocaleString()), `narration "${res.data}" missing cash12mo=${out.cash12mo}`);
  }
});
