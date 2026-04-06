/**
 * Test setup helper — loads BMT's vanilla JS IIFE modules into the jsdom global scope.
 */
const fs = require('fs');
const path = require('path');

const MODULE_FILES = {
  store: 'store.js',
  ai: 'ai.js',
  prompts: 'prompts.js',
  canvas: 'canvas.js',
  tracker: 'tracker.js',
  wizard: 'wizard.js',
  app: 'app.js'
};

const LOAD_ORDER = ['store', 'ai', 'prompts', 'canvas', 'tracker', 'wizard', 'app'];

const MODULE_GLOBALS = {
  store: 'Store',
  ai: 'AI',
  prompts: 'Prompts',
  canvas: 'Canvas',
  tracker: 'Tracker',
  wizard: 'Wizard',
  app: 'App'
};

function loadModules(modules) {
  const sorted = modules.slice().sort(
    (a, b) => LOAD_ORDER.indexOf(a) - LOAD_ORDER.indexOf(b)
  );

  for (const mod of sorted) {
    const file = MODULE_FILES[mod];
    if (!file) throw new Error('Unknown module: ' + mod);
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const globalName = MODULE_GLOBALS[mod];

    // Build list of dependency globals already loaded
    const depNames = sorted
      .filter(m => LOAD_ORDER.indexOf(m) < LOAD_ORDER.indexOf(mod))
      .map(m => MODULE_GLOBALS[m]);

    const depValues = depNames.map(m => global[m]);

    const fn = new Function(
      'window', 'document', 'localStorage', 'fetch', 'AbortController',
      'setTimeout', 'clearTimeout', 'confirm', 'prompt', 'alert',
      'URL', 'Blob', 'FileReader',
      ...depNames,
      code + '\nreturn ' + globalName + ';'
    );

    const result = fn(
      global.window || global,
      global.document,
      global.localStorage,
      global.fetch || function() { return Promise.reject(new Error('no fetch')); },
      global.AbortController || class AbortController { constructor() { this.signal = {}; } abort() {} },
      global.setTimeout,
      global.clearTimeout,
      global.confirm || function() { return true; },
      global.prompt || function() { return null; },
      global.alert || function() {},
      global.URL,
      global.Blob,
      global.FileReader,
      ...depValues
    );

    global[globalName] = result;
  }
}

function resetLocalStorage() {
  localStorage.clear();
}

function setupDOM() {
  document.body.innerHTML = '<div id="app"></div>';
}

module.exports = { loadModules, resetLocalStorage, setupDOM };
