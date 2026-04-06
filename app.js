// app.js — Router, navigation, settings, shared utilities
'use strict';

var App = (function() {

  function getRoute() {
    var hash = window.location.hash.replace('#', '') || '';
    if (!Store.isWizardComplete() && hash !== 'settings') return 'wizard';
    return hash || 'tracker';
  }

  function render() {
    var container = document.getElementById('app');
    var route = getRoute();

    // Update nav
    updateNav(route);

    // Clear and render
    var content = document.createElement('div');
    content.className = 'content';

    switch(route) {
      case 'wizard':
        container.innerHTML = '';
        container.appendChild(buildNav(route));
        var wizWrap = document.createElement('div');
        wizWrap.className = 'onboarding-shell';
        container.appendChild(wizWrap);
        Wizard.render(wizWrap);
        return;

      case 'canvas':
        container.innerHTML = '';
        container.appendChild(buildNav(route));
        var canvasWrap = document.createElement('div');
        canvasWrap.className = 'content';
        container.appendChild(canvasWrap);
        Canvas.render(canvasWrap);
        return;

      case 'tracker':
        container.innerHTML = '';
        container.appendChild(buildNav(route));
        var trackerWrap = document.createElement('div');
        trackerWrap.className = 'content';
        container.appendChild(trackerWrap);
        Tracker.render(trackerWrap);
        return;

      case 'settings':
        container.innerHTML = '';
        container.appendChild(buildNav(route));
        var settingsWrap = document.createElement('div');
        settingsWrap.className = 'content';
        container.appendChild(settingsWrap);
        renderSettings(settingsWrap);
        return;
    }
  }

  function buildNav(route) {
    var nav = document.createElement('nav');
    nav.className = 'main-nav';
    var biz = Store.getBusiness();
    var brandName = biz && biz.name ? biz.name : 'BMT';

    var h = '<div class="nav-brand" onclick="window.location.hash=\'#tracker\'">' + esc(brandName) + '</div>';
    h += '<div class="nav-links">';

    if (Store.isWizardComplete()) {
      h += '<a href="#tracker" class="nav-link' + (route === 'tracker' ? ' active' : '') + '">Tracker</a>';
      h += '<a href="#canvas" class="nav-link' + (route === 'canvas' ? ' active' : '') + '">Canvas</a>';
    }
    h += '<a href="#settings" class="nav-link' + (route === 'settings' ? ' active' : '') + '">Settings</a>';
    h += '</div>';

    nav.innerHTML = h;
    return nav;
  }

  function updateNav(route) {
    // Just for hash tracking
  }

  function renderSettings(container) {
    var biz = Store.getBusiness();
    var h = '<h2 class="page-title">Settings</h2>';

    if (biz) {
      h += '<div class="settings-section">';
      h += '<h3>Your Business</h3>';
      h += '<div class="settings-info">';
      h += '<p><strong>' + esc(biz.name) + '</strong> &mdash; ' + esc(biz.type) + '</p>';
      h += '<p>' + esc(biz.description) + '</p>';
      h += '<p>Created: ' + esc(biz.createdAt) + '</p>';
      h += '</div>';
      h += '</div>';

      // Stage selector
      h += '<div class="settings-section">';
      h += '<h3>Business Stage</h3>';
      h += '<p class="page-subtitle">Where are you in the Lean Startup journey?</p>';
      h += '<div class="stage-selector">';
      ['idea', 'validation', 'growth'].forEach(function(stage) {
        var labels = { idea: 'Idea Stage', validation: 'Validation', growth: 'Growth' };
        var descs = {
          idea: 'Still forming your hypothesis. Testing if there\'s a real problem to solve.',
          validation: 'You have early customers. Testing if your solution works and people will pay.',
          growth: 'Product-market fit found. Scaling what works.'
        };
        h += '<div class="stage-card' + (biz.stage === stage ? ' active' : '') + '" data-stage="' + stage + '">';
        h += '<div class="stage-label">' + labels[stage] + '</div>';
        h += '<div class="stage-desc">' + descs[stage] + '</div>';
        h += '</div>';
      });
      h += '</div>';
      h += '</div>';
    }

    // Export/Import
    h += '<div class="settings-section">';
    h += '<h3>Data</h3>';
    h += '<div class="settings-btns">';
    h += '<button class="btn-warm" id="btn-export">Export Data (JSON)</button>';
    h += '<button class="btn-warm" id="btn-import">Import Data</button>';
    h += '<input type="file" id="import-file" accept=".json" style="display:none">';
    h += '</div>';
    h += '</div>';

    // Reset
    h += '<div class="settings-section settings-danger">';
    h += '<h3>Danger Zone</h3>';
    h += '<button class="btn-warm btn-danger" id="btn-reset">Reset Everything</button>';
    h += '<p class="page-subtitle">This will delete all your data. Export first if you want to keep it.</p>';
    h += '</div>';

    container.innerHTML = h;

    // Bind events
    container.querySelectorAll('.stage-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var biz = Store.getBusiness();
        if (biz) {
          biz.stage = this.dataset.stage;
          Store.saveBusiness(biz);
          renderSettings(container);
        }
      });
    });

    var exportBtn = document.getElementById('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', function() {
      var json = Store.exportAll();
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'bmt-export-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    var importBtn = document.getElementById('btn-import');
    var importFile = document.getElementById('import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function() { importFile.click(); });
      importFile.addEventListener('change', function() {
        if (this.files.length > 0) {
          var reader = new FileReader();
          reader.onload = function(e) {
            if (Store.importAll(e.target.result)) {
              alert('Data imported successfully!');
              App.render();
            } else {
              alert('Failed to import. Check the file format.');
            }
          };
          reader.readAsText(this.files[0]);
        }
      });
    }

    var resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', function() {
      if (confirm('Are you sure? This will delete ALL your data.')) {
        Store.resetAll();
        Wizard.reset();
        window.location.hash = '#wizard';
        App.render();
      }
    });
  }

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // Listen for hash changes
  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', function() {
    // Restore saved brand theme before first render
    AI.restoreTheme();
    render();
  });

  return {
    render: render
  };
})();
