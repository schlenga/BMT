// store.js — persistence layer for BMT.
// Single canonical state object in localStorage under one key. Everything else
// reads/writes through here so the rest of the app can stay declarative.
'use strict';

var Store = (function() {
  var KEY = 'bmt.v2.state';

  // The one schema everything else agrees on.
  // This schema is the contract between onboarding, the cockpit, and the
  // simulation engine. Keep it flat and JSON-friendly.
  function defaultState() {
    return {
      version: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Stage 1 — auth
      auth: {
        phone: null,
        verified: false,
        backup: null,   // 'phone2' | 'code' | 'trusted-person'
      },

      // Stage 2 — the workbench (context inbox, never "finishes")
      bench: [], // [{ kind, value, addedAt, label }]

      // Stage 3-4 — AI extrapolation + user corrections
      // Confidence lets the UI speak in "we think / we're not sure" language.
      profile: {
        persona: null,  // 'lina' | 'klaus' | 'franka' | 'nadia' | null
        businessType: null,
        location: null,
        priceTier: null,
        customers: null,
        staff: null,
        confidence: {}, // { field: 0..1 }
        whys: {},       // { field: 'short reason' }
      },

      // Stage 6 — connections
      connections: {
        // each: { status: 'off'|'on', sharpness: number, lastSeen: ts, suggested: bool }
      },
      sharpness: 0.42, // 0..1, recomputed by simulation

      // Stage 7 — persona cockpit preferences
      cockpit: {
        variant: null,  // overrides profile.persona if user chose one manually
        loudness: 'ambient', // 'silent'|'ambient'|'nudges'|'panel'
      },

      // Stage 8 — COO state + hypotheses (the secret lean-startup goal)
      hypotheses: [], // [{ id, question, metric, status, target, actuals[], createdAt }]
      nudges: [],     // [{ id, kind, copy, confidence, createdAt, dismissedAt }]

      // Stage 9 — scenarios
      scenarios: [],  // [{ id, goal, params, result, createdAt }]

      // Simulation state — what the abstract model has learned so far
      sim: {
        params: {},     // numeric + categorical params the engine tunes over time
        observations: [], // [{ t, signal, value }]
        lastTunedAt: 0,
      },
    };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      // Light migration guardrail
      if (!s || s.version !== 2) return defaultState();
      return s;
    } catch (e) {
      return defaultState();
    }
  }

  function write(s) {
    s.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  var cached = null;
  function get() { if (!cached) cached = read(); return cached; }
  function set(updater) {
    var s = get();
    if (typeof updater === 'function') updater(s); else Object.assign(s, updater);
    cached = write(s);
    emit('change', cached);
    return cached;
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    cached = defaultState();
    emit('change', cached);
    return cached;
  }

  // Pub/sub so views re-render without global coupling
  var listeners = {};
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return function off() { listeners[evt] = listeners[evt].filter(function(f){return f!==fn;}); };
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function(fn){ try { fn(payload); } catch(e){} });
  }

  // Convenience: which persona are we showing the cockpit as?
  function activePersona() {
    var s = get();
    return s.cockpit.variant || s.profile.persona || 'lina';
  }

  return { get: get, set: set, reset: reset, on: on, activePersona: activePersona };
})();

if (typeof module !== 'undefined') module.exports = Store;
