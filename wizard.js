// wizard.js — Conversational split-screen onboarding
'use strict';

var Wizard = (function() {

  // ── State ──
  var step = 0;
  var messages = []; // { type: 'system'|'user', content: string, stepId: string }
  var data = {
    websiteUrl: '',
    websiteData: null,
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
    selectedHypIds: null // null = all selected
  };
  var loading = false;
  var previewExpanded = false;
  var container = null;

  var STEPS = [
    { id: 'website', prompt: 'Hey! Let\'s map out your business together. Got a website? Drop the URL and I\'ll take a head start.' },
    { id: 'proud', prompt: 'What are you most proud of about your business? Could be your product, your approach, your customers \u2014 anything that makes you excited.' },
    { id: 'customers', prompt: 'Who are your best customers? The ones who really love what you do.' },
    { id: 'economics', prompt: 'How\'s business going right now? Just ballpark numbers \u2014 no judgment!' },
    { id: 'goal', prompt: 'What\'s your biggest goal for the next 6 months?' },
    { id: 'concerns', prompt: 'Almost there! What keeps you up at night about this business?' },
    { id: 'toolkit', prompt: 'One more thing \u2014 what tools do you already use to run your business? This helps me suggest specific actions later.' },
    { id: 'hypotheses', prompt: 'Based on everything you\'ve told me, here are hypotheses to test. These are specific to YOUR business.' }
  ];

  // ── Rendering ──
  function render(cont) {
    container = cont;
    var h = '<div class="onboarding">';
    h += '<div class="onboarding-conv">';
    h += '<div class="conv-thread" id="conv-thread">';
    h += renderMessages();
    h += '</div>';
    h += renderInputArea();
    h += '<div class="conv-progress"><div class="conv-progress-bar" style="width:' + Math.round(((step + 1) / STEPS.length) * 100) + '%"></div></div>';
    h += '</div>';
    h += '<div class="onboarding-preview' + (previewExpanded ? ' expanded' : '') + '" id="onboarding-preview">';
    h += '<div class="preview-toggle" id="preview-toggle"></div>';
    h += renderPreview();
    h += '</div>';
    h += '</div>';
    cont.innerHTML = h;
    bindEvents();
    scrollThread();
  }

  function renderMessages() {
    var h = '';
    // Show all past messages
    messages.forEach(function(msg) {
      if (msg.type === 'system') {
        h += '<div class="conv-msg conv-system"><div class="conv-avatar">BMT</div><div class="conv-bubble">' + msg.content + '</div></div>';
      } else {
        h += '<div class="conv-msg conv-user"><div class="conv-avatar">You</div><div class="conv-bubble conv-answered">' + msg.content + '</div></div>';
      }
    });
    // Current step system message (if not already added)
    var s = STEPS[step];
    if (!messages.length || messages[messages.length - 1].stepId !== s.id || messages[messages.length - 1].type !== 'system') {
      var prompt = s.prompt;
      // Customize prompt based on website data
      if (s.id === 'proud' && data.websiteData && data.websiteData.description) {
        prompt = 'From your site it looks like <strong>' + esc(data.websiteData.description) + '</strong>. ' + prompt;
      }
      h += '<div class="conv-msg conv-system"><div class="conv-avatar">BMT</div><div class="conv-bubble">' + prompt + '</div></div>';
    }
    // Typing indicator
    if (loading) {
      h += '<div class="conv-msg conv-system conv-typing"><div class="conv-avatar">BMT</div><div class="conv-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>';
    }
    return h;
  }

  function renderInputArea() {
    var s = STEPS[step];
    var h = '<div class="conv-input-area" id="conv-input">';

    if (loading) {
      h += '<div class="wiz-hint" style="text-align:center;margin:0">Thinking...</div>';
      h += '</div>';
      return h;
    }

    switch(s.id) {
      case 'website':
        h += '<input class="wiz-input" id="wiz-url" type="url" placeholder="https://yourbusiness.com" value="' + esc(data.websiteUrl) + '">';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:space-between">';
        h += '<button class="wiz-btn wiz-btn-back" onclick="Wizard.skipWebsite()">Skip \u2014 no website</button>';
        h += '<button class="wiz-btn wiz-btn-primary" id="btn-analyze" onclick="Wizard.analyzeWebsite()">Analyze</button>';
        h += '</div>';
        break;

      case 'proud':
        if (data.websiteData && data.websiteData.businessName && !data.name) {
          data.name = data.websiteData.businessName;
        }
        h += '<div class="wiz-field-group">';
        h += '<div><div class="wiz-field-label">Business name</div>';
        h += '<input class="wiz-input" id="wiz-name" placeholder="Your business name" value="' + esc(data.name) + '"></div>';
        h += '<div><div class="wiz-field-label">What makes you proud?</div>';
        h += '<textarea class="wiz-textarea" id="wiz-proud" placeholder="e.g. We source the best local ingredients, our customers become friends, we\'ve built something from nothing...">' + esc(data.proudOf) + '</textarea></div>';
        h += '</div>';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitProud()">Continue</button>';
        h += '</div>';
        break;

      case 'customers':
        var type = data.type || 'service';
        var segs = AI.getSuggestions(AI.SEGMENTS, type);
        h += '<div class="wiz-chips" id="wiz-segs">';
        segs.forEach(function(seg) {
          var active = data.segments.indexOf(seg) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(seg) + '">' + esc(seg) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-seg-custom" placeholder="Type to add your own and press Enter...">';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitCustomers()">Continue</button>';
        h += '</div>';
        break;

      case 'economics':
        h += '<div class="wiz-field-group">';
        h += '<div><div class="wiz-field-label">Monthly revenue</div>';
        h += '<select class="wiz-select" id="wiz-revenue">';
        ['Pre-revenue','$0 - $1K','$1K - $5K','$5K - $20K','$20K - $50K','$50K - $100K','$100K+'].forEach(function(opt) {
          h += '<option' + (data.revenueRange === opt ? ' selected' : '') + '>' + opt + '</option>';
        });
        h += '</select></div>';
        h += '<div><div class="wiz-field-label">Team size</div>';
        h += '<select class="wiz-select" id="wiz-team">';
        ['Just me','2-5','6-15','16-50','50+'].forEach(function(opt) {
          h += '<option' + (data.teamSize === opt ? ' selected' : '') + '>' + opt + '</option>';
        });
        h += '</select></div>';
        h += '<div><div class="wiz-field-label">Main costs</div>';
        var costs = AI.getSuggestions(AI.COSTS, data.type);
        h += '<div class="wiz-chips" id="wiz-costs">';
        costs.forEach(function(c) {
          var active = data.costs.indexOf(c) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(c) + '">' + esc(c) + '</span>';
        });
        h += '</div></div>';
        h += '</div>';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitEconomics()">Continue</button>';
        h += '</div>';
        break;

      case 'goal':
        h += '<div class="wiz-chips" id="wiz-goals">';
        AI.GOALS.forEach(function(g) {
          var active = data.goal === g;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(g) + '">' + esc(g) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-goal-custom" placeholder="Or type your own goal..." value="' + (AI.GOALS.indexOf(data.goal) < 0 ? esc(data.goal) : '') + '">';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitGoal()">Continue</button>';
        h += '</div>';
        break;

      case 'concerns':
        h += '<textarea class="wiz-textarea" id="wiz-concern" placeholder="e.g. Not enough customers, cash flow, competition, hiring the right people...">' + esc(data.concern) + '</textarea>';
        h += '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitConcerns()">Continue</button>';
        h += '</div>';
        break;

      case 'toolkit':
        Prompts.TOOL_CATEGORIES.forEach(function(cat) {
          h += '<div class="wiz-field-label" style="margin-top:10px">' + esc(cat.label) + '</div>';
          h += '<div class="wiz-chips wiz-tool-chips" data-cat="' + cat.id + '">';
          cat.tools.forEach(function(tid) {
            var t = Prompts.TOOL_CONNECTORS[tid];
            if (!t) return;
            var active = data.toolPrefs[cat.id] && data.toolPrefs[cat.id].indexOf(tid) >= 0;
            h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + tid + '" data-cat="' + cat.id + '">' + t.icon + ' ' + esc(t.name) + '</span>';
          });
          h += '</div>';
        });
        h += '<div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between">';
        h += '<button class="wiz-btn wiz-btn-back" onclick="Wizard.skipToolkit()">Skip</button>';
        h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.submitToolkit()">Continue</button>';
        h += '</div>';
        break;

      case 'hypotheses':
        if (data.aiHypotheses.length > 0) {
          h += renderHypothesisToggles();
          h += '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">';
          h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.finish()">Start Tracking</button>';
          h += '</div>';
        }
        break;
    }

    h += '</div>';
    return h;
  }

  function renderHypothesisToggles() {
    var h = '';
    var catColors = { customer: '#e67e22', value: '#2ecc71', revenue: '#3498db', growth: '#9b59b6', cost: '#e74c3c' };
    data.aiHypotheses.forEach(function(hyp, i) {
      var selected = !data.selectedHypIds || data.selectedHypIds.indexOf(i) >= 0;
      h += '<label class="wiz-hyp-toggle' + (selected ? '' : ' deselected') + '">';
      h += '<input type="checkbox" data-idx="' + i + '"' + (selected ? ' checked' : '') + '>';
      h += '<div class="wiz-hyp-text">';
      h += '<span class="wiz-hyp-cat" style="background:' + (catColors[hyp.category] || '#999') + '">' + esc(hyp.category) + '</span>';
      h += '<div class="wiz-hyp-statement">' + esc(hyp.statement) + '</div>';
      if (hyp.rationale) h += '<div class="wiz-hyp-detail">' + esc(hyp.rationale) + '</div>';
      h += '<div class="wiz-hyp-detail">Target: ' + hyp.target + ' ' + esc(hyp.unit || '') + ' \u2014 ' + esc(hyp.timeframe || '') + '</div>';
      h += '</div></label>';
    });
    return h;
  }

  // ── Preview Panel ──
  function renderPreview() {
    var h = '<div class="preview-header">Your Business Model</div>';
    h += renderMiniCanvas();
    if (data.aiHypotheses.length > 0 && step >= 7) {
      h += '<div class="preview-hyp-section">';
      h += '<div class="preview-header" style="margin-top:16px">Hypotheses</div>';
      var catColors = { customer: '#e67e22', value: '#2ecc71', revenue: '#3498db', growth: '#9b59b6', cost: '#e74c3c' };
      data.aiHypotheses.forEach(function(hyp, i) {
        var selected = !data.selectedHypIds || data.selectedHypIds.indexOf(i) >= 0;
        if (!selected) return;
        h += '<div class="preview-hyp-card" style="animation-delay:' + (i * 0.1) + 's;opacity:1">';
        h += '<span class="wiz-hyp-cat" style="background:' + (catColors[hyp.category] || '#999') + '">' + esc(hyp.category) + '</span> ';
        h += esc(hyp.statement);
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function renderMiniCanvas() {
    var cells = [
      { key: 'keyPartners', label: 'Partners', tall: true, items: [] },
      { key: 'keyActivities', label: 'Activities', half: true, items: ['Deliver product/service', 'Acquire customers'] },
      { key: 'keyResources', label: 'Resources', half: true, items: ['Founding team'] },
      { key: 'valueProp', label: 'Value Prop', tall: true, items: [] },
      { key: 'customerRelationships', label: 'Relations', half: true, items: ['Personal interaction'] },
      { key: 'channels', label: 'Channels', half: true, items: [] },
      { key: 'customerSegments', label: 'Customers', tall: true, items: [] },
      { key: 'costStructure', label: 'Costs', wide: true, wideClass: 'preview-cell-costs', items: [] },
      { key: 'revenueStreams', label: 'Revenue', wide: true, wideClass: 'preview-cell-revenue', items: [] }
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

    var activeKey = '';
    if (step === 1) activeKey = 'valueProp';
    if (step === 2) activeKey = 'customerSegments';
    if (step === 3) activeKey = 'costStructure';

    var h = '<div class="preview-mini-canvas">';
    cells.forEach(function(cell) {
      var classes = 'preview-cell';
      if (cell.tall) classes += ' preview-cell-tall';
      if (cell.wide) classes += ' preview-cell-wide ' + (cell.wideClass || '');
      if (cell.half) classes += ' preview-cell-half';
      if (cell.key === activeKey) classes += ' active';
      if (!cell.items.length) classes += ' empty';
      h += '<div class="' + classes + '">';
      h += '<div class="preview-cell-label">' + cell.label + '</div>';
      cell.items.forEach(function(item) {
        h += '<div class="preview-cell-item">' + esc(typeof item === 'string' ? item : '') + '</div>';
      });
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  // ── Event Binding ──
  function bindEvents() {
    bindChips('wiz-segs', data.segments);
    bindChips('wiz-costs', data.costs);
    bindGoalChips();
    bindCustomInputs();
    bindToolkitChips();
    bindPreviewToggle();
    bindHypToggles();
  }

  function bindChips(containerId, arr) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('.wiz-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var val = this.getAttribute('data-val');
        var idx = arr.indexOf(val);
        if (idx >= 0) { arr.splice(idx, 1); this.classList.remove('active'); }
        else { arr.push(val); this.classList.add('active'); }
        refreshPreview();
      });
    });
  }

  function bindGoalChips() {
    var el = document.getElementById('wiz-goals');
    if (!el) return;
    el.querySelectorAll('.wiz-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        el.querySelectorAll('.wiz-chip').forEach(function(c) { c.classList.remove('active'); });
        data.goal = this.getAttribute('data-val');
        this.classList.add('active');
        var custom = document.getElementById('wiz-goal-custom');
        if (custom) custom.value = '';
      });
    });
  }

  function bindCustomInputs() {
    var segInput = document.getElementById('wiz-seg-custom');
    if (segInput) segInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && this.value.trim()) {
        var val = this.value.trim();
        if (data.segments.indexOf(val) < 0) data.segments.push(val);
        this.value = '';
        render(container);
      }
    });

    var goalInput = document.getElementById('wiz-goal-custom');
    if (goalInput) goalInput.addEventListener('input', function() {
      if (this.value.trim()) {
        data.goal = this.value.trim();
        var el = document.getElementById('wiz-goals');
        if (el) el.querySelectorAll('.wiz-chip').forEach(function(c) { c.classList.remove('active'); });
      }
    });
  }

  function bindToolkitChips() {
    document.querySelectorAll('.wiz-tool-chips .wiz-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var tid = this.getAttribute('data-val');
        var cat = this.getAttribute('data-cat');
        if (!data.toolPrefs[cat]) data.toolPrefs[cat] = [];
        var idx = data.toolPrefs[cat].indexOf(tid);
        if (idx >= 0) { data.toolPrefs[cat].splice(idx, 1); this.classList.remove('active'); }
        else { data.toolPrefs[cat].push(tid); this.classList.add('active'); }
      });
    });
  }

  function bindPreviewToggle() {
    var toggle = document.getElementById('preview-toggle');
    if (toggle) toggle.addEventListener('click', function() {
      previewExpanded = !previewExpanded;
      var preview = document.getElementById('onboarding-preview');
      if (preview) preview.classList.toggle('expanded', previewExpanded);
    });
  }

  function bindHypToggles() {
    document.querySelectorAll('.wiz-hyp-toggle input[type="checkbox"]').forEach(function(cb) {
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
        this.closest('.wiz-hyp-toggle').classList.toggle('deselected', !this.checked);
        refreshPreview();
      });
    });
  }

  function scrollThread() {
    var thread = document.getElementById('conv-thread');
    if (thread) setTimeout(function() { thread.scrollTop = thread.scrollHeight; }, 50);
  }

  function refreshPreview() {
    var previewEl = document.getElementById('onboarding-preview');
    if (previewEl) {
      var toggle = '<div class="preview-toggle" id="preview-toggle"></div>';
      previewEl.innerHTML = toggle + renderPreview();
      bindPreviewToggle();
    }
  }

  function addUserMessage(content) {
    messages.push({ type: 'user', content: content, stepId: STEPS[step].id });
  }

  function addSystemMessage(content) {
    messages.push({ type: 'system', content: content, stepId: STEPS[step].id });
  }

  function advanceStep() {
    step++;
    saveProgress();
    render(container);
  }

  function saveProgress() {
    Store.saveOnboardingData({ step: step, data: data, messages: messages });
  }

  // ── Step handlers ──
  function analyzeWebsite() {
    var urlEl = document.getElementById('wiz-url');
    var url = urlEl ? urlEl.value.trim() : '';
    if (!url) { skipWebsite(); return; }

    data.websiteUrl = url;
    addUserMessage('<div class="conv-answer-label">Website</div><div class="conv-answer-value">' + esc(url) + '</div>');
    loading = true;
    render(container);

    AI.analyzeWebsite(url).then(function(result) {
      loading = false;
      if (result.ok && result.data) {
        data.websiteData = result.data;
        if (result.data.businessName) data.name = result.data.businessName;
        if (result.data.type) data.type = result.data.type;
        if (result.data.description) data.description = result.data.description;
        if (result.data.customerSegments) data.segments = result.data.customerSegments.slice(0, 3);
        addSystemMessage('Got it! I found some info about your business. Let\'s build on that.');
      } else {
        addSystemMessage('I couldn\'t access your website, but no worries \u2014 let\'s build your model from what you tell me.');
      }
      advanceStep();
    });
  }

  function skipWebsite() {
    addUserMessage('<div class="conv-answer-value" style="color:var(--text3)">Skipped</div>');
    advanceStep();
  }

  function submitProud() {
    var nameEl = document.getElementById('wiz-name');
    var proudEl = document.getElementById('wiz-proud');
    data.name = nameEl ? nameEl.value.trim() : data.name;
    data.proudOf = proudEl ? proudEl.value.trim() : '';
    if (!data.proudOf && !data.name) return; // need at least something

    if (!data.type || data.type === 'service') {
      data.type = AI.detectType(data.proudOf + ' ' + data.description + ' ' + data.name);
    }

    addUserMessage(
      '<div class="conv-answer-label">' + esc(data.name || 'My Business') + '</div>' +
      '<div class="conv-answer-value">' + esc(data.proudOf || 'Not specified') + '</div>'
    );
    advanceStep();
  }

  function submitCustomers() {
    if (!data.segments.length) return;
    addUserMessage('<div class="conv-answer-label">Best customers</div><div class="conv-answer-value">' + data.segments.map(esc).join(', ') + '</div>');
    advanceStep();
  }

  function submitEconomics() {
    var revEl = document.getElementById('wiz-revenue');
    var teamEl = document.getElementById('wiz-team');
    data.revenueRange = revEl ? revEl.value : '';
    data.teamSize = teamEl ? teamEl.value : '';

    addUserMessage(
      '<div class="conv-answer-label">Economics</div>' +
      '<div class="conv-answer-value">Revenue: ' + esc(data.revenueRange) +
      ' \u2022 Team: ' + esc(data.teamSize) +
      ' \u2022 Costs: ' + data.costs.map(esc).join(', ') + '</div>'
    );
    advanceStep();
  }

  function submitGoal() {
    var customEl = document.getElementById('wiz-goal-custom');
    if (customEl && customEl.value.trim()) data.goal = customEl.value.trim();
    if (!data.goal) return;

    addUserMessage('<div class="conv-answer-label">6-month goal</div><div class="conv-answer-value">' + esc(data.goal) + '</div>');
    advanceStep();
  }

  function submitConcerns() {
    var el = document.getElementById('wiz-concern');
    data.concern = el ? el.value.trim() : '';

    addUserMessage('<div class="conv-answer-label">Biggest concern</div><div class="conv-answer-value">' + esc(data.concern || 'Nothing specific') + '</div>');
    advanceStep();
  }

  function submitToolkit() {
    var toolNames = [];
    Object.keys(data.toolPrefs).forEach(function(cat) {
      if (data.toolPrefs[cat] && data.toolPrefs[cat].length) {
        data.toolPrefs[cat].forEach(function(tid) {
          var t = Prompts.TOOL_CONNECTORS[tid];
          if (t) toolNames.push(t.name);
        });
      }
    });
    addUserMessage('<div class="conv-answer-label">Tools</div><div class="conv-answer-value">' + (toolNames.length ? toolNames.map(esc).join(', ') : 'None selected') + '</div>');

    // Generate hypotheses
    loading = true;
    render(container);

    AI.generateHypotheses(data).then(function(result) {
      loading = false;
      data.aiHypotheses = result.hypotheses || [];
      if (result.source === 'ai') {
        addSystemMessage('Here are personalized hypotheses based on your business. Toggle off any that don\'t feel right.');
      } else {
        addSystemMessage('Here are some starter hypotheses to test. You can always add more later in the Tracker.');
      }
      advanceStep();
    });
  }

  function skipToolkit() {
    addUserMessage('<div class="conv-answer-value" style="color:var(--text3)">Skipped</div>');

    // Generate hypotheses
    loading = true;
    render(container);

    AI.generateHypotheses(data).then(function(result) {
      loading = false;
      data.aiHypotheses = result.hypotheses || [];
      if (result.source === 'ai') {
        addSystemMessage('Here are personalized hypotheses based on your business. Toggle off any that don\'t feel right.');
      } else {
        addSystemMessage('Here are some starter hypotheses to test. You can always add more later in the Tracker.');
      }
      advanceStep();
    });
  }

  function finish() {
    // Determine which hypotheses are selected
    var selectedHyps = [];
    if (data.selectedHypIds) {
      data.selectedHypIds.forEach(function(i) {
        if (data.aiHypotheses[i]) selectedHyps.push(data.aiHypotheses[i]);
      });
    } else {
      selectedHyps = data.aiHypotheses;
    }

    // Build description
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
      createdAt: new Date().toISOString().slice(0, 10),
      stage: data.revenueRange === 'Pre-revenue' ? 'idea' : 'validation'
    });

    // Build and save canvas
    var canvas = AI.buildCanvas(data);
    Store.saveCanvas(canvas);

    // Save hypotheses
    selectedHyps.forEach(function(h) { Store.addHypothesis(h); });

    // Save tool preferences
    if (data.toolPrefs && Object.keys(data.toolPrefs).length) {
      Store.saveToolPrefs(data.toolPrefs);
    }

    // Clean up
    Store.setWizardComplete();
    Store.clearOnboardingData();

    window.location.hash = '#tracker';
    App.render();
  }

  function reset() {
    step = 0;
    messages = [];
    data = { websiteUrl: '', websiteData: null, name: '', type: 'service', description: '', proudOf: '', segments: [], revenueRange: '', costs: [], teamSize: '', goal: '', concern: '', toolPrefs: {}, aiHypotheses: [], selectedHypIds: null };
    loading = false;
  }

  // Try to resume from saved progress
  function tryResume() {
    var saved = Store.getOnboardingData();
    if (saved) {
      step = saved.step || 0;
      data = saved.data || data;
      messages = saved.messages || [];
    }
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return {
    render: function(cont) { tryResume(); render(cont); },
    analyzeWebsite: analyzeWebsite,
    skipWebsite: skipWebsite,
    submitProud: submitProud,
    submitCustomers: submitCustomers,
    submitEconomics: submitEconomics,
    submitGoal: submitGoal,
    submitConcerns: submitConcerns,
    submitToolkit: submitToolkit,
    skipToolkit: skipToolkit,
    finish: finish,
    reset: reset
  };
})();
