// tests/helpers/load.js — minimal sandbox loader for BMT v2 IIFE modules.
//
// The v2 modules are vanilla browser scripts (no CommonJS). They expect a few
// browser globals (localStorage, fetch, document, setTimeout). This helper
// evaluates each module file in a controlled scope so we can assert on the
// returned IIFE namespace without spinning up jsdom.
//
// Pattern lifted from archive/v1/tests/setup.js — same idea, retargeted at
// the v2 module list and at node:test instead of jest.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

const MODULE_FILES = {
  Store:      'store.js',
  AI:         'ai.js',
  Sim:        'simulation.js',
  Onboarding: 'onboarding.js',
  Cockpit:    'cockpit.js',
  Connect:    'connect.js',
  Shocks:     'shocks.js',
  COO:        'coo.js',
  Scenarios:  'scenarios.js',
  App:        'app.js',
};

// Minimal localStorage polyfill — what Store needs.
function makeLocalStorage() {
  const data = new Map();
  return {
    getItem(k) { return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { data.set(k, String(v)); },
    removeItem(k) { data.delete(k); },
    clear() { data.clear(); },
    get length() { return data.size; },
    key(i) { return Array.from(data.keys())[i] || null; },
  };
}

// Minimal document/window stubs — only the bits store/sim/ai/onboarding poke.
function makeDom() {
  const elements = new Map();
  function el(tag) {
    return {
      tagName: tag.toUpperCase(),
      style: { setProperty(){}, getPropertyValue(){ return ''; } },
      dataset: {},
      classList: {
        _set: new Set(),
        add(c){ this._set.add(c); },
        remove(c){ this._set.delete(c); },
        toggle(c, on){ if (on) this._set.add(c); else this._set.delete(c); },
        contains(c){ return this._set.has(c); },
      },
      children: [],
      childNodes: [],
      addEventListener(){},
      removeEventListener(){},
      appendChild(c){ this.children.push(c); return c; },
      removeChild(c){ this.children = this.children.filter(x => x !== c); return c; },
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      setAttribute(k,v){ this[k] = v; },
      getAttribute(k){ return this[k]; },
      focus(){},
      click(){},
      innerHTML: '',
      textContent: '',
      value: '',
    };
  }
  const doc = {
    documentElement: el('html'),
    body: el('body'),
    head: el('head'),
    createElement: el,
    createTextNode(t){ return { nodeValue: t }; },
    getElementById(id){ return elements.get(id) || null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){},
    removeEventListener(){},
    _register(id, e){ elements.set(id, e); return e; },
  };
  return doc;
}

function makeContext({ fetchImpl } = {}) {
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Object, Array, String, Number, Boolean, Error,
    Promise, RegExp, Map, Set, Symbol,
    URL, Blob: class Blob{}, FileReader: class FileReader{},
    AbortController: typeof AbortController === 'function' ? AbortController : class { constructor(){ this.signal={}; } abort(){} },
    fetch: fetchImpl || (() => Promise.reject(new Error('no fetch in test'))),
    localStorage: makeLocalStorage(),
    document: makeDom(),
    confirm: () => true,
    prompt: () => null,
    alert: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  return sandbox;
}

// Load one or more named modules into a fresh context. Order matters because
// later modules sometimes reference earlier IIFE namespaces (Cockpit needs
// Sim, Onboarding, etc.). We pass them in dependency order.
function loadModules(names, opts = {}) {
  const ctx = makeContext(opts);
  const ordered = LOAD_ORDER.filter(n => names.includes(n));
  if (ordered.length !== names.length) {
    const missing = names.filter(n => !LOAD_ORDER.includes(n));
    if (missing.length) throw new Error('Unknown module(s): ' + missing.join(', '));
  }
  for (const name of ordered) {
    const file = MODULE_FILES[name];
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(src, ctx, { filename: file });
  }
  return ctx;
}

const LOAD_ORDER = ['Store','AI','Sim','Onboarding','Cockpit','Connect','Shocks','COO','Scenarios','App'];

module.exports = {
  ROOT,
  MODULE_FILES,
  LOAD_ORDER,
  loadModules,
  makeContext,
};
