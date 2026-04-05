// tracker.js — Hypothesis tracking dashboard
'use strict';

var Tracker = (function() {

  var filter = 'all'; // all | critical | customer | value | revenue | growth | cost
  var loggingId = null; // hypothesis being logged
  var showAllPrompts = false;
  var activePrompts = []; // current action prompts
  var connectorModal = null; // { prompt, phase: 'loading'|'ready' }

  var CAT_COLORS = {
    customer: { bg: '#fef3e2', fg: '#e67e22', label: 'Customer' },
    value:    { bg: '#e8f8e8', fg: '#27ae60', label: 'Value' },
    revenue:  { bg: '#e3f2fd', fg: '#2980b9', label: 'Revenue' },
    growth:   { bg: '#f3e5f5', fg: '#8e44ad', label: 'Growth' },
    cost:     { bg: '#fce4ec', fg: '#c0392b', label: 'Cost' }
  };

  var STATUS_INFO = {
    testing:     { label: 'Testing', color: '#3498db', bg: '#e3f2fd' },
    validated:   { label: 'Validated', color: '#27ae60', bg: '#e8f8e8' },
    invalidated: { label: 'Invalidated', color: '#e74c3c', bg: '#fce4ec' },
    pivoted:     { label: 'Pivoted', color: '#f39c12', bg: '#fef3e2' }
  };

  function render(container) {
    var hyps = Store.getHypotheses();
    var biz = Store.getBusiness();

    var h = '';
    h += '<div class="tracker-header">';
    h += '<h2 class="page-title">Hypothesis Tracker</h2>';
    h += '<p class="page-subtitle">Track your assumptions. Log real data. Learn what works.</p>';
    h += '</div>';

    // Summary strip
    var counts = { total: hyps.length, testing: 0, validated: 0, invalidated: 0, pivoted: 0 };
    hyps.forEach(function(hyp) { if (counts[hyp.status] !== undefined) counts[hyp.status]++; });

    h += '<div class="tracker-summary">';
    h += summaryCard('Total', counts.total, '#6c757d');
    h += summaryCard('Testing', counts.testing, '#3498db');
    h += summaryCard('Validated', counts.validated, '#27ae60');
    h += summaryCard('Invalidated', counts.invalidated, '#e74c3c');
    h += '</div>';

    // Lean Startup tip
    h += '<div class="lean-tip">';
    h += '<strong>Lean Startup tip:</strong> ';
    if (counts.total === 0) {
      h += 'Go to your <a href="#canvas">Canvas</a> or re-run the wizard to generate hypotheses.';
    } else if (counts.testing > 0 && counts.validated === 0) {
      h += 'Start by testing your most critical assumptions first. Log real data as you get it!';
    } else if (counts.validated > counts.invalidated) {
      h += 'Good progress! Your business model is gaining validation. Keep measuring.';
    } else if (counts.invalidated > 0) {
      h += 'Some assumptions were wrong — that\'s great learning! Consider pivoting those areas.';
    } else {
      h += 'Keep tracking your metrics. Real data beats opinions every time.';
    }
    h += '</div>';

    // Action prompts section
    h += renderActionPrompts(hyps, biz);

    // Connector modal
    if (connectorModal) {
      h += renderConnectorModal();
    }

    // Filters
    h += '<div class="tracker-filters">';
    h += filterBtn('all', 'All');
    h += filterBtn('critical', 'Critical');
    h += filterBtn('customer', 'Customer');
    h += filterBtn('value', 'Value');
    h += filterBtn('revenue', 'Revenue');
    h += filterBtn('growth', 'Growth');
    h += filterBtn('cost', 'Cost');
    h += '</div>';

    // Add hypothesis button
    h += '<div class="tracker-actions">';
    h += '<button class="btn-warm btn-add-hyp" onclick="Tracker.addNew()">+ Add Hypothesis</button>';
    h += '</div>';

    // Hypothesis cards
    var filtered = hyps.filter(function(hyp) {
      if (filter === 'all') return true;
      if (filter === 'critical') return hyp.priority === 'critical';
      return hyp.category === filter;
    });

    if (filtered.length === 0) {
      h += '<div class="tracker-empty">';
      h += '<p>No hypotheses ' + (filter !== 'all' ? 'in this category' : 'yet') + '.</p>';
      h += '<p>Add some from the <a href="#canvas">Canvas</a> or click "+ Add Hypothesis" above.</p>';
      h += '</div>';
    }

    h += '<div class="tracker-cards">';
    filtered.forEach(function(hyp) { h += renderCard(hyp); });
    h += '</div>';

    container.innerHTML = h;
    bindTrackerEvents(container);
    bindPromptEvents(container);
  }

  function summaryCard(label, count, color) {
    return '<div class="summary-card"><div class="summary-count" style="color:' + color + '">' + count + '</div><div class="summary-label">' + label + '</div></div>';
  }

  function filterBtn(key, label) {
    return '<button class="filter-btn' + (filter === key ? ' active' : '') + '" data-filter="' + key + '">' + label + '</button>';
  }

  function renderCard(hyp) {
    var cat = CAT_COLORS[hyp.category] || CAT_COLORS.value;
    var status = STATUS_INFO[hyp.status] || STATUS_INFO.testing;
    var latest = hyp.actuals && hyp.actuals.length > 0 ? hyp.actuals[hyp.actuals.length - 1] : null;
    var progress = latest && hyp.target ? Math.min(100, Math.round((latest.value / hyp.target) * 100)) : 0;

    var h = '<div class="hyp-card">';

    // Header row
    h += '<div class="hyp-header">';
    h += '<span class="hyp-cat" style="background:' + cat.bg + ';color:' + cat.fg + '">' + cat.label + '</span>';
    if (hyp.priority === 'critical') h += '<span class="hyp-priority">Critical</span>';
    h += '<span class="hyp-status" style="background:' + status.bg + ';color:' + status.color + '">' + status.label + '</span>';
    h += '</div>';

    // Statement
    h += '<div class="hyp-statement">' + esc(hyp.statement) + '</div>';

    // Metric and progress
    if (hyp.target) {
      h += '<div class="hyp-metric">';
      h += '<span class="hyp-metric-label">' + esc(hyp.metric || 'Target') + '</span>';
      h += '<span class="hyp-metric-val">';
      if (latest) {
        h += '<strong>' + latest.value + '</strong> / ' + hyp.target + ' ' + esc(hyp.unit || '');
      } else {
        h += 'Target: ' + hyp.target + ' ' + esc(hyp.unit || '');
      }
      h += '</span>';
      h += '</div>';

      // Progress bar
      var barColor = progress >= 100 ? '#27ae60' : progress >= 60 ? '#f39c12' : '#e74c3c';
      h += '<div class="hyp-progress-wrap">';
      h += '<div class="hyp-progress-bar"><div class="hyp-progress-fill" style="width:' + progress + '%;background:' + barColor + '"></div></div>';
      h += '<span class="hyp-progress-pct">' + progress + '%</span>';
      h += '</div>';
    }

    // Sparkline
    if (hyp.actuals && hyp.actuals.length >= 2) {
      h += renderSparkline(hyp.actuals, hyp.target);
    }

    // Timeframe
    if (hyp.timeframe) {
      h += '<div class="hyp-timeframe">' + esc(hyp.timeframe) + '</div>';
    }

    // Logging form
    if (loggingId === hyp.id) {
      h += '<div class="hyp-log-form">';
      h += '<input type="date" class="log-date" id="log-date-' + hyp.id + '" value="' + new Date().toISOString().slice(0, 10) + '">';
      h += '<input type="number" class="log-value" id="log-value-' + hyp.id + '" placeholder="Value" step="any">';
      h += '<input type="text" class="log-note" id="log-note-' + hyp.id + '" placeholder="Note (optional)">';
      h += '<div class="log-btns">';
      h += '<button class="btn-warm btn-log-save" data-id="' + hyp.id + '">Save</button>';
      h += '<button class="btn-warm btn-log-cancel" data-id="' + hyp.id + '">Cancel</button>';
      h += '</div>';
      h += '</div>';
    }

    // Data history (collapsible)
    if (hyp.actuals && hyp.actuals.length > 0) {
      h += '<details class="hyp-history"><summary>' + hyp.actuals.length + ' data point' + (hyp.actuals.length !== 1 ? 's' : '') + '</summary>';
      h += '<table class="hyp-data-table"><tr><th>Date</th><th>Value</th><th>Note</th></tr>';
      hyp.actuals.slice().reverse().forEach(function(a) {
        h += '<tr><td>' + esc(a.date) + '</td><td>' + a.value + '</td><td>' + esc(a.note || '') + '</td></tr>';
      });
      h += '</table></details>';
    }

    // Actions
    h += '<div class="hyp-actions">';
    h += '<button class="btn-warm btn-log" data-id="' + hyp.id + '">Log Data</button>';
    h += '<select class="hyp-status-select" data-id="' + hyp.id + '">';
    ['testing', 'validated', 'invalidated', 'pivoted'].forEach(function(s) {
      h += '<option value="' + s + '"' + (hyp.status === s ? ' selected' : '') + '>' + STATUS_INFO[s].label + '</option>';
    });
    h += '</select>';
    h += '<button class="btn-warm btn-delete-hyp" data-id="' + hyp.id + '" title="Delete">&#128465;</button>';
    h += '</div>';

    h += '</div>';
    return h;
  }

  function renderSparkline(actuals, target) {
    var w = 200, h = 40, pad = 4;
    var vals = actuals.map(function(a) { return a.value; });
    var allVals = target ? vals.concat([target]) : vals;
    var min = Math.min.apply(null, allVals);
    var max = Math.max.apply(null, allVals);
    var range = max - min || 1;

    var points = vals.map(function(v, i) {
      var x = pad + (i / Math.max(1, vals.length - 1)) * (w - 2 * pad);
      var y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return x + ',' + y;
    });

    var svg = '<svg class="sparkline" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';

    // Target line
    if (target) {
      var ty = pad + (1 - (target - min) / range) * (h - 2 * pad);
      svg += '<line x1="' + pad + '" y1="' + ty + '" x2="' + (w - pad) + '" y2="' + ty + '" stroke="#27ae60" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>';
    }

    // Line
    svg += '<polyline points="' + points.join(' ') + '" fill="none" stroke="#3498db" stroke-width="1.5"/>';

    // Dots
    vals.forEach(function(v, i) {
      var x = pad + (i / Math.max(1, vals.length - 1)) * (w - 2 * pad);
      var y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      var color = target && v >= target ? '#27ae60' : '#3498db';
      svg += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + color + '"/>';
    });

    svg += '</svg>';
    return '<div class="hyp-sparkline">' + svg + '</div>';
  }

  function renderActionPrompts(hyps, biz) {
    var toolPrefs = Store.getToolPrefs();
    var promptState = Store.getPromptState();

    // Generate synchronously for immediate render
    activePrompts = Prompts.generateSync(hyps, biz, toolPrefs, promptState);

    // Fire async AI generation to upgrade prompts
    Prompts.generate(hyps, biz, toolPrefs, promptState).then(function(aiPrompts) {
      if (aiPrompts && aiPrompts.length > 0) {
        // Only re-render if AI gave us different prompts
        var oldKeys = activePrompts.map(function(p) { return p.key; }).join(',');
        var newKeys = aiPrompts.map(function(p) { return p.key; }).join(',');
        if (oldKeys !== newKeys) {
          activePrompts = aiPrompts;
          var section = document.getElementById('action-prompts-section');
          if (section) {
            section.innerHTML = renderActionPromptsInner();
            bindPromptEvents(document.getElementById('app'));
          }
        }
      }
    }).catch(function() {});

    if (activePrompts.length === 0) return '';

    var h = '<div class="action-prompts" id="action-prompts-section">';
    h += renderActionPromptsInner();
    h += '</div>';
    return h;
  }

  function renderActionPromptsInner() {
    var visible = showAllPrompts ? activePrompts : activePrompts.slice(0, 3);
    var urgColors = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--blue)' };
    var urgLabels = { high: 'High', medium: 'Med', low: 'Low' };

    var h = '<div class="action-prompts-header">';
    h += '<div class="action-prompts-title">Actions for You</div>';
    if (activePrompts.length > 3) {
      h += '<button class="action-prompts-toggle" data-action="toggle-prompts">' + (showAllPrompts ? 'Show Less' : 'View All (' + activePrompts.length + ')') + '</button>';
    }
    h += '</div>';

    h += '<div class="action-prompt-cards">';
    visible.forEach(function(p) {
      var color = urgColors[p.urgency] || urgColors.medium;
      h += '<div class="action-prompt-card" style="border-left-color:' + color + '">';
      h += '<div class="action-prompt-top">';
      h += '<span class="action-prompt-badge" style="background:' + color + '">' + (urgLabels[p.urgency] || 'Med') + '</span>';
      h += '<span class="action-prompt-effort">' + esc(p.effort) + '</span>';
      h += '<button class="action-prompt-dismiss" data-key="' + esc(p.key) + '" title="Dismiss">&times;</button>';
      h += '</div>';
      h += '<div class="action-prompt-title">' + esc(p.title) + '</div>';
      h += '<div class="action-prompt-desc">' + esc(p.description) + '</div>';
      h += '<div class="action-prompt-actions">';
      if (p.tool) {
        h += '<button class="btn-warm action-prompt-tool-btn" data-key="' + esc(p.key) + '">' + p.tool.icon + ' Open ' + esc(p.tool.name) + '</button>';
      }
      h += '<button class="btn-warm action-prompt-done-btn" data-key="' + esc(p.key) + '" data-hyp="' + esc(p.hypId || '') + '">Done</button>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function renderConnectorModal() {
    var p = connectorModal.prompt;
    var phase = connectorModal.phase;
    var h = '<div class="connector-overlay" id="connector-overlay">';
    h += '<div class="connector-modal">';
    if (phase === 'loading') {
      h += '<div class="connector-icon">' + (p.tool ? p.tool.icon : '') + '</div>';
      h += '<div class="connector-title">Connecting to ' + esc(p.tool ? p.tool.name : '') + '...</div>';
      h += '<div class="connector-loading"><div class="connector-spinner"></div></div>';
    } else {
      h += '<div class="connector-icon">' + (p.tool ? p.tool.icon : '') + '</div>';
      h += '<div class="connector-title">Ready!</div>';
      h += '<div class="connector-action-text">Here\'s what to do:</div>';
      h += '<div class="connector-desc">' + esc(p.description) + '</div>';
      h += '<div class="connector-btns">';
      h += '<button class="btn-warm wiz-btn-primary" id="connector-done" data-key="' + esc(p.key) + '" data-hyp="' + esc(p.hypId || '') + '">Mark as Done</button>';
      h += '<button class="btn-warm" id="connector-close">Close</button>';
      h += '</div>';
    }
    h += '</div>';
    h += '</div>';
    return h;
  }

  function bindTrackerEvents(container) {
    // Filters
    container.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        filter = this.dataset.filter;
        render(container);
      });
    });

    // Log data button
    container.querySelectorAll('.btn-log').forEach(function(btn) {
      btn.addEventListener('click', function() {
        loggingId = loggingId === this.dataset.id ? null : this.dataset.id;
        render(container);
      });
    });

    // Save log
    container.querySelectorAll('.btn-log-save').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.dataset.id;
        var dateEl = document.getElementById('log-date-' + id);
        var valEl = document.getElementById('log-value-' + id);
        var noteEl = document.getElementById('log-note-' + id);
        if (valEl && valEl.value) {
          Store.addActual(id, {
            date: dateEl ? dateEl.value : new Date().toISOString().slice(0, 10),
            value: parseFloat(valEl.value),
            note: noteEl ? noteEl.value : ''
          });
          loggingId = null;
          render(container);
        }
      });
    });

    // Cancel log
    container.querySelectorAll('.btn-log-cancel').forEach(function(btn) {
      btn.addEventListener('click', function() {
        loggingId = null;
        render(container);
      });
    });

    // Status change
    container.querySelectorAll('.hyp-status-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        Store.updateHypothesis(this.dataset.id, { status: this.value });
        render(container);
      });
    });

    // Delete hypothesis
    container.querySelectorAll('.btn-delete-hyp').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (confirm('Delete this hypothesis?')) {
          Store.removeHypothesis(this.dataset.id);
          render(container);
        }
      });
    });
  }

  function bindPromptEvents(container) {
    // Toggle view all
    var toggleBtn = container.querySelector('[data-action="toggle-prompts"]');
    if (toggleBtn) toggleBtn.addEventListener('click', function() {
      showAllPrompts = !showAllPrompts;
      render(container);
    });

    // Done buttons
    container.querySelectorAll('.action-prompt-done-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        Store.completePrompt(this.dataset.key, this.dataset.hyp || null);
        render(container);
      });
    });

    // Dismiss buttons
    container.querySelectorAll('.action-prompt-dismiss').forEach(function(btn) {
      btn.addEventListener('click', function() {
        Store.dismissPrompt(this.dataset.key);
        render(container);
      });
    });

    // Tool connector buttons
    container.querySelectorAll('.action-prompt-tool-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var key = this.dataset.key;
        var prompt = null;
        for (var i = 0; i < activePrompts.length; i++) {
          if (activePrompts[i].key === key) { prompt = activePrompts[i]; break; }
        }
        if (!prompt) return;
        connectorModal = { prompt: prompt, phase: 'loading' };
        render(container);
        // Simulate connection delay
        setTimeout(function() {
          connectorModal.phase = 'ready';
          render(container);
        }, 1500);
      });
    });

    // Connector modal events
    var overlay = document.getElementById('connector-overlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) { connectorModal = null; render(container); }
      });
    }
    var closeBtn = document.getElementById('connector-close');
    if (closeBtn) closeBtn.addEventListener('click', function() {
      connectorModal = null;
      render(container);
    });
    var doneBtn = document.getElementById('connector-done');
    if (doneBtn) doneBtn.addEventListener('click', function() {
      Store.completePrompt(this.dataset.key, this.dataset.hyp || null);
      connectorModal = null;
      render(container);
    });
  }

  function addNew() {
    var statement = prompt('What assumption do you want to test?');
    if (!statement || !statement.trim()) return;

    var metric = prompt('How will you measure it? (e.g., "Daily customers", "Revenue per month")') || 'Metric';
    var target = prompt('What\'s your target number?');
    var unit = prompt('Unit (e.g., "customers/day", "$/month", "%")') || '';

    Store.addHypothesis({
      canvasElement: 'valueProp',
      category: 'value',
      statement: statement.trim(),
      metric: metric.trim(),
      target: target ? parseFloat(target) : 0,
      unit: unit.trim(),
      timeframe: 'First 3 months',
      priority: 'important'
    });

    var container = document.getElementById('app');
    render(container);
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return {
    render: render,
    addNew: addNew
  };
})();
