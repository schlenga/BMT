// wizard.js — Onboarding wizard + inference engine
'use strict';

var Wizard = (function() {

  // ── Keyword-based business type detection ──
  var TYPE_KEYWORDS = {
    restaurant: ['restaurant','cafe','coffee','bakery','bar','food','cook','kitchen','catering','pizza','sushi','burger','diner','bistro','pub','brewery','juice','tea','ice cream','dessert','meal','chef','dining'],
    retail: ['shop','store','retail','sell','boutique','fashion','clothing','apparel','jewelry','gift','flower','book','furniture','toy','hardware','pet','beauty','cosmetic','shoes'],
    service: ['consult','coach','agency','freelance','design','develop','clean','repair','plumb','electric','account','legal','lawyer','tutor','teach','train','therapy','counsel','photograph','write','market','advise','architect','engineer'],
    saas: ['app','software','platform','saas','tool','automate','dashboard','analytics','api','cloud','mobile app','web app','subscription software'],
    ecommerce: ['online','e-commerce','ecommerce','dropship','marketplace','amazon','etsy','shopify','digital product','print on demand','wholesale online'],
    subscription: ['subscription','membership','box','monthly','recurring','club','community','patron','newsletter']
  };

  function detectType(description) {
    var desc = description.toLowerCase();
    var scores = {};
    for (var type in TYPE_KEYWORDS) {
      scores[type] = 0;
      TYPE_KEYWORDS[type].forEach(function(kw) {
        if (desc.indexOf(kw) >= 0) scores[type] += kw.length;
      });
    }
    var best = 'service', bestScore = 0;
    for (var t in scores) {
      if (scores[t] > bestScore) { bestScore = scores[t]; best = t; }
    }
    return bestScore > 0 ? best : 'service';
  }

  var TYPE_LABELS = {
    restaurant: 'food & drink',
    retail: 'retail / shop',
    service: 'service',
    saas: 'software / SaaS',
    ecommerce: 'e-commerce',
    subscription: 'subscription'
  };

  // ── Suggestion pools ──
  var SEGMENTS = {
    _common: ['Local residents','Young professionals (25-35)','Families','Students','Small businesses','Remote workers'],
    restaurant: ['Office workers nearby','Food enthusiasts','Tourists','Health-conscious eaters','Late-night crowd'],
    retail: ['Gift shoppers','Brand-conscious buyers','Budget shoppers','Collectors','Interior decorators'],
    service: ['Startups','Small business owners','Busy professionals','Growing companies','First-time buyers'],
    saas: ['Solo entrepreneurs','Small teams (2-10)','Marketing managers','Developers','Operations teams'],
    ecommerce: ['Online bargain hunters','Niche hobbyists','Gift buyers','Convenience shoppers'],
    subscription: ['Enthusiasts & hobbyists','Self-improvement seekers','Busy parents','Professionals wanting curation']
  };

  var CHANNELS = {
    _common: ['Word of mouth','Social media (Instagram/TikTok)','Google search / SEO','Local advertising'],
    restaurant: ['Walk-in foot traffic','Food delivery apps','Google Maps / Yelp','Local events'],
    retail: ['Storefront / walk-in','Instagram shopping','Pop-up events','Referral program'],
    service: ['LinkedIn / professional network','Referrals','Content marketing / blog','Cold outreach','Partnerships'],
    saas: ['Product Hunt / directories','Content marketing','Free trial / freemium','Paid ads (Google/FB)','Partnerships / integrations'],
    ecommerce: ['Marketplace listings','Paid social ads','SEO / content','Influencer collaborations','Email marketing'],
    subscription: ['Social media','Influencer partnerships','Free trial / sample','Community forums','Paid ads']
  };

  var REVENUE_MODELS = {
    _common: ['Per unit / sale','Custom pricing'],
    restaurant: ['Menu item sales','Catering services','Delivery commissions','Event hosting'],
    retail: ['Product sales','Wholesale','Custom orders','Repair / alteration services'],
    service: ['Hourly rate','Project-based fee','Monthly retainer','Commission / success fee','Package deals'],
    saas: ['Monthly subscription','Annual subscription','Freemium + premium','Per-seat pricing','Usage-based pricing'],
    ecommerce: ['Product sales','Dropship margin','Digital downloads','Bundle deals'],
    subscription: ['Monthly subscription box','Annual membership','Tiered plans','Add-on purchases']
  };

  var COSTS = {
    _common: ['Marketing & advertising','Insurance','Software & tools'],
    restaurant: ['Rent / lease','Staff wages','Ingredients & supplies','Equipment','Utilities','Licenses & permits'],
    retail: ['Rent / lease','Staff wages','Inventory / stock','Store fixtures','Packaging','Shipping'],
    service: ['Your time','Staff / contractors','Office / coworking','Professional development','Travel'],
    saas: ['Development team','Hosting / infrastructure','Customer support','Sales team','Office / remote tools'],
    ecommerce: ['Inventory','Shipping & fulfillment','Platform fees','Packaging','Returns / refunds','Warehouse'],
    subscription: ['Product sourcing','Packaging & shipping','Platform / tech','Customer acquisition','Content creation']
  };

  function getSuggestions(pool, type) {
    var common = pool._common || [];
    var specific = pool[type] || [];
    // Merge, no duplicates
    var seen = {};
    var result = [];
    specific.concat(common).forEach(function(item) {
      var key = item.toLowerCase();
      if (!seen[key]) { seen[key] = true; result.push(item); }
    });
    return result;
  }

  // ── Hypothesis generation ──
  function generateHypotheses(wizardData) {
    var hyps = [];
    var biz = wizardData;

    // Customer hypotheses
    if (biz.segments && biz.segments.length > 0) {
      biz.segments.forEach(function(seg) {
        hyps.push({
          canvasElement: 'customerSegments',
          category: 'customer',
          statement: seg + ' will be interested in our offering',
          metric: 'Interested prospects from ' + seg,
          target: 10,
          unit: 'people',
          timeframe: 'First month',
          priority: 'critical'
        });
      });
    }

    // Value proposition
    if (biz.problem) {
      hyps.push({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Our solution actually solves the problem for customers',
        metric: 'Customer satisfaction score',
        target: 8,
        unit: 'out of 10',
        timeframe: 'First 3 months',
        priority: 'critical'
      });
      hyps.push({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'At least 50% of first-time customers will return or recommend us',
        metric: 'Repeat / referral rate',
        target: 50,
        unit: '%',
        timeframe: 'First 3 months',
        priority: 'critical'
      });
    }

    // Revenue hypotheses
    if (biz.revenueModels && biz.revenueModels.length > 0) {
      biz.revenueModels.forEach(function(model) {
        hyps.push({
          canvasElement: 'revenueStreams',
          category: 'revenue',
          statement: model + ' will generate meaningful revenue',
          metric: 'Monthly revenue from ' + model.toLowerCase(),
          target: biz.investment ? Math.round(biz.investment / 6) : 1000,
          unit: '$/month',
          timeframe: 'First 3 months',
          priority: 'critical'
        });
      });
    }

    // Channel hypotheses
    if (biz.channels && biz.channels.length > 0) {
      biz.channels.forEach(function(ch) {
        hyps.push({
          canvasElement: 'channels',
          category: 'growth',
          statement: ch + ' will bring in new customers consistently',
          metric: 'New customers from ' + ch.toLowerCase(),
          target: 10,
          unit: 'customers/month',
          timeframe: 'First 3 months',
          priority: 'important'
        });
      });
    }

    // Cost hypotheses
    if (biz.costs && biz.costs.length > 0) {
      var monthlyBudget = biz.investment ? Math.round(biz.investment / 12) : 5000;
      hyps.push({
        canvasElement: 'costStructure',
        category: 'cost',
        statement: 'Total monthly costs will stay within budget',
        metric: 'Total monthly expenses',
        target: monthlyBudget,
        unit: '$/month',
        timeframe: 'Ongoing',
        priority: 'critical'
      });
    }

    // Break-even hypothesis
    if (biz.investment) {
      hyps.push({
        canvasElement: 'revenueStreams',
        category: 'revenue',
        statement: 'We will break even within 12 months',
        metric: 'Months to break even',
        target: 12,
        unit: 'months',
        timeframe: '12 months',
        priority: 'important'
      });
    }

    // General Lean Startup hypothesis
    hyps.push({
      canvasElement: 'valueProp',
      category: 'value',
      statement: 'People are willing to pay for this (not just interested)',
      metric: 'Paying customers',
      target: 5,
      unit: 'paying customers',
      timeframe: 'First month',
      priority: 'critical'
    });

    return hyps;
  }

  // ── Build canvas from wizard data ──
  function buildCanvas(wizardData) {
    var canvas = Store.getCanvas();
    var d = wizardData;

    if (d.segments) d.segments.forEach(function(s) { canvas.customerSegments.push({ id: Store.uid(), text: s, notes: '' }); });
    if (d.problem) canvas.valueProp.push({ id: Store.uid(), text: d.problem, notes: '' });
    if (d.channels) d.channels.forEach(function(c) { canvas.channels.push({ id: Store.uid(), text: c, notes: '' }); });
    if (d.revenueModels) d.revenueModels.forEach(function(r) { canvas.revenueStreams.push({ id: Store.uid(), text: r, notes: '' }); });
    if (d.costs) d.costs.forEach(function(c) { canvas.costStructure.push({ id: Store.uid(), text: c, notes: '' }); });

    // Auto-fill some basics
    canvas.customerRelationships.push({ id: Store.uid(), text: 'Personal interaction', notes: '' });
    canvas.keyActivities.push({ id: Store.uid(), text: 'Deliver core product/service', notes: '' });
    canvas.keyActivities.push({ id: Store.uid(), text: 'Acquire customers', notes: '' });
    canvas.keyResources.push({ id: Store.uid(), text: 'Founding team', notes: '' });

    return canvas;
  }

  // ── Wizard state ──
  var step = 0;
  var data = {
    description: '',
    type: 'service',
    segments: [],
    problem: '',
    revenueModels: [],
    channels: [],
    costs: [],
    investment: 10000,
    name: ''
  };

  var STEPS = [
    { id: 'idea', title: 'Tell us about your business' },
    { id: 'name', title: 'Give it a name' },
    { id: 'customers', title: 'Who are your customers?' },
    { id: 'problem', title: 'What problem do you solve?' },
    { id: 'revenue', title: 'How will you make money?' },
    { id: 'channels', title: 'How will customers find you?' },
    { id: 'costs', title: 'What are your main costs?' },
    { id: 'investment', title: 'Starting investment' },
    { id: 'summary', title: 'Your Business Model' }
  ];

  function render(container) {
    var s = STEPS[step];
    var h = '';

    // Progress bar
    h += '<div class="wiz-progress"><div class="wiz-bar" style="width:' + Math.round((step / (STEPS.length - 1)) * 100) + '%"></div></div>';
    h += '<div class="wiz-step-count">Step ' + (step + 1) + ' of ' + STEPS.length + '</div>';
    h += '<h2 class="wiz-title">' + s.title + '</h2>';

    switch(s.id) {
      case 'idea':
        h += '<p class="wiz-hint">Describe your business idea in a few sentences. What will you offer?</p>';
        h += '<textarea class="wiz-textarea" id="wiz-desc" placeholder="e.g. A cozy neighborhood coffee shop specializing in single-origin pour-over coffee and fresh pastries...">' + esc(data.description) + '</textarea>';
        if (data.description.length > 10) {
          var detected = detectType(data.description);
          data.type = detected;
          h += '<div class="wiz-insight">Sounds like a <strong>' + TYPE_LABELS[detected] + '</strong> business!</div>';
        }
        break;

      case 'name':
        h += '<p class="wiz-hint">What do you want to call your business?</p>';
        h += '<input class="wiz-input" id="wiz-name" placeholder="e.g. Morning Brew, Pixel Studio, Fresh & Fast..." value="' + esc(data.name) + '">';
        break;

      case 'customers':
        var segs = getSuggestions(SEGMENTS, data.type);
        h += '<p class="wiz-hint">Pick the groups most likely to buy from you, or add your own.</p>';
        h += '<div class="wiz-chips" id="wiz-segs">';
        segs.forEach(function(seg) {
          var active = data.segments.indexOf(seg) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(seg) + '">' + esc(seg) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-seg-custom" placeholder="Type to add your own...">';
        h += '<div class="wiz-selected" id="wiz-seg-list">';
        data.segments.forEach(function(seg) {
          var isCustom = segs.indexOf(seg) < 0;
          if (isCustom) h += '<span class="wiz-chip active" data-val="' + esc(seg) + '">' + esc(seg) + ' &times;</span>';
        });
        h += '</div>';
        break;

      case 'problem':
        h += '<p class="wiz-hint">What frustration or need do you address? Think about why someone would pay you.</p>';
        h += '<textarea class="wiz-textarea" id="wiz-problem" placeholder="e.g. People in our area can\'t find quality specialty coffee without driving 20 minutes...">' + esc(data.problem) + '</textarea>';
        break;

      case 'revenue':
        var revs = getSuggestions(REVENUE_MODELS, data.type);
        h += '<p class="wiz-hint">How will money come in? Pick all that apply.</p>';
        h += '<div class="wiz-chips" id="wiz-revs">';
        revs.forEach(function(r) {
          var active = data.revenueModels.indexOf(r) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(r) + '">' + esc(r) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-rev-custom" placeholder="Type to add your own...">';
        break;

      case 'channels':
        var chs = getSuggestions(CHANNELS, data.type);
        h += '<p class="wiz-hint">How will people discover your business? Pick the most promising.</p>';
        h += '<div class="wiz-chips" id="wiz-chs">';
        chs.forEach(function(ch) {
          var active = data.channels.indexOf(ch) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(ch) + '">' + esc(ch) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-ch-custom" placeholder="Type to add your own...">';
        break;

      case 'costs':
        var costs = getSuggestions(COSTS, data.type);
        h += '<p class="wiz-hint">What will you spend money on? Pick your main cost categories.</p>';
        h += '<div class="wiz-chips" id="wiz-costs">';
        costs.forEach(function(c) {
          var active = data.costs.indexOf(c) >= 0;
          h += '<span class="wiz-chip' + (active ? ' active' : '') + '" data-val="' + esc(c) + '">' + esc(c) + '</span>';
        });
        h += '</div>';
        h += '<input class="wiz-input wiz-add-input" id="wiz-cost-custom" placeholder="Type to add your own...">';
        break;

      case 'investment':
        h += '<p class="wiz-hint">Roughly how much are you investing to get started?</p>';
        h += '<div class="wiz-slider-wrap">';
        h += '<input type="range" class="wiz-range" id="wiz-invest" min="1000" max="500000" step="1000" value="' + data.investment + '">';
        h += '<div class="wiz-range-val" id="wiz-invest-val">$' + data.investment.toLocaleString() + '</div>';
        h += '</div>';
        h += '<div class="wiz-range-labels"><span>$1,000</span><span>$500,000</span></div>';
        break;

      case 'summary':
        h += renderSummary();
        break;
    }

    // Navigation buttons
    h += '<div class="wiz-nav">';
    if (step > 0) h += '<button class="wiz-btn wiz-btn-back" onclick="Wizard.prev()">Back</button>';
    if (s.id === 'summary') {
      h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.finish()">Start Tracking</button>';
    } else {
      h += '<button class="wiz-btn wiz-btn-primary" onclick="Wizard.next()">Continue</button>';
    }
    h += '</div>';

    container.innerHTML = h;
    bindEvents();
  }

  function renderSummary() {
    var h = '<div class="wiz-summary">';
    h += '<div class="wiz-summary-biz"><strong>' + esc(data.name || 'Your Business') + '</strong> &mdash; ' + TYPE_LABELS[data.type] + '</div>';
    h += '<p class="wiz-hint">' + esc(data.description) + '</p>';

    h += '<div class="wiz-summary-grid">';
    h += summaryCard('Customers', data.segments);
    h += summaryCard('Value Proposition', [data.problem]);
    h += summaryCard('Revenue', data.revenueModels);
    h += summaryCard('Channels', data.channels);
    h += summaryCard('Costs', data.costs);
    h += '<div class="wiz-summary-card"><div class="wiz-summary-label">Starting Investment</div><div class="wiz-summary-items">$' + data.investment.toLocaleString() + '</div></div>';
    h += '</div>';

    var hyps = generateHypotheses(data);
    h += '<h3 class="wiz-subtitle">We created ' + hyps.length + ' testable hypotheses for you</h3>';
    h += '<p class="wiz-hint">These are based on your answers. You can edit or add more later in the Tracker.</p>';
    h += '<div class="wiz-hyp-preview">';
    hyps.forEach(function(hyp) {
      var catColors = { customer: '#e67e22', value: '#2ecc71', revenue: '#3498db', growth: '#9b59b6', cost: '#e74c3c' };
      h += '<div class="wiz-hyp-card"><span class="wiz-hyp-cat" style="background:' + (catColors[hyp.category] || '#999') + '">' + hyp.category + '</span> ' + esc(hyp.statement) + '</div>';
    });
    h += '</div>';
    h += '</div>';
    return h;
  }

  function summaryCard(label, items) {
    var h = '<div class="wiz-summary-card"><div class="wiz-summary-label">' + label + '</div><div class="wiz-summary-items">';
    if (items && items.length) {
      items.forEach(function(item) { if (item) h += '<span class="wiz-chip active">' + esc(item) + '</span>'; });
    } else {
      h += '<span class="wiz-empty">Not specified yet</span>';
    }
    h += '</div></div>';
    return h;
  }

  function bindEvents() {
    // Textarea / input change handlers
    var desc = document.getElementById('wiz-desc');
    if (desc) desc.addEventListener('input', function() { data.description = this.value; if (this.value.length > 10) render(document.getElementById('app')); });

    var nameInput = document.getElementById('wiz-name');
    if (nameInput) nameInput.addEventListener('input', function() { data.name = this.value; });

    var prob = document.getElementById('wiz-problem');
    if (prob) prob.addEventListener('input', function() { data.problem = this.value; });

    // Chips
    bindChips('wiz-segs', data.segments, 'wiz-seg-custom');
    bindChips('wiz-revs', data.revenueModels, 'wiz-rev-custom');
    bindChips('wiz-chs', data.channels, 'wiz-ch-custom');
    bindChips('wiz-costs', data.costs, 'wiz-cost-custom');

    // Slider
    var invest = document.getElementById('wiz-invest');
    if (invest) {
      invest.addEventListener('input', function() {
        data.investment = parseInt(this.value);
        var valEl = document.getElementById('wiz-invest-val');
        if (valEl) valEl.textContent = '$' + data.investment.toLocaleString();
      });
    }
  }

  function bindChips(containerId, arr, customInputId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.wiz-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var val = this.getAttribute('data-val');
        var idx = arr.indexOf(val);
        if (idx >= 0) { arr.splice(idx, 1); this.classList.remove('active'); }
        else { arr.push(val); this.classList.add('active'); }
      });
    });

    var customInput = document.getElementById(customInputId);
    if (customInput) {
      customInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          var val = this.value.trim();
          if (arr.indexOf(val) < 0) arr.push(val);
          this.value = '';
          render(document.getElementById('app'));
        }
      });
    }
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function next() {
    if (step < STEPS.length - 1) { step++; render(document.getElementById('app')); }
  }

  function prev() {
    if (step > 0) { step--; render(document.getElementById('app')); }
  }

  function finish() {
    // Save business
    Store.saveBusiness({
      id: Store.uid(),
      name: data.name || 'My Business',
      type: data.type,
      description: data.description,
      createdAt: new Date().toISOString().slice(0, 10),
      stage: 'idea'
    });

    // Build and save canvas
    var canvas = buildCanvas(data);
    Store.saveCanvas(canvas);

    // Generate and save hypotheses
    var hyps = generateHypotheses(data);
    hyps.forEach(function(h) { Store.addHypothesis(h); });

    Store.setWizardComplete();

    // Navigate to tracker
    window.location.hash = '#tracker';
    App.render();
  }

  function reset() {
    step = 0;
    data = { description: '', type: 'service', segments: [], problem: '', revenueModels: [], channels: [], costs: [], investment: 10000, name: '' };
  }

  return {
    render: render,
    next: next,
    prev: prev,
    finish: finish,
    reset: reset
  };
})();
