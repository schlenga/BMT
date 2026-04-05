// store.js — localStorage persistence layer for BMT
'use strict';

var Store = (function() {
  var KEYS = {
    business: 'bmt_business',
    canvas: 'bmt_canvas',
    hypotheses: 'bmt_hypotheses',
    wizardComplete: 'bmt_wizard_complete'
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  // Business
  function getBusiness() { return get(KEYS.business); }
  function saveBusiness(biz) { set(KEYS.business, biz); }

  // Canvas
  function getCanvas() {
    return get(KEYS.canvas) || defaultCanvas();
  }
  function saveCanvas(canvas) { set(KEYS.canvas, canvas); }

  function defaultCanvas() {
    return {
      customerSegments: [],
      valueProp: [],
      channels: [],
      customerRelationships: [],
      revenueStreams: [],
      keyResources: [],
      keyActivities: [],
      keyPartners: [],
      costStructure: []
    };
  }

  // Add item to a canvas element
  function addCanvasItem(element, text) {
    var canvas = getCanvas();
    if (!canvas[element]) canvas[element] = [];
    var item = { id: uid(), text: text, notes: '' };
    canvas[element].push(item);
    saveCanvas(canvas);
    return item;
  }

  function updateCanvasItem(element, id, text) {
    var canvas = getCanvas();
    if (!canvas[element]) return;
    for (var i = 0; i < canvas[element].length; i++) {
      if (canvas[element][i].id === id) {
        canvas[element][i].text = text;
        break;
      }
    }
    saveCanvas(canvas);
  }

  function removeCanvasItem(element, id) {
    var canvas = getCanvas();
    if (!canvas[element]) return;
    canvas[element] = canvas[element].filter(function(item) { return item.id !== id; });
    saveCanvas(canvas);
  }

  // Hypotheses
  function getHypotheses() { return get(KEYS.hypotheses) || []; }
  function saveHypotheses(hyps) { set(KEYS.hypotheses, hyps); }

  function addHypothesis(hyp) {
    var hyps = getHypotheses();
    hyp.id = hyp.id || uid();
    hyp.createdAt = hyp.createdAt || new Date().toISOString().slice(0, 10);
    hyp.status = hyp.status || 'testing';
    hyp.actuals = hyp.actuals || [];
    hyps.push(hyp);
    saveHypotheses(hyps);
    return hyp;
  }

  function updateHypothesis(id, updates) {
    var hyps = getHypotheses();
    for (var i = 0; i < hyps.length; i++) {
      if (hyps[i].id === id) {
        for (var k in updates) {
          if (updates.hasOwnProperty(k)) hyps[i][k] = updates[k];
        }
        break;
      }
    }
    saveHypotheses(hyps);
  }

  function removeHypothesis(id) {
    var hyps = getHypotheses().filter(function(h) { return h.id !== id; });
    saveHypotheses(hyps);
  }

  function addActual(hypId, actual) {
    var hyps = getHypotheses();
    for (var i = 0; i < hyps.length; i++) {
      if (hyps[i].id === hypId) {
        actual.date = actual.date || new Date().toISOString().slice(0, 10);
        hyps[i].actuals.push(actual);
        break;
      }
    }
    saveHypotheses(hyps);
  }

  // Wizard
  function isWizardComplete() { return get(KEYS.wizardComplete) === true; }
  function setWizardComplete() { set(KEYS.wizardComplete, true); }

  // Export / Import
  function exportAll() {
    return JSON.stringify({
      business: getBusiness(),
      canvas: getCanvas(),
      hypotheses: getHypotheses(),
      wizardComplete: isWizardComplete(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  function importAll(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (data.business) saveBusiness(data.business);
      if (data.canvas) saveCanvas(data.canvas);
      if (data.hypotheses) saveHypotheses(data.hypotheses);
      if (data.wizardComplete) setWizardComplete();
      return true;
    } catch(e) { return false; }
  }

  function resetAll() {
    Object.keys(KEYS).forEach(function(k) {
      localStorage.removeItem(KEYS[k]);
    });
  }

  return {
    uid: uid,
    getBusiness: getBusiness,
    saveBusiness: saveBusiness,
    getCanvas: getCanvas,
    saveCanvas: saveCanvas,
    addCanvasItem: addCanvasItem,
    updateCanvasItem: updateCanvasItem,
    removeCanvasItem: removeCanvasItem,
    getHypotheses: getHypotheses,
    saveHypotheses: saveHypotheses,
    addHypothesis: addHypothesis,
    updateHypothesis: updateHypothesis,
    removeHypothesis: removeHypothesis,
    addActual: addActual,
    isWizardComplete: isWizardComplete,
    setWizardComplete: setWizardComplete,
    exportAll: exportAll,
    importAll: importAll,
    resetAll: resetAll
  };
})();
