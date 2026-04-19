// shocks.js — stage 07b · "when the world shifts".
//
// Something outside lands — RFP, rent letter, retirement. The cockpit briefly
// turns into a situation room: a structured plan, a "do nothing" path, a
// confidence chip. Real wiring would detect these from inbox/calendar/photos;
// here we seed three representative shocks and let the AI draft the plans.
'use strict';

var Shocks = (function(){

  var SEED = [
    { id: 'rfp',     icon: '📬', title: 'RFP from Acme — response due Fri', detected: 'detected in inbox · 8 min ago' },
    { id: 'rent',    icon: '🏠', title: 'Landlord wants +22% from Oct.',   detected: 'letter scanned from photo' },
    { id: 'retire',  icon: '👋', title: 'Thomas retiring in 5 months.',    detected: 'noticed in calendar' },
  ];

  function render() {
    var list = document.getElementById('shocks-list');
    list.innerHTML = SEED.map(function(s){
      return '<div class="browser" data-id="'+s.id+'">' +
        '<div class="browser-bar"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="url">·/react/'+s.id+'</div></div>' +
        '<div class="browser-body" style="min-height:320px;">' +
          '<div class="shock"><div class="mono">'+s.icon+' '+escapeHtml(s.detected)+'</div>' +
          '<div class="hand" style="font-size:18px;">'+escapeHtml(s.title)+'</div></div>' +
          '<div class="narration" data-narr="'+s.id+'"><span class="thinking">drafting a plan…</span></div>' +
          '<div data-plan="'+s.id+'" style="margin-top:4px;"></div>' +
          '<div class="row" style="gap:6px; margin-top:10px;">' +
            '<button class="btn accent" data-act="go" data-id="'+s.id+'">Go</button>' +
            '<button class="btn" data-act="nothing" data-id="'+s.id+'">Do nothing</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Draft plans in parallel. Each returns its own narration + bullet list.
    SEED.forEach(function(s){
      AI.draftShockPlan(s, Store.get()).then(function(res){
        var d = res.data;
        var narr = document.querySelector('[data-narr="'+s.id+'"]');
        var plan = document.querySelector('[data-plan="'+s.id+'"]');
        if (narr) {
          var hedge = AI.confidenceLabel(d.confidence || 0.5);
          narr.innerHTML = '"' + escapeHtml(d.title || 'Here is what I\'d try.') + '" <span class="uncertain">'+hedge+'</span>' +
            (res.source === 'offline' ? ' <span class="uncertain">offline</span>' : '');
        }
        if (plan) {
          plan.innerHTML = '<ul style="font-size:13px; padding-left:18px; margin:4px 0;">' +
            (d.steps || []).map(function(st){ return '<li>'+escapeHtml(st)+'</li>'; }).join('') +
            '</ul>' +
            (d.doNothing ? '<div class="mono" style="margin-top:4px;">do-nothing path · '+escapeHtml(d.doNothing)+'</div>' : '') +
            (d.why ? '<div class="why">'+escapeHtml(d.why)+'</div>' : '');
        }
      });
    });

    list.querySelectorAll('[data-act]').forEach(function(b){
      b.onclick = function(){
        var act = b.dataset.act, id = b.dataset.id;
        if (act === 'nothing') {
          Onboarding.toast('Noted — I\'ll flag it again if something changes.');
        } else {
          Store.set(function(s){
            s.hypotheses.push({
              id: 'h_'+id+'_'+Math.random().toString(36).slice(2,6),
              question: 'run shock plan: ' + id,
              status: 'testing', target: null, actuals: [], createdAt: Date.now(),
            });
          });
          Onboarding.toast('Plan started. I\'ll track it against the numbers you care about.');
        }
      };
    });
  }

  function escapeHtml(s) { return Onboarding.escapeHtml(s); }

  return { render: render };
})();
