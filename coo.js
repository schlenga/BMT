// coo.js — stage 08 · always-on COO.
//
// Three surfaces: ambient (woven into modules), proactive (nudge inbox),
// conversational (side panel). User chooses how loud via the volume tabs.
// Every nudge carries a secret Build/Measure/Learn triplet — the lean
// coaching layer the wireframe calls out as "the secret goal".
'use strict';

var COO = (function(){

  function render() {
    var state = Store.get();
    var main = document.getElementById('coo-main');
    var panel = document.getElementById('coo-panel');
    var bml = document.getElementById('coo-bml');

    // Volume tabs
    document.querySelectorAll('[data-loudness]').forEach(function(t){
      t.classList.toggle('active', t.dataset.loudness === state.cockpit.loudness);
      t.onclick = function(){
        Store.set(function(s){ s.cockpit.loudness = t.dataset.loudness; });
        render();
      };
    });

    // Main area — ambient card always, nudges optional
    var sim = Sim.summary(Cockpit.simState());
    var ambientHtml = '<div class="module"><h5>Bookings · next 14 days <span class="tag accent">COO noticed</span></h5>' +
      '<div class="chart">' + miniSparkline(Cockpit.simState().history.slice(-14).map(function(h){return h.revenue||0;})) + '</div>' +
      '<div class="hand" style="font-size:17px; margin-top:6px;">↳ Thursday afternoons are <span class="hl">consistently empty</span>. Try a 15% "quiet hours" promo?</div>' +
      '<div class="row" style="gap:8px; margin-top:6px;">' +
        '<button class="btn accent small" data-coo-act="draft-quiet-hours">Draft it</button>' +
        '<button class="btn small" data-coo-why="quiet-hours">Why?</button>' +
        '<button class="btn small ghost">Later</button>' +
      '</div></div>';

    var mainHtml = ambientHtml;
    var loudness = state.cockpit.loudness;
    if (loudness === 'nudges' || loudness === 'panel') {
      mainHtml += '<div class="row" style="gap:10px; flex-wrap:wrap;" id="coo-nudge-row"></div>';
    }
    main.innerHTML = mainHtml;

    // Nudge row — fetch live nudges (AI or offline fallback)
    if (loudness === 'nudges' || loudness === 'panel') {
      AI.proposeNudges(state, sim).then(function(res){
        var row = document.getElementById('coo-nudge-row');
        if (!row) return;
        row.innerHTML = (res.data || []).map(function(n){
          var hedge = AI.confidenceLabel(n.confidence || 0.5);
          return '<div class="nudge" style="flex:1; min-width:220px;">' +
            '<div class="mono">'+iconFor(n.kind)+' nudge · '+escapeHtml(hedge)+'</div>' +
            '<div>'+escapeHtml(n.copy || '')+'</div>' +
            (n.bml ? '<details style="margin-top:6px;"><summary class="mono">what I\'d actually run</summary>' +
              '<div class="mono">try:</div><div style="font-size:13px;">'+escapeHtml(n.bml.build||'')+'</div>' +
              '<div class="mono">watch:</div><div style="font-size:13px;">'+escapeHtml(n.bml.measure||'')+'</div>' +
              '<div class="mono">then decide:</div><div style="font-size:13px;">'+escapeHtml(n.bml.learn||'')+'</div>' +
              '</details>' : '') +
            '</div>';
        }).join('');
      });
    }

    // Side panel — shown when loudness === 'panel'
    panel.style.display = (loudness === 'panel') ? 'block' : 'none';
    if (loudness === 'panel') {
      panel.innerHTML = '<div class="spread">' +
          '<div class="hand" style="font-size:22px;">Your COO</div>' +
          '<span class="mono">◉ online</span>' +
        '</div>' +
        '<hr class="divider"/>' +
        '<div class="mono">today\'s focus</div>' +
        '<div style="margin:4px 0 10px;">Fill Thursday afternoons · keep rebook rate &gt; 60%</div>' +
        '<div class="mono">what I did overnight</div>' +
        '<ul style="margin:4px 0 10px; padding-left:18px; font-size:12px;">' +
          '<li>Re-ran demand forecast</li>' +
          '<li>Re-tuned your model on last wk</li>' +
          '<li>Spotted 2 regulars at risk</li>' +
        '</ul>' +
        '<div class="mono">ask me</div>' +
        '<input id="coo-ask" type="text" placeholder="can I afford a 3rd chair?" />' +
        '<div class="row" style="gap:6px; margin-top:6px; flex-wrap:wrap;">' +
          '<span class="tag">why is cashflow off?</span>' +
          '<span class="tag">prep for tax</span>' +
        '</div>';
    }

    // BML coach layer — always visible, same pattern every nudge follows
    bml.innerHTML =
      step('build · the tiny experiment', '"Try 15% off quiet-hour Thursdays for 2 weeks."') +
      step('measure · the number to watch', '"We\'ll track: Thu chair-use & margin per chair."') +
      step('learn · the recap, in plain words', '"Filled Thu 68% → 92%. Margin up €310/wk. Keep it?"');
  }

  function step(m, t) { return '<div class="step"><div class="mono">'+escapeHtml(m)+'</div><div class="hand">'+escapeHtml(t)+'</div></div>'; }
  function iconFor(kind) {
    return { opportunity: '⚡', watch: '⚠️', idea: '💡' }[kind] || '•';
  }
  function miniSparkline(values) {
    if (!values.length) return '';
    var max = Math.max.apply(null, values) || 1;
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
