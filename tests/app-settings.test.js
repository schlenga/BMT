const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);

  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
});

describe('App settings page', () => {
  function goToSettings() {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Settings Test', type: 'service', description: 'A service', createdAt: '2025-01-01', stage: 'idea' });
    window.location.hash = '#settings';
    App.render();
    return document.getElementById('app');
  }

  describe('tool preference chips', () => {
    test('clicking a tool chip toggles it active', () => {
      const app = goToSettings();

      const chips = app.querySelectorAll('.settings-tool-chips .wiz-chip');
      expect(chips.length).toBeGreaterThan(0);

      const chip = chips[0];
      const tid = chip.getAttribute('data-val');
      const cat = chip.getAttribute('data-cat');

      // Click to activate
      chip.click();
      expect(chip.classList.contains('active')).toBe(true);

      const prefs = Store.getToolPrefs();
      expect(prefs[cat]).toContain(tid);
    });

    test('clicking active tool chip deactivates it', () => {
      Store.saveToolPrefs({ social: ['instagram'] });
      const app = goToSettings();

      const igChip = app.querySelector('.wiz-chip[data-val="instagram"]');
      expect(igChip).toBeTruthy();
      expect(igChip.classList.contains('active')).toBe(true);

      igChip.click();
      expect(igChip.classList.contains('active')).toBe(false);

      const prefs = Store.getToolPrefs();
      expect(prefs.social).not.toContain('instagram');
    });

    test('multiple tools can be selected in same category', () => {
      const app = goToSettings();

      const socialChips = app.querySelectorAll('.wiz-chip[data-cat="social"]');
      expect(socialChips.length).toBeGreaterThanOrEqual(2);

      socialChips[0].click();
      socialChips[1].click();

      const prefs = Store.getToolPrefs();
      expect(prefs.social.length).toBe(2);
    });
  });

  describe('stage selector', () => {
    test('clicking a stage card changes business stage', () => {
      const app = goToSettings();

      const growthCard = app.querySelector('.stage-card[data-stage="growth"]');
      expect(growthCard).toBeTruthy();
      growthCard.click();

      const biz = Store.getBusiness();
      expect(biz.stage).toBe('growth');
    });

    test('active stage card reflects current stage', () => {
      const app = goToSettings();

      const activeCard = app.querySelector('.stage-card.active');
      expect(activeCard.dataset.stage).toBe('idea');
    });

    test('stage cards re-render after selection', () => {
      const app = goToSettings();

      const validationCard = app.querySelector('.stage-card[data-stage="validation"]');
      validationCard.click();

      const newActive = app.querySelector('.stage-card.active');
      expect(newActive.dataset.stage).toBe('validation');
    });
  });

  describe('export functionality', () => {
    test('export button exists', () => {
      const app = goToSettings();
      const exportBtn = document.getElementById('btn-export');
      expect(exportBtn).toBeTruthy();
    });
  });

  describe('import functionality', () => {
    test('import button and file input exist', () => {
      const app = goToSettings();
      const importBtn = document.getElementById('btn-import');
      const importFile = document.getElementById('import-file');
      expect(importBtn).toBeTruthy();
      expect(importFile).toBeTruthy();
    });
  });

  describe('reset functionality', () => {
    test('reset button exists', () => {
      const app = goToSettings();
      const resetBtn = document.getElementById('btn-reset');
      expect(resetBtn).toBeTruthy();
    });

    test('reset clears all data after confirm', () => {
      Store.addHypothesis({ statement: 'Test' });
      Store.addCanvasItem('valueProp', 'Value');

      const app = goToSettings();

      global.confirm.mockReturnValueOnce(true);
      document.getElementById('btn-reset').click();

      expect(Store.getBusiness()).toBeNull();
      expect(Store.getHypotheses()).toEqual([]);
      expect(Store.isWizardComplete()).toBe(false);
    });

    test('reset cancelled keeps data', () => {
      const app = goToSettings();

      global.confirm.mockReturnValueOnce(false);
      document.getElementById('btn-reset').click();

      expect(Store.getBusiness()).toBeTruthy();
    });
  });

  describe('business info display', () => {
    test('shows business name and type', () => {
      const app = goToSettings();
      expect(app.textContent).toContain('Settings Test');
      expect(app.textContent).toContain('service');
    });

    test('shows creation date', () => {
      const app = goToSettings();
      expect(app.textContent).toContain('2025-01-01');
    });
  });
});

describe('App routing', () => {
  describe('simulation route', () => {
    test('simulation is the default route when wizard complete', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });
      window.location.hash = '';
      App.render();

      const app = document.getElementById('app');
      expect(app.querySelector('.sim-header')).toBeTruthy();
    });

    test('simulation route renders financial projection', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });
      window.location.hash = '#simulation';
      App.render();

      const app = document.getElementById('app');
      expect(app.querySelector('.sim-header')).toBeTruthy();
      expect(app.querySelector('.sim-kpi-strip')).toBeTruthy();
    });
  });

  describe('nav active state', () => {
    test('Projection link is active on simulation route', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#simulation';
      App.render();

      const activeLink = document.querySelector('.nav-link.active');
      expect(activeLink.textContent).toBe('Projection');
    });

    test('Canvas link is active on canvas route', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#canvas';
      App.render();

      const activeLink = document.querySelector('.nav-link.active');
      expect(activeLink.textContent).toBe('Canvas');
    });

    test('Settings link is active on settings route', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#settings';
      App.render();

      const activeLink = document.querySelector('.nav-link.active');
      expect(activeLink.textContent).toBe('Settings');
    });
  });

  describe('XSS protection', () => {
    test('business name is HTML-escaped in nav', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: '<script>alert(1)</script>' });
      window.location.hash = '#tracker';
      App.render();

      const brand = document.querySelector('.nav-brand');
      expect(brand.innerHTML).not.toContain('<script>');
      expect(brand.textContent).toContain('<script>');
    });

    test('business name is HTML-escaped in settings', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: '<img onerror=alert(1)>', type: 'service', createdAt: '2025-01-01', stage: 'idea' });
      window.location.hash = '#settings';
      App.render();

      const app = document.getElementById('app');
      expect(app.innerHTML).not.toContain('<img onerror');
    });
  });
});
