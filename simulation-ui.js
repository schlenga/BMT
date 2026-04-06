// simulation-ui.js — Dashboard rendering for simulation results
'use strict';

var SimulationUI = (function() {

  var currentScenario = 'base';
  var editMode = false;
  var activeConfig = null;

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /**
   * Main render — called by App router
   */
  function render(container) {
    // Load or build config
    activeConfig = Store.getSimConfig();
    if (!activeConfig) {
      var biz = Store.getBusiness();
      var canvas = Store.getCanvas();
      activeConfig = SimulationTypes.buildConfigFromWizard(biz, canvas);
      Store.saveSimConfig(activeConfig);
    }

    // Run simulation
    activeConfig.scenario = currentScenario;
    var allScenarios = SimEngine.runScenarios(activeConfig);
    var results = allScenarios[currentScenario];
    Store.saveSimResults(results);

    var cur = SimEngine.currency;
    var pct = SimEngine.pct;
    var summary = results.summary;
    var months = results.months;
    var years = results.years;

    var biz = Store.getBusiness();
    var bizType = (biz && biz.type) || 'service';
    var labels = SimulationTypes.getKpiLabels(bizType);

    var h = '';

    // ── Header ──
    h += '<div class="sim-header">';
    h += '<div class="sim-title-row">';
    h += '<h2 class="page-title">Financial Projection</h2>';
    h += '<button class="btn-warm sim-edit-btn" id="sim-toggle-edit">' + (editMode ? 'Done' : 'Edit Assumptions') + '</button>';
    h += '</div>';

    // ── Scenario toggle ──
    h += '<div class="sim-scenarios">';
    ['pessimistic', 'base', 'optimistic'].forEach(function(sc) {
      var scLabels = { pessimistic: 'Pessimistic', base: 'Base Case', optimistic: 'Optimistic' };
      h += '<div class="sim-sc' + (currentScenario === sc ? ' active' : '') + '" data-scenario="' + sc + '">' + scLabels[sc] + '</div>';
    });
    h += '</div>';
    h += '</div>';

    // ── KPI Strip ──
    h += '<div class="sim-kpi-strip">';
    h += kpiCard('Break-even', summary.breakEvenMonth ? 'Month ' + summary.breakEvenMonth : 'Not yet', summary.breakEvenMonth ? 'green' : 'amber');
    h += kpiCard('Funding Needed', cur(summary.peakCashNeeded), summary.peakCashNeeded > 0 ? 'red' : 'green');
    h += kpiCard('Y1 Revenue', cur(summary.year1Revenue), 'blue');
    h += kpiCard('Y3 Cash', cur(summary.year3CashBalance), summary.year3CashBalance >= 0 ? 'green' : 'red');
    h += kpiCard('Gross Margin', pct(summary.avgGrossMargin), summary.avgGrossMargin >= 40 ? 'green' : 'amber');
    h += kpiCard('Final Monthly', cur(summary.finalMonthlyNet) + '/mo', summary.finalMonthlyNet >= 0 ? 'green' : 'red');
    h += '</div>';

    // ── Cash Flow Chart ──
    h += '<div class="sim-section">';
    h += '<div class="sim-section-header"><span class="sim-sec-num">01</span><span class="sim-sec-title">Cash Position Over Time</span></div>';
    h += '<div class="sim-chart-wrap">' + renderCashChart(allScenarios, months.length) + '</div>';
    h += '</div>';

    // ── Monthly P&L Chart (revenue vs costs bars) ──
    h += '<div class="sim-section">';
    h += '<div class="sim-section-header"><span class="sim-sec-num">02</span><span class="sim-sec-title">Revenue vs Costs</span></div>';
    h += '<div class="sim-chart-wrap">' + renderRevenueChart(months) + '</div>';
    h += '</div>';

    // ── Consolidated P&L Table ──
    h += '<div class="sim-section">';
    h += '<div class="sim-section-header"><span class="sim-sec-num">03</span><span class="sim-sec-title">Profit & Loss</span></div>';
    h += renderPLTable(results);
    h += '</div>';

    // ── Revenue Stream Breakdown ──
    if (years.length > 0) {
      h += '<div class="sim-section">';
      h += '<div class="sim-section-header"><span class="sim-sec-num">04</span><span class="sim-sec-title">Revenue Streams</span></div>';
      h += renderStreamBreakdown(results);
      h += '</div>';
    }

    // ── Edit Panel (assumptions) ──
    if (editMode) {
      h += '<div class="sim-section sim-edit-panel">';
      h += '<div class="sim-section-header"><span class="sim-sec-num">05</span><span class="sim-sec-title">Assumptions</span></div>';
      h += renderEditPanel(activeConfig, labels);
      h += '</div>';
    }

    container.innerHTML = h;
    bindEvents(container);
  }

  // ── KPI Card helper ──
  function kpiCard(label, value, color) {
    return '<div class="sim-kpi"><div class="sim-kpi-label">' + label + '</div><div class="sim-kpi-value ' + (color || '') + '">' + value + '</div></div>';
  }

  // ── Cash Flow SVG Chart ──
  function renderCashChart(allScenarios, numMonths) {
    var W = 900, H = 200, pad = 60, cW = W - pad * 2, cH = H - 40;

    // Find global min/max across all scenarios
    var allMin = 0, allMax = 0;
    ['pessimistic', 'base', 'optimistic'].forEach(function(sc) {
      var ms = allScenarios[sc].months;
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].cashBalance < allMin) allMin = ms[i].cashBalance;
        if (ms[i].cashBalance > allMax) allMax = ms[i].cashBalance;
      }
    });
    var range = allMax - allMin || 1;

    function yPos(val) { return 18 + cH - ((val - allMin) / range * cH); }
    function xPos(idx) { return pad + (idx / (numMonths - 1)) * cW; }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sim-svg" preserveAspectRatio="xMidYMid meet">';

    // Grid lines
    for (var i = 0; i <= 4; i++) {
      var gVal = allMin + range * (i / 4);
      var gy = yPos(gVal);
      s += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (W - pad) + '" y2="' + gy + '" stroke="var(--border)" stroke-width=".5"/>';
      s += '<text x="' + (pad - 4) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="inherit">' + SimEngine.currency(Math.round(gVal)) + '</text>';
    }

    // Zero line
    if (allMin < 0 && allMax > 0) {
      var zy = yPos(0);
      s += '<line x1="' + pad + '" y1="' + zy + '" x2="' + (W - pad) + '" y2="' + zy + '" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="4,3"/>';
    }

    // Draw scenario lines
    var colors = { pessimistic: 'var(--sim-red)', base: 'var(--sim-blue)', optimistic: 'var(--sim-green)' };
    var opacities = { pessimistic: '.3', base: '1', optimistic: '.3' };
    var widths = { pessimistic: '1', base: '2', optimistic: '1' };

    ['pessimistic', 'optimistic', 'base'].forEach(function(sc) {
      var ms = allScenarios[sc].months;
      var pts = [];
      for (var i = 0; i < ms.length; i++) {
        pts.push(xPos(i) + ',' + yPos(ms[i].cashBalance));
      }
      s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colors[sc] + '" stroke-width="' + widths[sc] + '" opacity="' + opacities[sc] + '"/>';
    });

    // Endpoint dots for base case
    var baseMs = allScenarios.base.months;
    var last = baseMs[baseMs.length - 1];
    s += '<circle cx="' + xPos(baseMs.length - 1) + '" cy="' + yPos(last.cashBalance) + '" r="4" fill="' + (last.cashBalance >= 0 ? 'var(--sim-green)' : 'var(--sim-red)') + '" stroke="white" stroke-width="2"/>';

    // Month labels (every 6 months)
    for (var i = 0; i < numMonths; i += 6) {
      s += '<text x="' + xPos(i) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="8" fill="var(--text-muted)" font-family="inherit">M' + (i + 1) + '</text>';
    }

    // Legend
    s += '<text x="' + (W - pad) + '" y="14" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="inherit">';
    s += '<tspan fill="var(--sim-red)">Pessimistic</tspan>  ';
    s += '<tspan fill="var(--sim-blue)">Base</tspan>  ';
    s += '<tspan fill="var(--sim-green)">Optimistic</tspan>';
    s += '</text>';

    s += '</svg>';
    return s;
  }

  // ── Revenue vs Costs Bar Chart ──
  function renderRevenueChart(months) {
    // Show monthly for first 12, then quarterly/annual
    var displayMonths = [];
    for (var i = 0; i < months.length; i++) {
      if (i < 12 || i % 3 === 0) displayMonths.push(months[i]);
    }
    if (displayMonths.length > 24) {
      displayMonths = [];
      for (var i = 0; i < months.length; i++) {
        if (i < 12 || i % 6 === 0) displayMonths.push(months[i]);
      }
    }

    var maxV = 0;
    for (var i = 0; i < displayMonths.length; i++) {
      var m = displayMonths[i];
      var total = m.cogs + m.staffCost + m.opex + m.capex;
      if (m.revenue > maxV) maxV = m.revenue;
      if (total > maxV) maxV = total;
    }
    maxV = maxV || 1;

    var W = 900, H = 180, pad = 60, cW = W - pad * 2, cH = H - 35;
    var gap = cW / displayMonths.length, bw = Math.max(4, gap * 0.35);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sim-svg" preserveAspectRatio="xMidYMid meet">';

    // Grid
    for (var i = 0; i <= 4; i++) {
      var gy = 15 + cH * (1 - i / 4);
      s += '<line x1="' + pad + '" y1="' + gy + '" x2="' + (W - pad) + '" y2="' + gy + '" stroke="var(--border)" stroke-width=".5"/>';
      s += '<text x="' + (pad - 4) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="inherit">' + SimEngine.currency(maxV * i / 4) + '</text>';
    }

    displayMonths.forEach(function(m, i) {
      var cx = pad + gap * i + gap / 2;
      var rh = m.revenue / maxV * cH;
      var ch = (m.cogs + m.staffCost + m.opex) / maxV * cH;

      // Revenue bar
      s += '<rect x="' + (cx - bw) + '" y="' + (15 + cH - rh) + '" width="' + bw + '" height="' + rh + '" fill="var(--sim-blue)" rx="2" opacity=".7"/>';
      // Cost bar
      s += '<rect x="' + (cx + 2) + '" y="' + (15 + cH - ch) + '" width="' + (bw * 0.6) + '" height="' + ch + '" fill="var(--sim-red)" rx="2" opacity=".3"/>';

      // Labels every few bars
      if (displayMonths.length <= 18 || i % 2 === 0) {
        s += '<text x="' + cx + '" y="' + (H - 3) + '" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-family="inherit">M' + m.month + '</text>';
      }
    });

    // Legend
    s += '<text x="' + (W - pad) + '" y="10" text-anchor="end" font-size="8" fill="var(--text-muted)" font-family="inherit">';
    s += '<tspan fill="var(--sim-blue)">Revenue</tspan>  ';
    s += '<tspan fill="var(--sim-red)">Costs</tspan>';
    s += '</text>';

    s += '</svg>';
    return s;
  }

  // ── P&L Table ──
  function renderPLTable(results) {
    var years = results.years;
    var months = results.months;
    var cur = SimEngine.currency;

    // Show monthly for year 1 (quarters), then annual
    var cols = [];

    // Year 1 quarters
    if (months.length >= 3) {
      for (var q = 0; q < 4 && q * 3 < months.length; q++) {
        var qStart = q * 3;
        var qEnd = Math.min(qStart + 3, months.length, 12);
        var qMonths = months.slice(qStart, qEnd);
        var rev = 0, cogs = 0, staff = 0, opex = 0, capex = 0;
        for (var j = 0; j < qMonths.length; j++) {
          rev += qMonths[j].revenue; cogs += qMonths[j].cogs;
          staff += qMonths[j].staffCost; opex += qMonths[j].opex;
          capex += qMonths[j].capex;
        }
        cols.push({
          label: 'Q' + (q + 1) + ' Y1',
          revenue: rev, cogs: cogs, grossProfit: rev - cogs,
          staffCost: staff, opex: opex, capex: capex,
          netIncome: rev - cogs - staff - opex - capex,
          cashBalance: qMonths[qMonths.length - 1].cashBalance,
          headcount: qMonths[qMonths.length - 1].headcount
        });
      }
    }

    // Years 2+
    for (var i = 1; i < years.length; i++) {
      var y = years[i];
      cols.push({
        label: 'Year ' + y.year,
        revenue: y.revenue, cogs: y.cogs, grossProfit: y.grossProfit,
        staffCost: y.staffCost, opex: y.opex, capex: y.capex,
        netIncome: y.netIncome,
        cashBalance: y.cashBalance,
        headcount: y.headcount
      });
    }

    if (cols.length === 0) return '<p class="sim-empty">Not enough data for P&L table.</p>';

    var h = '<div class="sim-pl-wrap"><table class="sim-pl-table"><thead><tr><th></th>';
    for (var i = 0; i < cols.length; i++) {
      h += '<th class="sim-pl-yr">' + cols[i].label + '</th>';
    }
    h += '</tr></thead><tbody>';

    function row(label, fn, cls) {
      h += '<tr class="' + (cls || '') + '"><td>' + label + '</td>';
      for (var i = 0; i < cols.length; i++) {
        var val = fn(cols[i]);
        var color = '';
        if (typeof val === 'number') {
          color = val >= 0 ? 'sim-positive' : 'sim-negative';
          val = cur(val);
        }
        h += '<td class="sim-pl-num ' + color + '">' + val + '</td>';
      }
      h += '</tr>';
    }

    row('Revenue', function(c) { return c.revenue; });
    row('COGS', function(c) { return -c.cogs; });
    h += '<tr class="sim-pl-sep"><td colspan="' + (cols.length + 1) + '"></td></tr>';
    row('Gross Profit', function(c) { return c.grossProfit; }, 'sim-pl-subtotal');
    row('Staff', function(c) { return -c.staffCost; });
    row('Operating Expenses', function(c) { return -c.opex; });
    row('Capital Expenses', function(c) { return c.capex > 0 ? -c.capex : 0; });
    h += '<tr class="sim-pl-sep"><td colspan="' + (cols.length + 1) + '"></td></tr>';
    row('Net Income', function(c) { return c.netIncome; }, 'sim-pl-total');

    h += '<tr class="sim-pl-sep"><td colspan="' + (cols.length + 1) + '"></td></tr>';
    row('Cash Balance', function(c) { return c.cashBalance; });
    row('Headcount', function(c) { return String(c.headcount); });
    row('Gross Margin', function(c) { return c.revenue > 0 ? SimEngine.pct(c.grossProfit / c.revenue * 100) : '-'; });
    row('Net Margin', function(c) { return c.revenue > 0 ? SimEngine.pct(c.netIncome / c.revenue * 100) : '-'; });

    h += '</tbody></table></div>';
    return h;
  }

  // ── Revenue Stream Breakdown ──
  function renderStreamBreakdown(results) {
    // Aggregate by stream across all months
    var streamMap = {};
    var months = results.months;
    for (var i = 0; i < months.length; i++) {
      var streams = months[i].revenueByStream;
      for (var j = 0; j < streams.length; j++) {
        var sr = streams[j];
        if (!streamMap[sr.id]) {
          streamMap[sr.id] = { name: sr.name, type: sr.type, revenue: 0, cogs: 0, units: 0 };
        }
        streamMap[sr.id].revenue += sr.revenue;
        streamMap[sr.id].cogs += sr.cogs;
        streamMap[sr.id].units += sr.units;
      }
    }

    var streamList = [];
    for (var id in streamMap) streamList.push(streamMap[id]);
    streamList.sort(function(a, b) { return b.revenue - a.revenue; });

    if (streamList.length === 0) return '';

    var totalRev = 0;
    for (var i = 0; i < streamList.length; i++) totalRev += streamList[i].revenue;

    var cur = SimEngine.currency;
    var h = '<table class="sim-pl-table"><thead><tr>';
    h += '<th>Stream</th><th>Type</th><th class="sim-pl-num">Revenue</th><th class="sim-pl-num">COGS</th><th class="sim-pl-num">Gross Profit</th><th class="sim-pl-num">Margin</th><th class="sim-pl-num">% of Total</th>';
    h += '</tr></thead><tbody>';

    for (var i = 0; i < streamList.length; i++) {
      var s = streamList[i];
      var gp = s.revenue - s.cogs;
      var margin = s.revenue > 0 ? gp / s.revenue * 100 : 0;
      var share = totalRev > 0 ? s.revenue / totalRev * 100 : 0;
      h += '<tr>';
      h += '<td>' + esc(s.name) + '</td>';
      h += '<td><span class="sim-type-badge">' + s.type + '</span></td>';
      h += '<td class="sim-pl-num sim-positive">' + cur(s.revenue) + '</td>';
      h += '<td class="sim-pl-num">' + cur(s.cogs) + '</td>';
      h += '<td class="sim-pl-num ' + (gp >= 0 ? 'sim-positive' : 'sim-negative') + '">' + cur(gp) + '</td>';
      h += '<td class="sim-pl-num">' + SimEngine.pct(margin) + '</td>';
      h += '<td class="sim-pl-num">' + SimEngine.pct(share) + '</td>';
      h += '</tr>';
    }

    h += '</tbody></table>';
    return h;
  }

  // ── Edit Panel ──
  function renderEditPanel(config, labels) {
    var h = '<div class="sim-edit-grid">';

    // Starting cash
    h += '<div class="sim-edit-group">';
    h += '<h4>General</h4>';
    h += sliderField('startingCash', 'Starting Cash', config.startingCash || 0, 0, 500000, 1000, '$');
    h += sliderField('projectionMonths', 'Projection Months', config.projectionMonths || 36, 12, 60, 6, ' mo');
    h += '</div>';

    // Revenue streams
    h += '<div class="sim-edit-group">';
    h += '<h4>Revenue Streams</h4>';
    var streams = config.revenueStreams || [];
    for (var i = 0; i < streams.length; i++) {
      var rs = streams[i];
      h += '<div class="sim-stream-edit">';
      h += '<div class="sim-stream-name">' + esc(rs.name) + ' <span class="sim-type-badge">' + rs.type + '</span></div>';
      h += sliderField('rs_price_' + i, 'Price per ' + (rs.type === 'recurring' ? 'month' : 'unit'), rs.unitPrice || 0, 1, Math.max(500, rs.unitPrice * 3), 1, '$');
      h += sliderField('rs_volume_' + i, (labels && labels.units ? labels.units : 'Units') + '/month', rs.unitsPerMonth || 0, 1, Math.max(1000, rs.unitsPerMonth * 3), 1, '');
      h += sliderField('rs_growth_' + i, 'Monthly growth', rs.growthRate || 0, 0, 20, 0.5, '%');
      if (rs.type === 'recurring') {
        h += sliderField('rs_churn_' + i, 'Monthly churn', rs.churnRate || 0, 0, 20, 0.5, '%');
      }
      if (rs.cogsPct > 0) {
        h += sliderField('rs_cogspct_' + i, 'COGS %', rs.cogsPct || 0, 0, 80, 1, '%');
      }
      if (rs.cogsPerUnit > 0) {
        h += sliderField('rs_cogsunit_' + i, 'COGS per unit', rs.cogsPerUnit || 0, 0, Math.max(50, rs.cogsPerUnit * 3), 0.5, '$');
      }
      h += '</div>';
    }
    h += '</div>';

    // Staff
    h += '<div class="sim-edit-group">';
    h += '<h4>Staff</h4>';
    var staff = config.staff || [];
    for (var i = 0; i < staff.length; i++) {
      h += '<div class="sim-stream-edit">';
      h += '<div class="sim-stream-name">' + esc(staff[i].role) + '</div>';
      h += sliderField('staff_count_' + i, 'Headcount', staff[i].count || 0, 0, 20, 1, '');
      h += sliderField('staff_cost_' + i, 'Monthly cost', staff[i].monthlyCost || 0, 0, 15000, 100, '$');
      h += '</div>';
    }
    h += '</div>';

    // Opex
    h += '<div class="sim-edit-group">';
    h += '<h4>Operating Expenses</h4>';
    var opex = config.opex || [];
    for (var i = 0; i < opex.length; i++) {
      h += sliderField('opex_' + i, opex[i].name, opex[i].monthly || 0, 0, Math.max(10000, opex[i].monthly * 3), 50, '$/mo');
    }
    h += '</div>';

    h += '</div>'; // end grid
    return h;
  }

  function sliderField(key, label, value, min, max, step, unit) {
    var display;
    if (unit === '$' || unit === '$/mo') display = '$' + (value || 0).toLocaleString();
    else if (unit === '%') display = (value || 0) + '%';
    else display = (value || 0) + (unit || '');

    return '<div class="sim-slider"><div class="sim-slider-head"><span class="sim-slider-label">' + label + '</span><span class="sim-slider-val">' + display + '</span></div>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + (value || min) + '" data-key="' + key + '"></div>';
  }

  // ── Event binding ──
  function bindEvents(container) {
    // Scenario toggle
    container.querySelectorAll('.sim-sc').forEach(function(el) {
      el.addEventListener('click', function() {
        currentScenario = this.dataset.scenario;
        render(container);
      });
    });

    // Edit mode toggle
    var editBtn = document.getElementById('sim-toggle-edit');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        editMode = !editMode;
        render(container);
      });
    }

    // Slider changes
    container.querySelectorAll('.sim-edit-panel input[type=range]').forEach(function(el) {
      el.addEventListener('input', function() {
        var key = this.dataset.key;
        var val = parseFloat(this.value);
        applySliderChange(key, val);

        // Update display value
        var valSpan = this.parentElement.querySelector('.sim-slider-val');
        if (valSpan) {
          var unit = '';
          if (key.indexOf('price') >= 0 || key.indexOf('cost') >= 0 || key === 'startingCash' || key.indexOf('opex') >= 0) unit = '$';
          else if (key.indexOf('growth') >= 0 || key.indexOf('churn') >= 0 || key.indexOf('cogspct') >= 0) unit = '%';
          else if (key === 'projectionMonths') unit = ' mo';

          if (unit === '$') valSpan.textContent = '$' + val.toLocaleString();
          else if (unit === '%') valSpan.textContent = val + '%';
          else valSpan.textContent = val + unit;
        }
      });

      // Re-render on mouse up (debounced)
      el.addEventListener('change', function() {
        Store.saveSimConfig(activeConfig);
        render(container);
      });
    });
  }

  function applySliderChange(key, val) {
    if (!activeConfig) return;

    if (key === 'startingCash') { activeConfig.startingCash = val; return; }
    if (key === 'projectionMonths') { activeConfig.projectionMonths = val; return; }

    // Revenue stream fields: rs_price_0, rs_volume_1, etc.
    var rsMatch = key.match(/^rs_(\w+)_(\d+)$/);
    if (rsMatch && activeConfig.revenueStreams) {
      var idx = parseInt(rsMatch[2]);
      var field = rsMatch[1];
      var stream = activeConfig.revenueStreams[idx];
      if (stream) {
        if (field === 'price') stream.unitPrice = val;
        else if (field === 'volume') stream.unitsPerMonth = val;
        else if (field === 'growth') stream.growthRate = val;
        else if (field === 'churn') stream.churnRate = val;
        else if (field === 'cogspct') stream.cogsPct = val;
        else if (field === 'cogsunit') stream.cogsPerUnit = val;
      }
      return;
    }

    // Staff fields: staff_count_0, staff_cost_1
    var staffMatch = key.match(/^staff_(\w+)_(\d+)$/);
    if (staffMatch && activeConfig.staff) {
      var idx = parseInt(staffMatch[2]);
      var field = staffMatch[1];
      var s = activeConfig.staff[idx];
      if (s) {
        if (field === 'count') s.count = val;
        else if (field === 'cost') s.monthlyCost = val;
      }
      return;
    }

    // Opex fields: opex_0, opex_1
    var opexMatch = key.match(/^opex_(\d+)$/);
    if (opexMatch && activeConfig.opex) {
      var idx = parseInt(opexMatch[1]);
      if (activeConfig.opex[idx]) activeConfig.opex[idx].monthly = val;
      return;
    }
  }

  return {
    render: render
  };
})();
