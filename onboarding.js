// onboarding.js — stages 1 (auth), 2 (workbench), 3 (extrapolate), 4 (confirm).
//
// The design's thesis: the user shouldn't see an 11-step form. They see a
// visual scene and a running narration from the AI. This module orchestrates
// that — every state transition is driven by what the user drops, not what
// they pick from a list.
'use strict';

var Onboarding = (function(){

  // ---- Stage 01: auth ----
  function initAuth(goNext) {
    var phoneStep = document.getElementById('auth-step-phone');
    var codeStep  = document.getElementById('auth-step-code');
    var trustStep = document.getElementById('auth-step-trust');
    var phoneIn   = document.getElementById('auth-phone');

    document.getElementById('auth-phone-next').onclick = function(){
      var p = (phoneIn.value || '').trim();
      if (p.replace(/\D/g,'').length < 7) { toast("That phone number looks too short — want to double-check?"); return; }
      Store.set(function(s){ s.auth.phone = p; });
      document.getElementById('auth-to').textContent = 'to ' + maskPhone(p) + ' · change number';
      phoneStep.style.display = 'none';
      codeStep.style.display = 'block';
      setTimeout(function(){ document.getElementById('code1').focus(); }, 40);
    };

    // Auto-advance code boxes.
    var boxes = [1,2,3,4,5,6].map(function(i){ return document.getElementById('code'+i); });
    boxes.forEach(function(b, i){
      b.addEventListener('input', function(){
        if (b.value && i < 5) boxes[i+1].focus();
      });
      b.addEventListener('keydown', function(e){
        if (e.key === 'Backspace' && !b.value && i > 0) boxes[i-1].focus();
      });
    });

    document.getElementById('auth-code-next').onclick = function(){
      var code = boxes.map(function(b){return b.value;}).join('');
      if (code.length < 4) { toast("Enter the 6-digit code."); return; }
      // This is a prototype — any code works. Real wiring is TODO.
      Store.set(function(s){ s.auth.verified = true; });
      codeStep.style.display = 'none';
      trustStep.style.display = 'block';
    };

    document.getElementById('auth-trust-done').onclick = function(){
      var sel = document.querySelector('input[name=backup]:checked');
      Store.set(function(s){ s.auth.backup = sel ? sel.value : 'phone2'; });
      goNext();
    };
  }

  function maskPhone(p) {
    var d = p.replace(/\D/g,'');
    if (d.length < 5) return p;
    return d.slice(0, 3) + ' · · · ' + d.slice(-2);
  }

  // ---- Stage 02: workbench ----
  var BENCH_ITEMS = {
    photos:   { title: 'Drop some photos', hint: 'Of the shop, menu, staff, products — anything.', kind: 'photos' },
    describe: { title: 'Tell me about your business', hint: 'One sentence is enough. "I run a 2-chair salon in Kreuzberg."', kind: 'describe' },
    url:      { title: 'Paste a link', hint: 'Your site, your Instagram, your Google Maps listing — anything I can read.', kind: 'url' },
    receipt:  { title: 'Drop a receipt or invoice', hint: 'So I can see what you sell + at what price.', kind: 'receipt' },
    tool:     { title: 'Which tool should I connect?', hint: 'Stripe, Google Calendar, your bank — we pass data through, we keep nothing.', kind: 'tool' },
    card:     { title: 'Snap a business card', hint: 'Yours or a supplier\'s. Helps me learn who\'s in your orbit.', kind: 'card' },
  };

  function initBench(goNext) {
    var dlg = document.getElementById('bench-dialog');
    var body = document.getElementById('bench-dialog-body');
    var titleEl = document.getElementById('bench-dialog-title');
    var kindEl = document.getElementById('bench-dialog-kind');
    var currentKind = null;

    document.querySelectorAll('#bench .item').forEach(function(el){
      el.addEventListener('click', function(){
        currentKind = el.dataset.kind;
        var spec = BENCH_ITEMS[currentKind];
        kindEl.textContent = currentKind;
        titleEl.textContent = spec.title;
        body.innerHTML = dialogBody(currentKind, spec);
        dlg.showModal();
        setTimeout(function(){
          var first = body.querySelector('input,textarea,select');
          if (first) first.focus();
        }, 40);
      });
    });

    dlg.addEventListener('close', function(){
      if (dlg.returnValue !== 'ok' || !currentKind) return;
      var value = readDialogValue(currentKind);
      if (!value) return;
      Store.set(function(s){
        s.bench.push({ kind: currentKind, value: value, addedAt: Date.now(), label: currentKind });
      });
      markFilled(currentKind);
      updateBenchSummary();
    });

    document.getElementById('bench-done').onclick = function(){
      var s = Store.get();
      if (!s.bench.length) {
        if (!confirm("Nothing on the bench yet. I can still make a rough guess — but it'll be hunchy. Continue anyway?")) return;
      }
      goNext();
    };

    // Render pre-existing bench items
    Store.get().bench.forEach(function(item){ markFilled(item.kind); });
    updateBenchSummary();
  }

  function dialogBody(kind, spec) {
    var h = '<p class="mono" style="margin-bottom:8px;">' + escapeHtml(spec.hint) + '</p>';
    if (kind === 'photos' || kind === 'receipt' || kind === 'card') {
      h += '<textarea id="bench-val" placeholder="Describe what\'s in the photo (prototype: no upload yet)"></textarea>';
    } else if (kind === 'describe') {
      h += '<textarea id="bench-val" placeholder="In one sentence…" autofocus></textarea>';
    } else if (kind === 'url') {
      h += '<input id="bench-val" type="url" placeholder="https://…" />';
    } else if (kind === 'tool') {
      h += '<select id="bench-val"><option value="">Pick a tool…</option>' +
           ['stripe','sumup','gmail','outlook','google calendar','apple calendar','treatwell','fresha','shopify','xero','lexware','datev','your bank (PSD2)']
             .map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('') + '</select>';
    }
    return h;
  }

  function readDialogValue(kind) {
    var el = document.getElementById('bench-val');
    return el ? el.value.trim() : null;
  }

  function markFilled(kind) {
    var el = document.querySelector('#bench .item[data-kind="'+kind+'"]');
    if (el) el.classList.add('filled');
  }

  function updateBenchSummary() {
    var n = Store.get().bench.length;
    var sum = document.getElementById('bench-summary');
    var center = document.getElementById('bench-count');
    sum.textContent = n === 0 ? '0 things on the bench · skip whenever'
                              : n + ' thing' + (n===1?'':'s') + ' on the bench · keep going, or stop';
    center.textContent = n === 0 ? 'nothing is required' : 'thanks · that helps';
  }

  // ---- Stage 03: extrapolate ----
  function runExtrapolate(goNext) {
    var stepsEl = document.getElementById('extrapolate-steps');
    var narrEl = document.getElementById('extrapolate-narration');
    var btn = document.getElementById('extrapolate-continue');
    btn.disabled = true;

    var bench = Store.get().bench;
    var stepLabels = [
      { icon: '🔎', text: 'Scanning what you dropped' },
      { icon: '📍', text: 'Locating you & neighborhood' },
      { icon: '🧠', text: 'Classifying business type' },
      { icon: '📊', text: 'Estimating a first model' },
      { icon: '🎨', text: 'Picking a cockpit look' },
    ];
    stepsEl.innerHTML = stepLabels.map(function(s, i){
      return '<div class="sketch" data-step="'+i+'" style="padding:10px 12px; display:flex; justify-content:space-between; opacity:0.55;">' +
             '<span>'+s.icon+' &nbsp;'+s.text+'</span><span class="mono" data-s="'+i+'">queued</span></div>';
    }).join('');

    // Progressive step animation independent of the AI.
    stepLabels.forEach(function(s, i){
      setTimeout(function(){
        var row = stepsEl.querySelector('[data-step="'+i+'"]');
        if (row) { row.style.opacity = 1; if (i !== 2) row.querySelector('.mono').textContent = 'running…'; else row.classList.add('accent'); row.querySelector('.mono').textContent = 'running…'; }
        setTimeout(function(){
          if (!row) return;
          row.querySelector('.mono').textContent = 'done ✓';
          row.classList.remove('accent');
        }, 700);
      }, i * 800);
    });

    narrEl.innerHTML = '<span class="thinking">thinking…</span>';

    AI.extrapolate(bench, function(p){
      narrEl.textContent = '"' + p.step + '…"';
    }).then(function(res){
      var guess = res.data;
      var narration = narrateGuess(guess, bench, res.source);
      narrEl.innerHTML = '"' + escapeHtml(narration) + '"' + (res.source === 'offline' ? ' <span class="uncertain">offline guess</span>' : '');
      // Persist
      Store.set(function(s){
        ['persona','businessType','location','priceTier','customers','staff'].forEach(function(k){
          if (guess[k]) {
            s.profile[k] = guess[k].value;
            s.profile.confidence[k] = guess[k].confidence;
            s.profile.whys[k] = guess[k].why;
          }
        });
      });
      btn.disabled = false;
      btn.onclick = goNext;
    });
  }

  function narrateGuess(g, bench, source) {
    var lines = [];
    if (g.businessType && g.businessType.value) lines.push('Looks like ' + g.businessType.value + '.');
    if (g.location && g.location.value) lines.push('In ' + g.location.value + '.');
    if (bench.length === 0) lines.push("I had very little to go on — treat everything as a hunch.");
    if (g.persona && g.persona.confidence < 0.4) lines.push("I'm not sure which persona cockpit fits — pick one on the next screen.");
    return lines.join(' ') || "Not much to read yet. Cockpit will be thin until you drop more.";
  }

  // ---- Stage 04: confirm ----
  function initConfirm(goNext) {
    var rowsEl = document.getElementById('confirm-rows');
    var profile = Store.get().profile;

    var FIELDS = [
      { key: 'businessType', label: 'business' },
      { key: 'persona',      label: 'cockpit style', options: ['lina','klaus','franka','nadia'] },
      { key: 'location',     label: 'location' },
      { key: 'priceTier',    label: 'price tier', options: ['budget','mid','premium'] },
      { key: 'customers',    label: 'customers' },
      { key: 'staff',        label: 'team size' },
    ];

    rowsEl.innerHTML = FIELDS.map(function(f){
      var v = profile[f.key];
      var c = profile.confidence[f.key] || 0;
      var w = profile.whys[f.key] || '';
      var hedge = AI.confidenceLabel(c);
      return '<div class="sketch" style="padding:10px 12px;" data-key="'+f.key+'">' +
        '<div class="spread">' +
          '<div class="mono">'+f.label+'</div>' +
          '<span class="uncertain">'+hedge+'</span>' +
        '</div>' +
        '<div class="hand" style="font-size:18px; margin-top:2px;">'+escapeHtml(v || '—')+'</div>' +
        (w ? '<div class="why">'+escapeHtml(w)+'</div>' : '') +
        '<div style="margin-top:6px;"><button class="btn small" data-edit="'+f.key+'">Tap to fix</button></div>' +
      '</div>';
    }).join('');

    rowsEl.querySelectorAll('[data-edit]').forEach(function(btn){
      btn.onclick = function(){
        var key = btn.dataset.edit;
        var spec = FIELDS.find(function(f){return f.key === key;});
        var current = profile[key] || '';
        var next;
        if (spec.options) {
          next = prompt(spec.label + ' — one of: ' + spec.options.join(', '), current);
          if (!next || spec.options.indexOf(next) < 0) return;
        } else {
          next = prompt(spec.label, current);
          if (next == null) return;
        }
        Store.set(function(s){
          s.profile[key] = next;
          s.profile.confidence[key] = 0.95; // user-confirmed = high confidence
          s.profile.whys[key] = 'you told me';
        });
        initConfirm(goNext); // re-render
      };
    });

    document.getElementById('confirm-ok').onclick = function(){
      // Refresh simulation priors based on the now-confirmed profile
      App.learnProfileIntoSim();
      goNext();
    };
    document.getElementById('confirm-fix').onclick = function(){
      toast('Tap any of the cards above to fix that field.');
    };
  }

  // ---- Shared helpers ----
  function escapeHtml(s) {
    s = (s == null ? '' : String(s));
    return s.replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; });
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ t.style.display = 'none'; }, 3200);
  }

  return {
    initAuth: initAuth,
    initBench: initBench,
    runExtrapolate: runExtrapolate,
    initConfirm: initConfirm,
    toast: toast,
    escapeHtml: escapeHtml,
  };
})();
