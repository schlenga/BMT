// cockpit.js — stages 05 (materialize) + 07 (persona cockpits).
//
// The cockpit is the home base. Four personas, four visual moods, one engine.
// We render the *same data* differently per persona — density, tone, primary
// surface. Ghost modules (dashed, pale) show where more data would sharpen us.
'use strict';

var Cockpit = (function(){

  function render() {
    var state = Store.get();
    var persona = Store.activePersona();
    var body = document.getElementById('cockpit-body');
    body.className = 'cockpit cockpit-' + persona + ' sketch';

    // Greeting + sharpness header
    document.getElementById('cockpit-greet').textContent = AI.greet(state.profile);
    var sharp = Math.round((state.sharpness || Sim.sharpness(simState())) * 100);
    document.getElementById('cockpit-sharpness').textContent = sharp + '%';
    document.getElementById('cockpit-sharpness-fill').style.width = sharp + '%';

    // Persona tabs
    document.querySelectorAll('#cockpit-tabs .tab').forEach(function(t){
      t.classList.toggle('active', t.dataset.persona === persona);
      t.onclick = function(){
        Store.set(function(s){ s.cockpit.variant = t.dataset.persona; });
        render();
      };
    });

    body.innerHTML = VIEWS[persona]();
    wireCockpitButtons(persona);
  }

  // Keep a single sim instance per render, learning from profile.
  function simState() {
    // We keep the sim state on window (in-memory) — it's derived, not
    // persisted — because the parameters are reconstructed each session
    // from the confirmed profile + connections.
    if (!window.__simState) {
      window.__simState = Sim.newState();
      Sim.learnFromProfile(window.__simState, profileAsGuesses(Store.get().profile));
      Object.keys(Store.get().connections).forEach(function(k){
        if (Store.get().connections[k].status === 'on') Sim.learnFromConnection(window.__simState, k);
      });
      for (var i = 0; i < 12; i++) Sim.step(window.__simState);
    }
    return window.__simState;
  }

  function refreshSim() {
    window.__simState = null;
    var s = simState();
    Store.set(function(st){ st.sharpness = Sim.sharpness(s); });
  }

  function profileAsGuesses(profile) {
    var out = {};
    ['persona','businessType','location','priceTier','customers','staff'].forEach(function(k){
      out[k] = { value: profile[k], confidence: profile.confidence[k] || 0.5, why: profile.whys[k] || '' };
    });
    return out;
  }

  // ----------- Persona views ------------
  var VIEWS = {
    lina: function() {
      var sim = Sim.summary(simState());
      return renderHeader('Hey Lina 💇‍♀️', 'warm · big type · insta-native') +
        grid3(
          kpi('Today\'s chair', '7 clients', '2 slots: 14:00 · 17:30'),
          module('Ready to text 💬', '<div class="hand" style="font-size:18px;">3 regulars overdue</div><div class="mono">one-tap voice note template</div>'),
          module('Reels that worked', '<div class="chart"></div><div class="mono">tues 18:00 posts = 2× saves</div>')
        ) +
        nudge('📣 ambient nudge · plain words',
          'You made <span class="hl">€' + (sim.lastWeekRevenue || 1840) + ' this week</span>. Want me to put the extra aside for your tax friend?',
          'draft-tax-put-aside'
        ) +
        ghostRow([
          ghostModule('Cashflow', 'connect bank →', 'bank'),
          ghostModule('Reviews', 'waiting for Google link', 'gmap'),
        ]) +
        tagRow(['no spreadsheets shown · ever','tax-speak hidden','primary surface: mobile']);
    },

    klaus: function() {
      return renderHeader('Dispatch · ' + new Date().toLocaleDateString('en', {weekday:'short'}),
        'green · big rows · keyboard shortcuts · son-setup mode') +
        '<div class="sketch" style="padding:10px; margin-top:8px;">' +
          '<div class="mono">4 vans · 8 jobs today</div>' +
          '<div class="col" style="gap:4px; margin-top:6px; font-size:13px;">' +
            row('🚐 Van 1 · Thomas', 'Köln-Süd · boiler · 08:00') +
            row('🚐 Van 2 · Ayşe', 'Ehrenfeld · leak · 08:30') +
            row('🚐 Van 3 · Paul', 'new-build site · all day') +
            row('🚐 Van 4 · free', '→ reassign?') +
          '</div>' +
        '</div>' +
        grid3(
          module('Inbox', '<div class="hand" style="font-size:22px;">14 emails</div><div class="mono">11 auto-drafted · review &amp; send</div>'),
          module('Quotes out', '<div class="hand" style="font-size:22px;">€18.4k</div><div class="mono">3 waiting · nudge today?</div>'),
          module('Parts low', '<div class="hand" style="font-size:18px;">copper pipe 22mm</div><div class="mono">auto-order from Würth?</div>')
        ) +
        nudge('⚡ dispatcher\'s helper',
          'Van 4 is free. The Dellbrück job is 12 min from Paul\'s site — he could take it if you want him back by 16:00.',
          'dispatch-van4') +
        tagRow(['keyboard shortcut per screen','"press J to dispatch"','primary surface: desktop']);
    },

    franka: function() {
      return renderHeader('Good morning Franka — 2 things.', 'slate · minimal · ⌘K everywhere') +
        '<div class="col" style="gap:8px; margin-top:10px;">' +
          '<div class="module"><div class="mono">today · 1 of 2</div><div class="hand" style="font-size:18px;">Send the Acme proposal (draft ready, 3 min review)</div></div>' +
          '<div class="module"><div class="mono">today · 2 of 2</div><div class="hand" style="font-size:18px;">Approve Q2 invoice batch (€12.4k · 6 clients)</div></div>' +
        '</div>' +
        grid3(
          kpi('Billable this wk', '28h', 'of 32 target'),
          kpi('Runway', '5.2mo', 'stable'),
          kpi('Overdue', '€2.1k', 'chased today')
        ) +
        nudge('💡 coach',
          'Your last 3 proposals were scoped 40% under final hours. Want me to add a "scoping buffer" to the Acme draft?',
          'scoping-buffer') +
        tagRow(['max 2-3 items on screen','drafts instead of forms','primary surface: desktop, keyboard']);
    },

    nadia: function() {
      return renderHeader('Café · right now · ' + new Date().toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}),
        'cream · one-glance · no depth') +
        grid3(
          kpi('Till today', '€612', 'on pace'),
          kpi('Staff covered', '✓', 'no gaps this wk'),
          kpi('1 nudge', '🥐', 'order croissants by 3pm')
        ) +
        '<div class="sketch" style="padding:10px 14px; margin-top:10px;">' +
          '<div class="hand" style="font-size:20px;">Today\'s one thing:</div>' +
          '<div style="font-size:14px;">Approve the croissant order — Lena said we\'ll run out Sat.</div>' +
          '<div class="row" style="gap:6px; margin-top:6px;">' +
            '<button class="btn accent" data-cockpit-act="approve-croissant">Approve</button>' +
            '<button class="btn" data-cockpit-act="ask-lena">Ask Lena</button>' +
          '</div>' +
        '</div>' +
        '<div class="mono" style="margin-top:12px; text-align:center;">if nothing is urgent, this screen says "all good" · and that\'s it</div>' +
        tagRow(['≤1 decision per day','"all good" is a valid screen','primary surface: tablet on counter']);
    },
  };

  function renderHeader(title, mood) {
    return '<div class="spread"><div class="hand" style="font-size:22px;">'+escapeHtml(title)+'</div><div class="mono">'+escapeHtml(mood)+'</div></div>';
  }
  function module(title, body) {
    return '<div class="module"><h5>'+escapeHtml(title)+'</h5>'+body+'</div>';
  }
  function ghostModule(title, hint, connectionKey) {
    return '<div class="module ghost"><h5>'+escapeHtml(title)+'</h5><div class="mono">'+escapeHtml(hint)+'</div>' +
           '<button class="btn small ghost" data-connect="'+connectionKey+'" style="margin-top:6px;">wire this up</button></div>';
  }
  function kpi(label, val, delta) {
    return '<div class="kpi"><div class="label">'+escapeHtml(label)+'</div><div class="val">'+escapeHtml(val)+'</div><div class="delta">'+escapeHtml(delta)+'</div></div>';
  }
  function nudge(line, body, actKey) {
    return '<div class="nudge" style="margin-top:10px;">' +
      '<div class="mono">'+escapeHtml(line)+'</div>' +
      '<div class="hand" style="font-size:17px; margin-top:2px;">'+body+'</div>' +
      '<div class="row" style="gap:6px; margin-top:6px;">' +
        '<button class="btn accent small" data-nudge-act="'+actKey+'">Let\'s try it</button>' +
        '<button class="btn small" data-nudge-why="'+actKey+'">Why this?</button>' +
        '<button class="btn ghost small" data-nudge-dismiss="'+actKey+'">Later</button>' +
      '</div></div>';
  }
  function ghostRow(mods) {
    return '<div class="grid2" style="margin-top:10px;">' + mods.join('') + '</div>';
  }
  function row(a, b) {
    return '<div class="spread"><span>'+escapeHtml(a)+'</span><span class="mono">'+escapeHtml(b)+'</span></div>';
  }
  function grid3(a, b, c) {
    return '<div class="grid3" style="margin-top:8px;">'+a+b+c+'</div>';
  }
  function tagRow(tags) {
    return '<div class="row" style="gap:6px; margin-top:10px; flex-wrap:wrap;">' +
      tags.map(function(t){ return '<span class="tag">'+escapeHtml(t)+'</span>'; }).join('') +
      '</div>';
  }

  function wireCockpitButtons(persona) {
    document.querySelectorAll('[data-nudge-act]').forEach(function(b){
      b.onclick = function(){
        var key = b.dataset.nudgeAct;
        Store.set(function(s){ s.hypotheses.push(turnNudgeIntoHypothesis(key, persona)); });
        Onboarding.toast('Set up a tiny experiment. I\'ll watch the numbers for 2 weeks.');
      };
    });
    document.querySelectorAll('[data-nudge-why]').forEach(function(b){
      b.onclick = function(){ Onboarding.toast(whyForNudge(b.dataset.nudgeWhy, persona)); };
    });
    document.querySelectorAll('[data-nudge-dismiss]').forEach(function(b){
      b.onclick = function(){ Onboarding.toast('Hidden. I\'ll bring it back if the data changes.'); };
    });
    document.querySelectorAll('[data-connect]').forEach(function(b){
      b.onclick = function(){ App.go('connect'); };
    });
    document.querySelectorAll('[data-cockpit-act]').forEach(function(b){
      b.onclick = function(){ Onboarding.toast('Prototype: action "' + b.dataset.cockpitAct + '" recorded.'); };
    });
  }

  function whyForNudge(key, persona) {
    var whys = {
      'draft-tax-put-aside': 'Your till average jumps ~15% on Tuesdays. I flagged the surplus against your usual tax rate.',
      'dispatch-van4': 'Paul is in Nippes at 11. Dellbrück is 12 min east. Routing logic, not magic.',
      'scoping-buffer': 'Your last 3 proposals ran 40% long. That\'s a pattern, not a blip.',
    };
    return whys[key] || 'I\'m not actually sure — this was a soft hunch.';
  }

  function turnNudgeIntoHypothesis(key, persona) {
    return {
      id: 'h_' + Math.random().toString(36).slice(2, 8),
      question: key,
      status: 'testing',
      target: null,
      actuals: [],
      createdAt: Date.now(),
    };
  }

  function escapeHtml(s) { return Onboarding.escapeHtml(s); }

  return { render: render, refreshSim: refreshSim, simState: simState };
})();
