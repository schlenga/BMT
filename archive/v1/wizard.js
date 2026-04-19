// wizard.js — Card-based workspace assembly onboarding ("Business Butler")
'use strict';

var Wizard = (function() {

  // ── State ──
  var stage = 'url'; // 'url' | 'analyzing' | 'workspace' | 'launching'
  var cardStage = 'A'; // 'A' | 'B' | 'C'
  var confirmed = { identity: false, customers: false, economics: false, financials: false, ambition: false };
  var data = {
    websiteUrl: '',
    websiteData: null,
    brandColors: null,
    greeting: '',
    name: '',
    type: 'service',
    description: '',
    proudOf: '',
    segments: [],
    revenueRange: '',
    costs: [],
    teamSize: '',
    goal: '',
    concern: '',
    toolPrefs: {},
    aiHypotheses: [],
    selectedHypIds: null,
    startingCash: '',
    avgPrice: '',
    monthlyVolume: ''
  };
  var loading = false;
  var previewExpanded = false;
  var container = null;

  function terms() {
    return AI.getTerminology(data.type);
  }

  // ── Main Render ──
  function render(cont) {
    container = cont;
    switch (stage) {
      case 'url': renderUrlStage(); break;
      case 'analyzing': renderAnalyzingStage(); break;
      case 'workspace': renderWorkspaceStage(); break;
      case 'launching': renderLaunchingStage(); break;
    }
  }

  // ── Phase 1: Grand Entrance ──
  function renderUrlStage() {
    var h = '<div class="ob-entrance">';
    h += '<div class="ob-entrance-content">';
    h += '<div class="ob-logo">BMT</div>';
    h += '<h1 class="ob-headline">Your business cockpit starts here</h1>';
    h += '<p class="ob-subline">Paste your website URL and watch your workspace come to life</p>';
    h += '<div class="ob-url-wrap">';
    h += '<input class="ob-url-input" id="ob-url" type="url" placeholder="https://yourbusiness.com" value="' + esc(data.websiteUrl) + '" autofocus>';
    h += '<button class="ob-url-btn" id="btn-analyze">Analyze</button>';
    h += '</div>';
    h += '<button class="ob-skip-link" id="btn-skip">I don\'t have a website — set up manually</button>';
    h += '</div>';
    h += '</div>';
    container.innerHTML = h;

    var urlInput = document.getElementById('ob-url');
    var analyzeBtn = document.getElementById('btn-analyze');
    var skipBtn = document.getElementById('btn-skip');

    analyzeBtn.addEventListener('click', function() { analyzeWebsite(); });
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') analyzeWebsite();
    });
    skipBtn.addEventListener('click', function() { skipToManual(); });
  }

  // ── Phase 1b: Analyzing Animation ──
  function renderAnalyzingStage() {
    var h = '<div class="ob-entrance ob-analyzing">';
    h += '<div class="ob-entrance-content">';
    h += '<div class="ob-logo">BMT</div>';
    h += '<div class="ob-assembling">';
    h += '<div class="ob-pulse-ring"></div>';
    h += '<div class="ob-pulse-ring ob-ring-2"></div>';
    h += '<div class="ob-pulse-ring ob-ring-3"></div>';
    h += '<p class="ob-analyzing-text">Analyzing your business...</p>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    container.innerHTML = h;
  }

  // ── Phase 2: Workspace with Staged Cards ──
  function renderWorkspaceStage() {
    var t = terms();
    var h = '<div class="ob-workspace">';

    // Left: Refinement cards
    h += '<div class="ob-cards-panel">';

    // Greeting
    if (data.greeting) {
      h += '<div class="ob-greeting anim-fade-in">' + esc(data.greeting) + '</div>';
    } else if (data.name) {
      h += '<div class="ob-greeting anim-fade-in">Let\'s set up the perfect workspace for ' + esc(data.name) + '</div>';
    } else {
      h += '<div class="ob-greeting anim-fade-in">Let\'s build your business cockpit</div>';
    }

    // Stage A cards (always visible in workspace)
    h += renderIdentityCard(t);
    h += renderCustomersCard(t);

    // Stage B cards (revealed after A confirmed)
    if (cardStage === 'B' || cardStage === 'C') {
      h += renderEconomicsCard(t);
      h += renderFinancialsCard(t);
      h += renderAmbitionCard(t);
    }

    // Stage C: hypotheses (revealed after B confirmed)
    if (cardStage === 'C') {
      h += renderHypothesesCard(t);
    }

    // Loading indicator for hypothesis generation
    if (loading) {
      h += '<div class="ob-card anim-fade-in">';
      h += '<div class="ob-card-loading"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> Generating hypotheses for your business...</div>';
      h += '</div>';
    }

    h += '</div>';

    // Right: Live canvas preview
    h += '<div class="ob-preview-panel' + (previewExpanded ? ' expanded' : '') + '" id="ob-preview">';
    h += '<div class="preview-toggle" id="preview-toggle"></div>';
    h += renderLiveCanvas(t);
    h += '</div>';

    h += '</div>';
    container.innerHTML = h;
    bindWorkspaceEvents();
    scrollToLatestCard();
  }

  // ── Refinement Cards ──
  function renderIdentityCard(t) {
    var isConfirmed = confirmed.identity;
    var h = '<div class="ob-card' + (isConfirmed ? ' ob-card-done' : '') + ' anim-slide-up" data-card="identity">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9733;</span>';
    h += '<span class="ob-card-title">' + esc(t.valueProp) + '</span>';
    if (isConfirmed) h += '<span class="ob-card-check">&#10003;</span>';
    h += '</div>';

    if (!isConfirmed) {
      h += '<div class="ob-card-body">';
      h += '<div class="ob-field">';
      h += '<label class="ob-field-label">Business name</label>';
      h += '<input class="ob-input" id="ob-name" placeholder="Your business name" value="' + esc(data.name) + '">';
      h += '</div>';
      h += '<div class="ob-field">';
      h += '<label class="ob-field-label">' + esc(t.proudPrompt) + '</label>';
      h += '<textarea class="ob-textarea" id="ob-proud" placeholder="Tell us what makes you special...">' + esc(data.proudOf) + '</textarea>';
      h += '</div>';
      h += '<div class="ob-card-actions">';
      h += '<button class="ob-btn ob-btn-confirm" id="btn-confirm-identity">Looks good</button>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="ob-card-summary">';
      h += '<strong>' + esc(data.name) + '</strong>';
      if (data.proudOf) h += ' &mdash; ' + esc(data.proudOf.length > 80 ? data.proudOf.slice(0, 80) + '...' : data.proudOf);
      h += ' <button class="ob-edit-btn" data-edit="identity">Edit</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderCustomersCard(t) {
    var isConfirmed = confirmed.customers;
    var type = data.type || 'service';
    var segs = AI.getSuggestions(AI.SEGMENTS, type);

    var h = '<div class="ob-card' + (isConfirmed ? ' ob-card-done' : '') + ' anim-slide-up ob-delay-1" data-card="customers">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9829;</span>';
    h += '<span class="ob-card-title">' + esc(t.customerSegments) + '</span>';
    if (isConfirmed) h += '<span class="ob-card-check">&#10003;</span>';
    h += '</div>';

    if (!isConfirmed) {
      h += '<div class="ob-card-body">';
      h += '<p class="ob-card-prompt">' + esc(t.customersPrompt) + '</p>';
      h += '<div class="ob-chips" id="ob-segs">';
      segs.forEach(function(seg) {
        var active = data.segments.indexOf(seg) >= 0;
        h += '<span class="ob-chip' + (active ? ' active' : '') + '" data-val="' + esc(seg) + '">' + esc(seg) + '</span>';
      });
      h += '</div>';
      h += '<input class="ob-input ob-input-sm" id="ob-seg-custom" placeholder="Type to add your own...">';
      h += '<div class="ob-card-actions">';
      h += '<button class="ob-btn ob-btn-confirm" id="btn-confirm-customers"' + (data.segments.length === 0 ? ' disabled' : '') + '>Looks good</button>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="ob-card-summary">';
      h += esc(data.segments.join(', '));
      h += ' <button class="ob-edit-btn" data-edit="customers">Edit</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderEconomicsCard(t) {
    var isConfirmed = confirmed.economics;
    var costs = AI.getSuggestions(AI.COSTS, data.type);

    var h = '<div class="ob-card' + (isConfirmed ? ' ob-card-done' : '') + ' anim-slide-up" data-card="economics">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9670;</span>';
    h += '<span class="ob-card-title">Economics</span>';
    if (isConfirmed) h += '<span class="ob-card-check">&#10003;</span>';
    h += '</div>';

    if (!isConfirmed) {
      h += '<div class="ob-card-body">';
      h += '<div class="ob-field-row">';

      h += '<div class="ob-field ob-field-half">';
      h += '<label class="ob-field-label">Monthly revenue</label>';
      h += '<select class="ob-select" id="ob-revenue">';
      ['Pre-revenue','$0 - $1K','$1K - $5K','$5K - $20K','$20K - $50K','$50K - $100K','$100K+'].forEach(function(opt) {
        h += '<option' + (data.revenueRange === opt ? ' selected' : '') + '>' + opt + '</option>';
      });
      h += '</select></div>';

      h += '<div class="ob-field ob-field-half">';
      h += '<label class="ob-field-label">Team size</label>';
      h += '<select class="ob-select" id="ob-team">';
      ['Just me','2-5','6-15','16-50','50+'].forEach(function(opt) {
        h += '<option' + (data.teamSize === opt ? ' selected' : '') + '>' + opt + '</option>';
      });
      h += '</select></div>';

      h += '</div>';

      h += '<div class="ob-field">';
      h += '<label class="ob-field-label">' + esc(t.costStructure) + '</label>';
      h += '<div class="ob-chips" id="ob-costs">';
      costs.forEach(function(c) {
        var active = data.costs.indexOf(c) >= 0;
        h += '<span class="ob-chip' + (active ? ' active' : '') + '" data-val="' + esc(c) + '">' + esc(c) + '</span>';
      });
      h += '</div></div>';

      h += '<div class="ob-card-actions">';
      h += '<button class="ob-btn ob-btn-confirm" id="btn-confirm-economics">Looks good</button>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="ob-card-summary">';
      h += esc(data.revenueRange) + ' &bull; Team: ' + esc(data.teamSize);
      if (data.costs.length) h += ' &bull; ' + esc(data.costs.join(', '));
      h += ' <button class="ob-edit-btn" data-edit="economics">Edit</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderFinancialsCard(t) {
    var isConfirmed = confirmed.financials;
    if (!confirmed.economics) return ''; // Only show after economics

    var type = data.type || 'service';
    var tmpl = (typeof SimulationTypes !== 'undefined') ? SimulationTypes.getTemplate(type) : null;
    var kpi = (typeof SimulationTypes !== 'undefined') ? SimulationTypes.getKpiLabels(type) : { units: 'units', revenue: 'revenue', customers: 'customers' };

    // Smart defaults from template
    var defaultPrice = tmpl ? tmpl.revenueStreams[0].unitPrice : 50;
    var defaultVolume = tmpl ? tmpl.revenueStreams[0].unitsPerMonth : 100;
    var defaultCash = tmpl ? tmpl.startingCash : 10000;

    var h = '<div class="ob-card' + (isConfirmed ? ' ob-card-done' : '') + ' anim-slide-up ob-delay-1" data-card="financials">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9733;</span>';
    h += '<span class="ob-card-title">Financial Details</span>';
    if (isConfirmed) h += '<span class="ob-card-check">&#10003;</span>';
    h += '</div>';

    if (!isConfirmed) {
      h += '<div class="ob-card-body">';
      h += '<p class="ob-card-prompt">These numbers power your financial projection. Best guesses are fine — you can adjust later.</p>';

      h += '<div class="ob-field-row">';
      h += '<div class="ob-field ob-field-third">';
      h += '<label class="ob-field-label">Starting cash / capital</label>';
      h += '<div class="ob-input-prefix"><span>$</span><input class="ob-input" id="ob-cash" type="number" placeholder="' + defaultCash + '" value="' + (data.startingCash || '') + '"></div>';
      h += '</div>';

      h += '<div class="ob-field ob-field-third">';
      h += '<label class="ob-field-label">Avg price per ' + esc(kpi.units === 'units' ? 'sale' : kpi.units.replace(/s$/, '')) + '</label>';
      h += '<div class="ob-input-prefix"><span>$</span><input class="ob-input" id="ob-price" type="number" placeholder="' + defaultPrice + '" value="' + (data.avgPrice || '') + '"></div>';
      h += '</div>';

      h += '<div class="ob-field ob-field-third">';
      h += '<label class="ob-field-label">' + esc(kpi.units.charAt(0).toUpperCase() + kpi.units.slice(1)) + ' per month</label>';
      h += '<input class="ob-input" id="ob-volume" type="number" placeholder="' + defaultVolume + '" value="' + (data.monthlyVolume || '') + '">';
      h += '</div>';
      h += '</div>';

      h += '<div class="ob-card-actions">';
      h += '<button class="ob-btn ob-btn-confirm" id="btn-confirm-financials">Looks good</button>';
      h += '<span class="ob-skip-hint" id="btn-skip-financials">Skip — use defaults</span>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="ob-card-summary">';
      var cashDisplay = data.startingCash ? '$' + Number(data.startingCash).toLocaleString() : 'Default';
      var priceDisplay = data.avgPrice ? '$' + data.avgPrice : 'Default';
      var volDisplay = data.monthlyVolume || 'Default';
      h += 'Cash: ' + cashDisplay + ' &bull; Price: ' + priceDisplay + ' &bull; Volume: ' + volDisplay + '/mo';
      h += ' <button class="ob-edit-btn" data-edit="financials">Edit</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderAmbitionCard(t) {
    var isConfirmed = confirmed.ambition;

    var h = '<div class="ob-card' + (isConfirmed ? ' ob-card-done' : '') + ' anim-slide-up ob-delay-1" data-card="ambition">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9650;</span>';
    h += '<span class="ob-card-title">Ambition</span>';
    if (isConfirmed) h += '<span class="ob-card-check">&#10003;</span>';
    h += '</div>';

    if (!isConfirmed) {
      h += '<div class="ob-card-body">';

      h += '<div class="ob-field">';
      h += '<label class="ob-field-label">' + esc(t.goalPrompt) + '</label>';
      h += '<div class="ob-chips" id="ob-goals">';
      AI.GOALS.forEach(function(g) {
        var active = data.goal === g;
        h += '<span class="ob-chip' + (active ? ' active' : '') + '" data-val="' + esc(g) + '">' + esc(g) + '</span>';
      });
      h += '</div>';
      h += '<input class="ob-input ob-input-sm" id="ob-goal-custom" placeholder="Or type your own..." value="' + (AI.GOALS.indexOf(data.goal) < 0 ? esc(data.goal) : '') + '">';
      h += '</div>';

      h += '<div class="ob-field">';
      h += '<label class="ob-field-label">' + esc(t.concernPrompt) + '</label>';
      h += '<textarea class="ob-textarea ob-textarea-sm" id="ob-concern" placeholder="e.g. Not enough ' + esc(t.customers) + ', cash flow, competition...">' + esc(data.concern) + '</textarea>';
      h += '</div>';

      h += '<div class="ob-card-actions">';
      h += '<button class="ob-btn ob-btn-confirm" id="btn-confirm-ambition">Looks good</button>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="ob-card-summary">';
      h += 'Goal: ' + esc(data.goal);
      if (data.concern) h += ' &bull; Concern: ' + esc(data.concern.length > 60 ? data.concern.slice(0,60) + '...' : data.concern);
      h += ' <button class="ob-edit-btn" data-edit="ambition">Edit</button>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderHypothesesCard(t) {
    if (data.aiHypotheses.length === 0) return '';
    var catColors = { customer: '#e67e22', value: '#2ecc71', revenue: '#3498db', growth: '#9b59b6', cost: '#e74c3c' };

    var h = '<div class="ob-card anim-slide-up" data-card="hypotheses">';
    h += '<div class="ob-card-header">';
    h += '<span class="ob-card-icon">&#9881;</span>';
    h += '<span class="ob-card-title">Your Hypotheses</span>';
    h += '</div>';
    h += '<div class="ob-card-body">';
    h += '<p class="ob-card-prompt">These are testable assumptions specific to your business. Toggle off any that don\'t feel right.</p>';

    data.aiHypotheses.forEach(function(hyp, i) {
      var selected = !data.selectedHypIds || data.selectedHypIds.indexOf(i) >= 0;
      h += '<label class="ob-hyp-toggle' + (selected ? '' : ' deselected') + '">';
      h += '<input type="checkbox" data-idx="' + i + '"' + (selected ? ' checked' : '') + '>';
      h += '<div class="ob-hyp-text">';
      h += '<span class="ob-hyp-cat" style="background:' + (catColors[hyp.category] || '#999') + '">' + esc(hyp.category) + '</span>';
      h += '<div class="ob-hyp-statement">' + esc(hyp.statement) + '</div>';
      if (hyp.rationale) h += '<div class="ob-hyp-detail">' + esc(hyp.rationale) + '</div>';
      h += '<div class="ob-hyp-detail">Target: ' + hyp.target + ' ' + esc(hyp.unit || '') + ' &mdash; ' + esc(hyp.timeframe || '') + '</div>';
      h += '</div></label>';
    });

    h += '<div class="ob-card-actions" style="margin-top:16px">';
    h += '<button class="ob-btn ob-btn-launch" id="btn-launch">Launch your cockpit &#9654;</button>';
    h += '</div>';
    h += '</div></div>';
    return h;
  }

  // ── Live Canvas Preview ──
  function renderLiveCanvas(t) {
    var cells = [
      { key: 'keyPartners', label: t.keyPartners, tall: true, items: [] },
      { key: 'keyActivities', label: t.keyActivities, half: true, items: ['Deliver core offering', 'Acquire ' + t.customers] },
      { key: 'keyResources', label: t.keyResources, half: true, items: ['Founding team'] },
      { key: 'valueProp', label: t.valueProp, tall: true, items: [] },
      { key: 'customerRelationships', label: t.customerRelationships, half: true, items: ['Personal interaction'] },
      { key: 'channels', label: t.channels, half: true, items: [] },
      { key: 'customerSegments', label: t.customerSegments, tall: true, items: [] },
      { key: 'costStructure', label: t.costStructure, wide: true, wideClass: 'preview-cell-costs', items: [] },
      { key: 'revenueStreams', label: t.revenueStreams, wide: true, wideClass: 'preview-cell-revenue', items: [] }
    ];

    // Fill from wizard data
    if (data.proudOf) cells[3].items = [data.proudOf.slice(0, 60) + (data.proudOf.length > 60 ? '...' : '')];
    if (data.segments.length) cells[6].items = data.segments;
    if (data.costs.length) cells[7].items = data.costs;
    if (data.revenueRange && data.revenueRange !== 'Pre-revenue') cells[8].items = [data.revenueRange + '/mo'];
    if (data.teamSize && data.teamSize !== 'Just me') cells[2].items.push('Team: ' + data.teamSize);
    if (data.websiteData) {
      var wd = data.websiteData;
      if (wd.channels) cells[5].items = wd.channels.slice(0, 3);
      if (wd.products) cells[8].items = wd.products.slice(0, 3);
      if (wd.customerSegments && !data.segments.length) cells[6].items = wd.customerSegments.slice(0, 3);
    }

    // Highlight active section based on card stage
    var activeKeys = [];
    if (!confirmed.identity) activeKeys = ['valueProp'];
    else if (!confirmed.customers) activeKeys = ['customerSegments'];
    else if (cardStage === 'B' && !confirmed.economics) activeKeys = ['costStructure', 'revenueStreams', 'keyResources'];
    else if (cardStage === 'B' && !confirmed.ambition) activeKeys = ['keyActivities'];

    var h = '<div class="ob-preview-header">';
    if (data.name) {
      h += '<div class="ob-preview-biz-name">' + esc(data.name) + '</div>';
    }
    h += '<div class="ob-preview-label">Your Business Model</div>';
    h += '</div>';

    h += '<div class="preview-mini-canvas">';
    cells.forEach(function(cell) {
      var classes = 'preview-cell';
      if (cell.tall) classes += ' preview-cell-tall';
      if (cell.wide) classes += ' preview-cell-wide ' + (cell.wideClass || '');
      if (cell.half) classes += ' preview-cell-half';
      if (activeKeys.indexOf(cell.key) >= 0) classes += ' active';
      if (!cell.items.length) classes += ' empty';
      h += '<div class="' + classes + '">';
      h += '<div class="preview-cell-label">' + esc(cell.label) + '</div>';
      cell.items.forEach(function(item) {
        h += '<div class="preview-cell-item">' + esc(typeof item === 'string' ? item : '') + '</div>';
      });
      h += '</div>';
    });
    h += '</div>';

    // Hypotheses preview in canvas
    if (data.aiHypotheses.length > 0 && cardStage === 'C') {
      h += '<div class="ob-preview-hyps">';
      h += '<div class="ob-preview-label" style="margin-top:16px">Hypotheses</div>';
      var catColors = { customer: '#e67e22', value: '#2ecc71', revenue: '#3498db', growth: '#9b59b6', cost: '#e74c3c' };
      data.aiHypotheses.forEach(function(hyp, i) {
        var selected = !data.selectedHypIds || data.selectedHypIds.indexOf(i) >= 0;
        if (!selected) return;
        h += '<div class="preview-hyp-card" style="animation-delay:' + (i * 0.08) + 's;opacity:1">';
        h += '<span class="wiz-hyp-cat" style="background:' + (catColors[hyp.category] || '#999') + '">' + esc(hyp.category) + '</span> ';
        h += esc(hyp.statement);
        h += '</div>';
      });
      h += '</div>';
    }

    return h;
  }

  // ── Launching Animation ──
  function renderLaunchingStage() {
    var h = '<div class="ob-entrance ob-launching">';
    h += '<div class="ob-entrance-content">';
    h += '<div class="ob-assembling">';
    h += '<div class="ob-pulse-ring"></div>';
    h += '<p class="ob-analyzing-text">Setting up your cockpit...</p>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    container.innerHTML = h;
  }

  // ── Event Binding ──
  function bindWorkspaceEvents() {
    // Chip selection
    bindChips('ob-segs', data.segments, function() {
      var btn = document.getElementById('btn-confirm-customers');
      if (btn) btn.disabled = data.segments.length === 0;
      refreshPreview();
    });
    bindChips('ob-costs', data.costs, function() { refreshPreview(); });
    bindGoalChips();

    // Custom segment input
    var segInput = document.getElementById('ob-seg-custom');
    if (segInput) segInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value.trim()) {
        var val = this.value.trim();
        if (data.segments.indexOf(val) < 0) data.segments.push(val);
        this.value = '';
        renderWorkspaceStage();
      }
    });

    // Custom goal input
    var goalInput = document.getElementById('ob-goal-custom');
    if (goalInput) goalInput.addEventListener('input', function() {
      if (this.value.trim()) {
        data.goal = this.value.trim();
        var el = document.getElementById('ob-goals');
        if (el) el.querySelectorAll('.ob-chip').forEach(function(c) { c.classList.remove('active'); });
      }
    });

    // Live preview updates from text inputs
    var nameInput = document.getElementById('ob-name');
    if (nameInput) nameInput.addEventListener('input', function() {
      data.name = this.value.trim();
      refreshPreview();
    });
    var proudInput = document.getElementById('ob-proud');
    if (proudInput) proudInput.addEventListener('input', function() {
      data.proudOf = this.value.trim();
      refreshPreview();
    });

    // Confirm buttons
    bindConfirm('btn-confirm-identity', 'identity', function() {
      var nameEl = document.getElementById('ob-name');
      var proudEl = document.getElementById('ob-proud');
      data.name = nameEl ? nameEl.value.trim() : data.name;
      data.proudOf = proudEl ? proudEl.value.trim() : data.proudOf;
      if (!data.name && !data.proudOf) return false;
      if (!data.type || data.type === 'service') {
        data.type = AI.detectType(data.proudOf + ' ' + data.description + ' ' + data.name);
      }
      return true;
    });

    bindConfirm('btn-confirm-customers', 'customers', function() {
      return data.segments.length > 0;
    });

    bindConfirm('btn-confirm-economics', 'economics', function() {
      var revEl = document.getElementById('ob-revenue');
      var teamEl = document.getElementById('ob-team');
      data.revenueRange = revEl ? revEl.value : data.revenueRange;
      data.teamSize = teamEl ? teamEl.value : data.teamSize;
      return true;
    });

    bindConfirm('btn-confirm-financials', 'financials', function() {
      var cashEl = document.getElementById('ob-cash');
      var priceEl = document.getElementById('ob-price');
      var volEl = document.getElementById('ob-volume');
      data.startingCash = cashEl && cashEl.value ? parseFloat(cashEl.value) : '';
      data.avgPrice = priceEl && priceEl.value ? parseFloat(priceEl.value) : '';
      data.monthlyVolume = volEl && volEl.value ? parseFloat(volEl.value) : '';
      return true;
    });

    var skipFinBtn = document.getElementById('btn-skip-financials');
    if (skipFinBtn) skipFinBtn.addEventListener('click', function() {
      confirmed.financials = true;
      checkStageAdvance();
      saveProgress();
      renderWorkspaceStage();
    });

    bindConfirm('btn-confirm-ambition', 'ambition', function() {
      var goalCustom = document.getElementById('ob-goal-custom');
      if (goalCustom && goalCustom.value.trim()) data.goal = goalCustom.value.trim();
      var concernEl = document.getElementById('ob-concern');
      data.concern = concernEl ? concernEl.value.trim() : data.concern;
      return !!data.goal;
    });

    // Edit buttons
    container.querySelectorAll('.ob-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var card = this.dataset.edit;
        confirmed[card] = false;
        // If editing a Stage A card while in B or C, stay at current stage
        renderWorkspaceStage();
      });
    });

    // Hypothesis toggles
    container.querySelectorAll('.ob-hyp-toggle input[type="checkbox"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var idx = parseInt(this.dataset.idx);
        if (!data.selectedHypIds) {
          data.selectedHypIds = data.aiHypotheses.map(function(_, i) { return i; });
        }
        if (this.checked) {
          if (data.selectedHypIds.indexOf(idx) < 0) data.selectedHypIds.push(idx);
        } else {
          data.selectedHypIds = data.selectedHypIds.filter(function(i) { return i !== idx; });
        }
        this.closest('.ob-hyp-toggle').classList.toggle('deselected', !this.checked);
        refreshPreview();
      });
    });

    // Launch button
    var launchBtn = document.getElementById('btn-launch');
    if (launchBtn) launchBtn.addEventListener('click', function() { finish(); });

    // Preview toggle (mobile)
    var toggle = document.getElementById('preview-toggle');
    if (toggle) toggle.addEventListener('click', function() {
      previewExpanded = !previewExpanded;
      var preview = document.getElementById('ob-preview');
      if (preview) preview.classList.toggle('expanded', previewExpanded);
    });
  }

  function bindChips(containerId, arr, onChange) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('.ob-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var val = this.getAttribute('data-val');
        var idx = arr.indexOf(val);
        if (idx >= 0) { arr.splice(idx, 1); this.classList.remove('active'); }
        else { arr.push(val); this.classList.add('active'); }
        if (onChange) onChange();
      });
    });
  }

  function bindGoalChips() {
    var el = document.getElementById('ob-goals');
    if (!el) return;
    el.querySelectorAll('.ob-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        el.querySelectorAll('.ob-chip').forEach(function(c) { c.classList.remove('active'); });
        data.goal = this.getAttribute('data-val');
        this.classList.add('active');
        var custom = document.getElementById('ob-goal-custom');
        if (custom) custom.value = '';
      });
    });
  }

  function bindConfirm(btnId, cardName, validate) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (validate && !validate()) return;
      confirmed[cardName] = true;
      checkStageAdvance();
      saveProgress();
      renderWorkspaceStage();
    });
  }

  function checkStageAdvance() {
    if (cardStage === 'A' && confirmed.identity && confirmed.customers) {
      cardStage = 'B';
    }
    if (cardStage === 'B' && confirmed.economics && confirmed.financials && confirmed.ambition) {
      cardStage = 'C';
      // Generate hypotheses
      if (data.aiHypotheses.length === 0) {
        loading = true;
        renderWorkspaceStage();
        AI.generateHypotheses(data).then(function(result) {
          loading = false;
          data.aiHypotheses = result.hypotheses || [];
          saveProgress();
          renderWorkspaceStage();
        });
      }
    }
  }

  function refreshPreview() {
    var previewEl = document.getElementById('ob-preview');
    if (previewEl) {
      var t = terms();
      var toggle = '<div class="preview-toggle" id="preview-toggle"></div>';
      previewEl.innerHTML = toggle + renderLiveCanvas(t);
      // Rebind preview toggle
      var toggleEl = document.getElementById('preview-toggle');
      if (toggleEl) toggleEl.addEventListener('click', function() {
        previewExpanded = !previewExpanded;
        previewEl.classList.toggle('expanded', previewExpanded);
      });
    }
  }

  function scrollToLatestCard() {
    var cards = container.querySelectorAll('.ob-card:not(.ob-card-done)');
    if (cards.length > 0) {
      var lastCard = cards[cards.length - 1];
      setTimeout(function() {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }

  // ── Actions ──
  function analyzeWebsite() {
    var urlEl = document.getElementById('ob-url');
    var url = urlEl ? urlEl.value.trim() : '';
    if (!url) { skipToManual(); return; }

    data.websiteUrl = url;
    stage = 'analyzing';
    render(container);

    AI.analyzeWebsite(url).then(function(result) {
      if (result.ok && result.data) {
        data.websiteData = result.data;
        if (result.data.businessName) data.name = result.data.businessName;
        if (result.data.type) data.type = result.data.type;
        if (result.data.description) data.description = result.data.description;
        if (result.data.valueProposition) data.proudOf = result.data.valueProposition;
        if (result.data.customerSegments) data.segments = result.data.customerSegments.slice(0, 4);
        if (result.data.greeting) data.greeting = result.data.greeting;

        // Apply brand colors
        if (result.data.brandColors && result.data.brandColors.primary) {
          data.brandColors = result.data.brandColors;
          var palette = AI.generatePalette(result.data.brandColors.primary, result.data.brandColors.secondary);
          if (palette) AI.applyTheme(palette);
        }

        // Save terminology
        var terminology = AI.getTerminology(data.type);
        Store.saveTerminology({ businessType: data.type, labels: terminology });
      }

      stage = 'workspace';
      saveProgress();
      render(container);
    });
  }

  function skipToManual() {
    stage = 'workspace';
    data.greeting = 'Let\'s build your business cockpit from scratch';
    render(container);
  }

  function finish() {
    stage = 'launching';
    render(container);

    // Determine selected hypotheses
    var selectedHyps = [];
    if (data.selectedHypIds) {
      data.selectedHypIds.forEach(function(i) {
        if (data.aiHypotheses[i]) selectedHyps.push(data.aiHypotheses[i]);
      });
    } else {
      selectedHyps = data.aiHypotheses;
    }

    var desc = data.description || data.proudOf || '';

    // Save business
    Store.saveBusiness({
      id: Store.uid(),
      name: data.name || 'My Business',
      type: data.type,
      description: desc,
      proudOf: data.proudOf,
      goal: data.goal,
      concern: data.concern,
      revenueRange: data.revenueRange,
      teamSize: data.teamSize,
      brandColors: data.brandColors,
      createdAt: new Date().toISOString().slice(0, 10),
      stage: data.revenueRange === 'Pre-revenue' ? 'idea' : 'validation'
    });

    // Save terminology
    var terminology = AI.getTerminology(data.type);
    Store.saveTerminology({ businessType: data.type, labels: terminology });

    // Save tool preferences (for action prompts system)
    if (data.toolPrefs && Object.keys(data.toolPrefs).length > 0) {
      Store.saveToolPrefs(data.toolPrefs);
    }

    // Build and save canvas
    var canvas = AI.buildCanvas(data);
    Store.saveCanvas(canvas);

    // Save hypotheses
    selectedHyps.forEach(function(h) { Store.addHypothesis(h); });

    // Build and save simulation config
    if (typeof SimulationTypes !== 'undefined') {
      var simOverrides = {};
      if (data.startingCash) simOverrides.startingCash = data.startingCash;
      if (data.avgPrice || data.monthlyVolume) {
        var tmpl = SimulationTypes.getDefaults(data.type);
        var baseStreams = tmpl.revenueStreams;
        simOverrides.revenueStreams = baseStreams.map(function(rs, i) {
          var s = JSON.parse(JSON.stringify(rs));
          if (i === 0) {
            if (data.avgPrice) s.unitPrice = data.avgPrice;
            if (data.monthlyVolume) s.unitsPerMonth = data.monthlyVolume;
          }
          return s;
        });
      }
      var simConfig = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(),
        canvas,
        simOverrides
      );
      Store.saveSimConfig(simConfig);
    }

    // Clean up
    Store.setWizardComplete();
    Store.clearOnboardingData();

    setTimeout(function() {
      window.location.hash = '#tracker';
      App.render();
    }, 800);
  }

  function reset() {
    stage = 'url';
    cardStage = 'A';
    confirmed = { identity: false, customers: false, economics: false, financials: false, ambition: false };
    data = { websiteUrl: '', websiteData: null, brandColors: null, greeting: '', name: '', type: 'service', description: '', proudOf: '', segments: [], revenueRange: '', costs: [], teamSize: '', goal: '', concern: '', toolPrefs: {}, aiHypotheses: [], selectedHypIds: null, startingCash: '', avgPrice: '', monthlyVolume: '' };
    loading = false;
  }

  function saveProgress() {
    Store.saveOnboardingData({ stage: stage, cardStage: cardStage, confirmed: confirmed, data: data });
  }

  function tryResume() {
    var saved = Store.getOnboardingData();
    if (saved) {
      stage = saved.stage || 'url';
      cardStage = saved.cardStage || 'A';
      if (saved.confirmed) confirmed = saved.confirmed;
      if (saved.data) data = saved.data;
      // Restore theme if brand colors were saved
      if (data.brandColors && data.brandColors.primary) {
        var palette = AI.generatePalette(data.brandColors.primary, data.brandColors.secondary);
        if (palette) {
          AI.restoreTheme();
        }
      }
    }
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return {
    render: function(cont) { tryResume(); render(cont); },
    reset: reset
  };
})();
