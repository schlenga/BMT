// scenarios.js — stage 09 · grow / stabilize / move / hire.
//
// Three entry points into the same simulation engine:
//   A · goal picker (reshape cockpit around a goal)
//   B · sandbox (sliders + watch simulated outcome)
//   C · COO-initiated (a nudge that opens a pre-framed sim)
'use strict';

var Scenarios = (function(){

  var GOALS = [
    { key: 'grow',       icon: '🌱', title: 'Grow',           sub: 'more revenue, same shop' },
    { key: 'stabilize',  icon: '⚖️', title: 'Stabilize',       sub: 'smoother cashflow' },
    { key: 'move',       icon: '📦', title: 'Move / relocate', sub: 'change location' },
    { key: 'hire',       icon: '👥', title: 'Hire',            sub: 'add staff' },
  ];

  function render() {
    var state = Store.get();

    // --- A · goal picker ---
    var goalsEl = document.getElementById('scenario-goals');
    goalsEl.innerHTML = GOALS.map(function(g, i){
      var sel = (state.scenarios[0] && state.scenarios[0].goal === g.key) || (!state.scenarios.length && i === 0);
      return '<div class="scenario '+(sel?'selected':'')+'" data-goal="'+g.key+'">' +
        '<h4>'+g.icon+' '+escapeHtml(g.title)+'</h4>' +
        '<div class="mono">'+escapeHtml(g.sub)+'</div>' +
      '</div>';
    }).join('');
    goalsEl.querySelectorAll('[data-goal]').forEach(function(el){
      el.onclick = function(){
        var goal = el.dataset.goal;
        var out = Sim.runScenario(Cockpit.simState(), goal);
        Store.set(function(s){ s.scenarios.unshift({ id:'sc_'+Date.now(), goal: goal, params: {}, result: out, createdAt: Date.now() }); });
        AI.narrateScenario(goal, out).then(function(n){ Onboarding.toast(n.data); });
        render();
      };
    });

    // --- B · sandbox ---
    var sandbox = document.getElementById('scenario-sandbox');
    sandbox.innerHTML =
      '<div class="hand" style="font-size:20px;">If we moved to Neukölln…</div>' +
      '<div class="mono" style="margin-bottom:8px;">simulation · 18 months</div>' +
      slider('rentDelta', 'rent change %', -30, 30, 0) +
      slider('priceDelta', 'price change %', -20, 20, 0) +
      slider('trafficDelta', 'foot traffic %', -30, 50, 0) +
      '<hr class="divider" />' +
      '<div class="grid2">' +
        '<div class="kpi"><div class="label">cash in 12mo</div><div class="val" id="sb-cash">—</div><div class="delta" id="sb-cash-delta">vs staying</div></div>' +
        '<div class="kpi"><div class="label">break-even</div><div class="val" id="sb-be">—</div><div class="delta">median</div></div>' +
      '</div>' +
      '<div class="chart" id="sb-chart"></div>' +
      '<div class="narration" id="sb-narration" style="margin-top:6px;"></div>' +
      '<div class="uncertain" id="sb-conf" style="margin-top:6px;"></div>';

    function recompute() {
      var params = {};
      var rentDelta = Number(sandbox.querySelector('[name=rentDelta]').value) / 100;
      var priceDelta = Number(sandbox.querySelector('[name=priceDelta]').value) / 100;
      var trafficDelta = Number(sandbox.querySelector('[name=trafficDelta]').value) / 100;
      var sim = Cockpit.simState();
      params.fixedMonthly = sim.params.fixedMonthly.value * (1 + rentDelta);
      params.avgTicket    = sim.params.avgTicket.value * (1 + priceDelta);
      params.newPerWeek   = sim.params.newPerWeek.value * (1 + trafficDelta);
      var out = Sim.runScenario(sim, 'move', params);
      document.getElementById('sb-cash').textContent = (out.cash12mo >= 0 ? '+€' : '−€') + Math.abs(out.cash12mo).toLocaleString();
      document.getElementById('sb-be').textContent = out.breakeven ? 'mo ' + out.breakeven : '—';
      document.getElementById('sb-chart').innerHTML = miniSparkline(out.history);
      document.getElementById('sb-conf').textContent = 'confidence: ' + AI.confidenceLabel(out.confidence) + ' · sharpness is still climbing';
      // Narrate
      AI.narrateScenario('move', out).then(function(n){
        document.getElementById('sb-narration').textContent = '"' + n.data + '"';
      });
    }
    sandbox.querySelectorAll('input[type=range]').forEach(function(r){
      r.addEventListener('input', recompute);
    });
    recompute();

    // --- C · COO-initiated ---
    var c = document.getElementById('scenario-coo');
    c.innerHTML =
      '<div class="nudge" style="margin-bottom:10px;">' +
        '<div class="mono">📣 your COO suggests</div>' +
        '<div class="hand" style="font-size:18px;">You\'ve been at 90%+ capacity 8 weeks straight. Want to explore hiring a 3rd stylist?</div>' +
        '<div class="row" style="gap:6px; margin-top:6px;">' +
          '<button class="btn accent small" data-coo-scen="hire">Explore →</button>' +
          '<button class="btn small">Not now</button>' +
        '</div>' +
      '</div>' +
      '<div class="hand" style="font-size:18px; margin:10px 0 4px;">Side-by-side paths</div>' +
      '<div class="grid2">' +
        '<div class="scenario" data-coo-scen="hire"><h4>Hire</h4><div class="mono">+€2.1k/mo · risk: med</div></div>' +
        '<div class="scenario" data-coo-scen="grow"><h4>Raise prices 8%</h4><div class="mono">+€1.4k/mo · risk: low</div></div>' +
      '</div>' +
      '<div class="mono" style="margin-top:10px;">each card opens a full sim</div>';
    c.querySelectorAll('[data-coo-scen]').forEach(function(el){
      el.onclick = function(){
        var goal = el.dataset.cooScen;
        var out = Sim.runScenario(Cockpit.simState(), goal);
        Store.set(function(s){ s.scenarios.unshift({ id:'sc_'+Date.now(), goal: goal, params: {}, result: out, createdAt: Date.now() }); });
        AI.narrateScenario(goal, out).then(function(n){ Onboarding.toast(n.data); });
      };
    });
  }

  function slider(name, label, min, max, val) {
    return '<label class="mono" style="display:block; margin-top:6px;">'+escapeHtml(label)+' <input type="range" name="'+name+'" min="'+min+'" max="'+max+'" value="'+val+'" style="width:100%;" /></label>';
  }

  function miniSparkline(values) {
    if (!values || !values.length) return '';
    var max = Math.max.apply(null, values);
    var min = Math.min.apply(null, values);
    var w = 400, h = 70;
    var pts = values.map(function(v, i){
      var x = (i / (values.length - 1)) * w;
      var y = h - ((v - min) / (max - min || 1)) * (h - 10) - 5;
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><polyline class="line" style="fill:none; stroke:var(--ink); stroke-width:2" points="'+pts+'"/></svg>';
  }

  function escapeHtml(s) { return Onboarding.escapeHtml(s); }

  return { render: render };
})();
