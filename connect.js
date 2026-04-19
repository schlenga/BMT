// connect.js — stage 06 · make the cockpit smarter.
//
// Every ghost module is a hint: connect a tool, get a sharper answer. For
// operators who don't have a given tool yet, we suggest one. Core commitment:
// passthrough, not retention. Every tile copy leans into that.
'use strict';

var Connect = (function(){

  // Sorted by "how much sharpness it adds". Each tile either connects a tool
  // the user has, or suggests one if they don't.
  var TILES = [
    { group: 'payments · unlocks cashflow, true revenue, break-even',
      have: { key: 'stripe', name: 'Stripe', bump: 0.34, scope: 'read-only · passthrough · we keep nothing' },
      missing: { name: 'No payment system yet?', suggest: 'SumUp — €0/mo + 1.39% per card. Simplest start for a small shop.' } },
    { group: 'bookings & calendar · unlocks regulars, capacity, no-shows',
      have: { key: 'calendar', name: 'Google Calendar', bump: 0.22, scope: 'scope: calendar events · read-only' },
      missing: { name: 'Booking platform?', suggest: 'Treatwell or Fresha work directly — 1-tap connect.' } },
    { group: 'business inbox · unlocks invoices, leads, supplier chats',
      have: { key: 'gmail', name: 'Gmail / Outlook', bump: 0.18, scope: 'we only read invoices & receipts · nothing else' },
      missing: { name: 'Your inbox is an old aol.com?', suggest: 'Forward invoices to bills@yours.bmt.app — we\'ll catch them.' } },
    { group: 'bank · accounting · erp · unlocks runway, tax, planning',
      have: { key: 'bank', name: 'Bank feed (PSD2)', bump: 0.26, scope: 'read-only · EU-regulated' },
      missing: { name: 'Bookkeeping?', suggest: 'DATEV / Lexware / Xero — we never overwrite your books.' } },
    { group: 'pos · for cafés, shops, bars',
      have: { key: 'pos', name: 'POS integration', bump: 0.20, scope: 'itemized sales, no card numbers' },
      missing: { name: 'No POS yet?', suggest: 'SumUp Solo is €39 and plugs in in 20 minutes.' } },
    { group: 'socials · reviews · crm · later',
      have: { key: 'insta', name: 'Instagram Business', bump: 0.10, scope: 'read-only · public post stats' },
      missing: null },
  ];

  function render() {
    var state = Store.get();
    var list = document.getElementById('connect-list');
    list.innerHTML = TILES.map(function(tile){
      return '<div><div class="mono">'+escapeHtml(tile.group)+'</div><div class="grid2" style="margin-top:4px;">' +
        renderHave(tile.have, state) +
        (tile.missing ? renderMissing(tile.have, tile.missing) : '') +
        '</div></div>';
    }).join('');

    list.querySelectorAll('[data-toggle]').forEach(function(b){
      b.onclick = function(){
        var key = b.dataset.toggle;
        Store.set(function(s){
          s.connections[key] = { status: 'on', lastSeen: Date.now() };
        });
        var sim = Cockpit.simState();
        Sim.learnFromConnection(sim, key);
        Store.set(function(s){ s.sharpness = Sim.sharpness(sim); });
        render();
        updateSharpnessMeter();
      };
    });
    list.querySelectorAll('[data-suggest]').forEach(function(b){
      b.onclick = function(){
        Onboarding.toast('Prototype: would take you to the set-up flow for this tool.');
      };
    });
    updateSharpnessMeter();
  }

  function renderHave(have, state) {
    var on = state.connections[have.key] && state.connections[have.key].status === 'on';
    return '<div class="sketch" style="padding:10px 12px;">' +
      '<div class="spread">' +
        '<div class="hand" style="font-size:18px;">'+escapeHtml(have.name)+'</div>' +
        '<span class="tag ' + (on ? 'ok' : 'accent') + '">'+(on?'connected ✓':'+ '+Math.round(have.bump*100)+'% sharper')+'</span>' +
      '</div>' +
      '<div class="mono" style="margin-top:2px;">'+escapeHtml(have.scope)+'</div>' +
      '<div class="row" style="gap:6px; margin-top:8px;">' +
        (on
          ? '<button class="btn small ghost" data-toggle="'+have.key+'">Revoke</button>'
          : '<button class="btn accent small" data-toggle="'+have.key+'">Connect</button>' +
            '<button class="btn small" data-why="'+have.key+'">Why this?</button>') +
      '</div></div>';
  }

  function renderMissing(have, m) {
    return '<div class="sketch dashed" style="padding:10px 12px; background:var(--paper-2);">' +
      '<div class="spread"><div class="hand" style="font-size:18px;">'+escapeHtml(m.name)+'</div><span class="tag">we suggest</span></div>' +
      '<div style="margin-top:2px; font-size:13px;">'+escapeHtml(m.suggest)+'</div>' +
      '<div class="row" style="gap:6px; margin-top:8px;">' +
        '<button class="btn small" data-suggest="'+escapeHtml((m.name||'').toLowerCase())+'">Set me up →</button>' +
      '</div></div>';
  }

  function updateSharpnessMeter() {
    var sim = Cockpit.simState();
    var sharp = Math.round(Sim.sharpness(sim) * 100);
    var el1 = document.getElementById('connect-sharpness');
    var el2 = document.getElementById('connect-sharpness-fill');
    if (el1) el1.textContent = sharp + '%';
    if (el2) el2.style.width = sharp + '%';
  }

  function escapeHtml(s) { return Onboarding.escapeHtml(s); }

  return { render: render };
})();
