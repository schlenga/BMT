// simulation.js — abstract business model + lightweight learning loop.
//
// The model is intentionally *abstract*: we don't hard-code "salon vs café".
// Instead, every business is represented as a graph of flows between stocks
// (cash, customers, capacity) with tunable parameters. The engine observes
// real signals the user gives us (bench inputs, confirmations, connected data,
// outcomes of scenarios) and nudges parameters toward what explains those
// signals best — a tiny online-learning loop, not a big ML model.
//
// This is deliberately not a deep simulator. It's a *useful abstraction*:
//  - stocks: cash, customers, capacity  (numeric state)
//  - flows: acquisition, conversion, churn, price, cost, hours
//  - parameters: one per flow, plus a few globals (seasonality, confidence)
//  - learning: exponential-moving-average tuning against observations
'use strict';

var Sim = (function() {

  // Each parameter has a prior (our default guess), a current value, and a
  // "weight" — how much evidence we've seen. Bayesian in spirit.
  function param(prior, spread) {
    return { prior: prior, value: prior, spread: spread || prior * 0.5, weight: 0 };
  }

  function defaultParams() {
    return {
      // Acquisition: new customers per week, and cost per customer.
      newPerWeek:      param(15, 10),
      cacEuros:        param(8, 6),
      // Conversion: of those who show interest, fraction that books/buys.
      conversion:      param(0.5, 0.2),
      // Retention: probability they come back in a given month.
      retention:       param(0.6, 0.2),
      // Unit economics.
      avgTicket:       param(55, 20),
      variableCost:    param(0.25, 0.1),   // fraction of ticket
      fixedMonthly:    param(3200, 1500),
      // Capacity.
      hoursPerWeek:    param(40, 15),
      hoursPerCustomer:param(1.2, 0.4),
      // Seasonality (unitless multiplier, centered on 1).
      seasonality:     param(1, 0.1),
      // The operator's own time — taxed by admin, freed by BMT.
      adminHoursPerWeek: param(10, 5),
    };
  }

  function newState() {
    return {
      stocks: { cash: 8000, customers: 120, capacity: 1 },
      params: defaultParams(),
      history: [], // last N ticks for charts
    };
  }

  // One "tick" = one week. Deterministic given params + stocks.
  function step(state) {
    var p = state.params;
    var s = state.stocks;
    var season = p.seasonality.value;

    var attempts = p.newPerWeek.value * season;
    var newCustomers = attempts * p.conversion.value;
    var lost = s.customers * (1 - Math.pow(p.retention.value, 1/4)); // monthly → weekly
    var capacityLimit = p.hoursPerWeek.value / Math.max(0.1, p.hoursPerCustomer.value);
    var served = Math.min(s.customers * 0.25 + newCustomers, capacityLimit); // 25% of base show each week
    var revenue = served * p.avgTicket.value;
    var varCost = revenue * p.variableCost.value;
    var fixedWeekly = p.fixedMonthly.value / 4.33;
    var acq = p.newPerWeek.value * p.cacEuros.value;
    var profit = revenue - varCost - fixedWeekly - acq;

    s.customers = Math.max(0, s.customers + newCustomers - lost);
    s.cash = s.cash + profit;
    s.capacity = served / Math.max(1, capacityLimit);

    state.history.push({
      cash: s.cash, customers: s.customers, revenue: revenue,
      profit: profit, served: served, capacity: s.capacity,
    });
    if (state.history.length > 260) state.history.shift(); // cap at 5y of weeks
    return state;
  }

  // Run N weeks forward, optionally with parameter overrides (for scenarios).
  function forecast(state, weeks, overrides) {
    var cloned = clone(state);
    if (overrides) applyOverrides(cloned.params, overrides);
    for (var i = 0; i < weeks; i++) step(cloned);
    return cloned;
  }

  function applyOverrides(params, o) {
    Object.keys(o || {}).forEach(function(k){
      if (params[k]) params[k].value = o[k];
    });
  }

  // --------------------------------------------------------------
  // Learning: EMA tuning from observations the user (or connected
  // data sources) feeds us. Each observation is { param, value, weight }.
  // --------------------------------------------------------------
  function observe(state, obs) {
    var p = state.params[obs.param];
    if (!p) return state;
    var w = obs.weight || 1;
    var alpha = w / (p.weight + w);
    p.value = p.value * (1 - alpha) + obs.value * alpha;
    p.weight += w;
    // Narrow the spread as confidence grows.
    p.spread = Math.max(p.spread * 0.9, p.prior * 0.05);
    return state;
  }

  // Learn from a user-confirmed profile — e.g. price tier maps to avgTicket.
  function learnFromProfile(state, profile) {
    var p = (profile.priceTier && profile.priceTier.value) || 'mid';
    var priceMap = { budget: 22, mid: 55, premium: 120 };
    observe(state, { param: 'avgTicket', value: priceMap[p] || 55, weight: 1 });

    var persona = profile.persona && profile.persona.value;
    if (persona === 'klaus') {
      observe(state, { param: 'avgTicket', value: 480, weight: 2 });
      observe(state, { param: 'newPerWeek', value: 30, weight: 2 });
      observe(state, { param: 'fixedMonthly', value: 24000, weight: 2 });
      observe(state, { param: 'adminHoursPerWeek', value: 30, weight: 2 });
    } else if (persona === 'franka') {
      observe(state, { param: 'avgTicket', value: 2200, weight: 2 });
      observe(state, { param: 'newPerWeek', value: 1, weight: 2 });
      observe(state, { param: 'fixedMonthly', value: 6500, weight: 2 });
    } else if (persona === 'nadia') {
      observe(state, { param: 'avgTicket', value: 9, weight: 2 });
      observe(state, { param: 'newPerWeek', value: 220, weight: 2 });
      observe(state, { param: 'fixedMonthly', value: 9000, weight: 2 });
      observe(state, { param: 'variableCost', value: 0.4, weight: 2 });
    }
    return state;
  }

  // Connecting a tool bumps sharpness + shrinks spread on the related params.
  function learnFromConnection(state, key) {
    var map = {
      stripe:    ['avgTicket', 'variableCost'],
      bank:      ['fixedMonthly', 'cacEuros'],
      calendar:  ['hoursPerWeek', 'hoursPerCustomer'],
      gmail:     ['adminHoursPerWeek'],
      insta:     ['newPerWeek'],
      pos:       ['avgTicket', 'variableCost'],
    };
    (map[key] || []).forEach(function(pname){
      var p = state.params[pname];
      if (!p) return;
      p.weight += 2;
      p.spread = Math.max(p.spread * 0.6, p.prior * 0.05);
    });
    return state;
  }

  // Produce a short JSON summary the AI/UI can use for narration/nudges.
  function summary(state) {
    var history = state.history;
    var last = history[history.length - 1] || {};
    var cashIn12mo = forecast(state, 52).stocks.cash;
    return {
      cash: Math.round(state.stocks.cash),
      customers: Math.round(state.stocks.customers),
      capacity: Math.round((state.stocks.capacity || 0) * 100) / 100,
      lastWeekRevenue: Math.round(last.revenue || 0),
      lastWeekProfit: Math.round(last.profit || 0),
      cash12mo: Math.round(cashIn12mo),
      sharpness: sharpness(state),
    };
  }

  // Sharpness = 1 − avg(normalized spread). When every param has collapsed
  // around a confident estimate, we're sharp. Stays ≤ 1.
  function sharpness(state) {
    var ks = Object.keys(state.params);
    var sum = 0;
    ks.forEach(function(k){
      var p = state.params[k];
      var norm = p.spread / Math.max(0.01, Math.abs(p.prior));
      sum += Math.max(0, 1 - Math.min(1, norm));
    });
    return Math.round((sum / ks.length) * 100) / 100;
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  // A canned scenario pack: the 4 the design shows. Each returns a simulation
  // outcome that the scenarios view can render.
  function runScenario(state, goal, knobs) {
    var overrides = {};
    if (goal === 'grow')       overrides.newPerWeek = state.params.newPerWeek.value * 1.25;
    if (goal === 'stabilize')  overrides.retention  = Math.min(0.95, state.params.retention.value + 0.1);
    if (goal === 'move')       overrides.fixedMonthly = state.params.fixedMonthly.value * (1 - ((knobs && knobs.rentDelta) || -0.15));
    if (goal === 'hire')       overrides.hoursPerWeek = state.params.hoursPerWeek.value * 1.6;

    if (knobs) Object.keys(knobs).forEach(function(k){ if (state.params[k]) overrides[k] = knobs[k]; });

    var fc = forecast(state, 52, overrides);
    var baseline = forecast(state, 52);
    var delta = fc.stocks.cash - baseline.stocks.cash;
    var breakeven = 0;
    for (var i = 0; i < fc.history.length; i++) {
      if (fc.history[i].profit > 0) { breakeven = Math.floor(i / 4.33) + 1; break; }
    }
    return {
      goal: goal,
      cash12mo: Math.round(delta),
      breakeven: breakeven || null,
      confidence: Math.round((0.3 + sharpness(state) * 0.6) * 100) / 100,
      history: fc.history.slice(-52).map(function(h){ return Math.round(h.cash); }),
    };
  }

  return {
    newState: newState,
    step: step,
    forecast: forecast,
    observe: observe,
    learnFromProfile: learnFromProfile,
    learnFromConnection: learnFromConnection,
    summary: summary,
    sharpness: sharpness,
    runScenario: runScenario,
  };
})();

if (typeof module !== 'undefined') module.exports = Sim;
