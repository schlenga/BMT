const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  // Stub window.alert, confirm, prompt for UI modules
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);

  loadModules(['store', 'ai', 'prompts', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
});

describe('Canvas', () => {
  describe('ELEMENTS', () => {
    test('has 9 business model canvas elements', () => {
      expect(Canvas.ELEMENTS).toHaveLength(9);
    });

    test('each element has key, label, icon, hint', () => {
      Canvas.ELEMENTS.forEach(el => {
        expect(el.key).toBeTruthy();
        expect(el.label).toBeTruthy();
        expect(el.icon).toBeTruthy();
        expect(el.hint).toBeTruthy();
      });
    });

    test('element keys match store canvas keys', () => {
      const canvas = Store.getCanvas();
      Canvas.ELEMENTS.forEach(el => {
        expect(canvas).toHaveProperty(el.key);
      });
    });
  });

  describe('render()', () => {
    test('renders canvas grid into container', () => {
      Store.saveBusiness({ name: 'Test Biz' });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelector('.bmc-grid')).toBeTruthy();
      expect(container.querySelector('.canvas-header')).toBeTruthy();
    });

    test('renders business name as title', () => {
      Store.saveBusiness({ name: 'My Coffee Shop' });
      const container = document.createElement('div');
      Canvas.render(container);
      const title = container.querySelector('.page-title');
      expect(title.textContent).toContain('My Coffee Shop');
    });

    test('renders canvas items', () => {
      Store.addCanvasItem('customerSegments', 'Young professionals');
      Store.addCanvasItem('customerSegments', 'Students');
      const container = document.createElement('div');
      Canvas.render(container);
      const items = container.querySelectorAll('.bmc-item');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    test('renders add buttons for each element', () => {
      const container = document.createElement('div');
      Canvas.render(container);
      const addBtns = container.querySelectorAll('.bmc-add');
      expect(addBtns).toHaveLength(9);
    });

    test('renders hypothesis badge count', () => {
      Store.addHypothesis({
        canvasElement: 'customerSegments',
        category: 'customer',
        statement: 'Test',
        status: 'testing',
        actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      const badges = container.querySelectorAll('.bmc-hyp-badge');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Tracker', () => {
  describe('render()', () => {
    test('renders tracker with summary cards', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.tracker-summary')).toBeTruthy();
      const cards = container.querySelectorAll('.summary-card');
      expect(cards).toHaveLength(4); // Total, Testing, Validated, Invalidated
    });

    test('renders hypothesis cards', () => {
      Store.addHypothesis({
        statement: 'Test hypothesis',
        category: 'value',
        canvasElement: 'valueProp',
        status: 'testing',
        target: 10,
        unit: 'customers',
        actuals: [],
        priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const hypCards = container.querySelectorAll('.hyp-card');
      expect(hypCards).toHaveLength(1);
      expect(hypCards[0].textContent).toContain('Test hypothesis');
    });

    test('renders filter buttons', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      const filters = container.querySelectorAll('.filter-btn');
      expect(filters.length).toBeGreaterThanOrEqual(7);
    });

    test('renders lean tip section', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.lean-tip')).toBeTruthy();
    });

    test('shows empty state when no hypotheses', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.tracker-empty')).toBeTruthy();
    });

    test('renders progress bar for hypothesis with data', () => {
      Store.addHypothesis({
        id: 'prog-h1',
        statement: 'Progress test',
        category: 'revenue',
        canvasElement: 'revenueStreams',
        status: 'testing',
        target: 100,
        unit: 'customers',
        actuals: [{ date: '2025-01-15', value: 60, note: '' }],
        priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const progressBar = container.querySelector('.hyp-progress-fill');
      expect(progressBar).toBeTruthy();
      expect(progressBar.style.width).toBe('60%');
    });

    test('renders sparkline for hypothesis with 2+ data points', () => {
      Store.addHypothesis({
        id: 'spark-h1',
        statement: 'Sparkline test',
        category: 'revenue',
        canvasElement: 'revenueStreams',
        status: 'testing',
        target: 100,
        unit: 'customers',
        actuals: [
          { date: '2025-01-01', value: 20, note: '' },
          { date: '2025-01-15', value: 40, note: '' },
          { date: '2025-02-01', value: 60, note: '' }
        ],
        priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.sparkline')).toBeTruthy();
    });

    test('shows summary counts correctly', () => {
      Store.addHypothesis({ statement: 'H1', status: 'testing', category: 'value', actuals: [] });
      Store.addHypothesis({ statement: 'H2', status: 'testing', category: 'value', actuals: [] });
      Store.addHypothesis({ statement: 'H3', status: 'validated', category: 'value', actuals: [] });

      const container = document.createElement('div');
      Tracker.render(container);
      const counts = container.querySelectorAll('.summary-count');
      // Total, Testing, Validated, Invalidated
      expect(counts[0].textContent).toBe('3');  // Total
      expect(counts[1].textContent).toBe('2');  // Testing
      expect(counts[2].textContent).toBe('1');  // Validated
      expect(counts[3].textContent).toBe('0');  // Invalidated
    });
  });

  describe('addNew()', () => {
    test('does nothing when user cancels prompt', () => {
      global.prompt.mockReturnValueOnce(null);
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('does nothing on empty input', () => {
      global.prompt.mockReturnValueOnce('   ');
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });
  });
});

describe('App', () => {
  describe('render()', () => {
    test('renders wizard when wizard not complete', () => {
      App.render();
      const app = document.getElementById('app');
      expect(app.querySelector('.onboarding')).toBeTruthy();
    });

    test('renders tracker when wizard is complete and no hash', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '';
      App.render();
      const app = document.getElementById('app');
      expect(app.querySelector('.tracker-header')).toBeTruthy();
    });

    test('renders nav with correct active state', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#tracker';
      App.render();
      const nav = document.querySelector('.main-nav');
      expect(nav).toBeTruthy();
      const activeLink = nav.querySelector('.nav-link.active');
      expect(activeLink.textContent).toBe('Tracker');
    });

    test('renders canvas page', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#canvas';
      App.render();
      const app = document.getElementById('app');
      expect(app.querySelector('.bmc-grid')).toBeTruthy();
    });

    test('renders settings page', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#settings';
      App.render();
      const app = document.getElementById('app');
      expect(app.textContent).toContain('Settings');
    });

    test('settings page shows business info', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'My Biz', type: 'saas', description: 'A SaaS product', createdAt: '2025-01-01', stage: 'validation' });
      window.location.hash = '#settings';
      App.render();
      const app = document.getElementById('app');
      expect(app.textContent).toContain('My Biz');
      expect(app.textContent).toContain('saas');
    });

    test('settings renders stage selector', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', stage: 'idea' });
      window.location.hash = '#settings';
      App.render();
      const stageCards = document.querySelectorAll('.stage-card');
      expect(stageCards).toHaveLength(3);
      const activeStage = document.querySelector('.stage-card.active');
      expect(activeStage.dataset.stage).toBe('idea');
    });

    test('settings renders tool preference chips', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#settings';
      App.render();
      const chips = document.querySelectorAll('.settings-tool-chips .wiz-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('settings allows wizard nav even when incomplete', () => {
      window.location.hash = '#settings';
      App.render();
      const app = document.getElementById('app');
      expect(app.textContent).toContain('Settings');
    });
  });
});

describe('Wizard', () => {
  describe('render()', () => {
    test('renders onboarding shell', () => {
      const container = document.createElement('div');
      Wizard.render(container);
      expect(container.querySelector('.onboarding')).toBeTruthy();
      expect(container.querySelector('.conv-thread')).toBeTruthy();
      expect(container.querySelector('.conv-input-area')).toBeTruthy();
    });

    test('renders progress bar', () => {
      const container = document.createElement('div');
      Wizard.render(container);
      expect(container.querySelector('.conv-progress-bar')).toBeTruthy();
    });

    test('renders preview panel', () => {
      const container = document.createElement('div');
      Wizard.render(container);
      expect(container.querySelector('.onboarding-preview')).toBeTruthy();
      expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
    });

    test('first step shows URL input', () => {
      Wizard.reset();
      const container = document.createElement('div');
      Wizard.render(container);
      expect(container.querySelector('#wiz-url')).toBeTruthy();
    });
  });

  describe('reset()', () => {
    test('resets wizard state', () => {
      Wizard.reset();
      const container = document.createElement('div');
      Wizard.render(container);
      // Should be back to first step
      expect(container.querySelector('#wiz-url')).toBeTruthy();
    });
  });
});
