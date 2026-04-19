// app.js — router, navigation, top-level wiring.
//
// The design is a sequence (land → bench → extrapolate → confirm → cockpit)
// plus four branches available from the top bar (connect, react, coo,
// scenarios). The router is a tiny state machine over these 9 stages.
'use strict';

var App = (function(){

  // Readable stage names the UI uses.
  var STAGES = {
    land: 'view-land',
    bench: 'view-bench',
    extrapolate: 'view-extrapolate',
    confirm: 'view-confirm',
    cockpit: 'view-cockpit',
    connect: 'view-connect',
    react: 'view-react',
    coo: 'view-coo',
    scenarios: 'view-scenarios',
  };

  function go(stage) {
    Object.keys(STAGES).forEach(function(k){
      var el = document.getElementById(STAGES[k]);
      if (el) el.classList.toggle('active', k === stage);
    });

    // Top chrome is hidden during onboarding (stages 1-4).
    var isOnboarding = (stage === 'land' || stage === 'bench' || stage === 'extrapolate' || stage === 'confirm');
    document.getElementById('topbar').style.display = isOnboarding ? 'none' : 'flex';
    document.getElementById('persona-strip').style.display = isOnboarding ? 'none' : 'flex';
    document.getElementById('crumb-ai').textContent = AI.isOnline() ? 'ai: online' : 'ai: offline (local fallback)';

    // Stage-specific init
    try {
      switch (stage) {
        case 'land':        Onboarding.initAuth(function(){ go('bench'); }); break;
        case 'bench':       Onboarding.initBench(function(){ go('extrapolate'); }); break;
        case 'extrapolate': Onboarding.runExtrapolate(function(){ go('confirm'); }); break;
        case 'confirm':     Onboarding.initConfirm(function(){ go('cockpit'); }); break;
        case 'cockpit':     Cockpit.render(); break;
        case 'connect':     Connect.render(); break;
        case 'react':       Shocks.render(); break;
        case 'coo':         COO.render(); break;
        case 'scenarios':   Scenarios.render(); break;
      }
    } catch (e) {
      console.error('[app] stage init failed:', stage, e);
    }

    if (location.hash.slice(1) !== stage) {
      history.replaceState(null, '', '#' + stage);
    }
    window.scrollTo(0, 0);
  }

  // Expose the sim re-learn for onboarding completion.
  function learnProfileIntoSim() {
    window.__simState = null; // force rebuild from profile
    Cockpit.simState();
    Store.set(function(s){ s.sharpness = Sim.sharpness(Cockpit.simState()); });
  }

  function start() {
    // Top-bar nav
    document.querySelectorAll('[data-nav]').forEach(function(b){
      b.onclick = function(){ go(b.dataset.nav); };
    });

    // Dev persona strip (active for prototype convenience)
    document.querySelectorAll('#persona-strip .tab').forEach(function(t){
      t.onclick = function(){
        document.querySelectorAll('#persona-strip .tab').forEach(function(x){ x.classList.toggle('active', x === t); });
        Store.set(function(s){ s.cockpit.variant = t.dataset.persona; });
        if (document.getElementById('view-cockpit').classList.contains('active')) Cockpit.render();
      };
    });

    document.getElementById('reset-btn').onclick = function(){
      if (!confirm('Wipe everything and start from the landing page?')) return;
      Store.reset();
      window.__simState = null;
      location.hash = '';
      go('land');
    };

    // Route from hash (for dev convenience) — but only if the user is
    // already authenticated. Otherwise force them through the door.
    var hash = location.hash.slice(1);
    var state = Store.get();
    var start = 'land';
    if (state.auth.verified) {
      start = STAGES[hash] ? hash : (state.profile.persona ? 'cockpit' : 'bench');
    }
    go(start);

    // Keep a few things reactive
    Store.on('change', function(s){
      var chip = document.getElementById('crumb-ai');
      if (chip) chip.textContent = AI.isOnline() ? 'ai: online' : 'ai: offline (local fallback)';
    });

    // If you want live AI, set your proxy URL here:
    // AI.setProxy('https://bmt-proxy.<your-subdomain>.workers.dev/v1/messages');
  }

  document.addEventListener('DOMContentLoaded', start);

  return { go: go, learnProfileIntoSim: learnProfileIntoSim };
})();
