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

    test('add button calls prompt and adds to store', () => {
      Store.saveBusiness({ name: 'Test' });
      const container = document.createElement('div');
      Canvas.render(container);

      global.prompt.mockReturnValueOnce('New customer segment');
      const addBtns = container.querySelectorAll('.bmc-add');
      let segAddBtn = null;
      addBtns.forEach(btn => {
        if (btn.dataset.element === 'customerSegments') segAddBtn = btn;
      });
      expect(segAddBtn).toBeTruthy();
      segAddBtn.click();

      const canvas = Store.getCanvas();
      expect(canvas.customerSegments).toHaveLength(1);
      expect(canvas.customerSegments[0].text).toBe('New customer segment');
    });

    test('uses adaptive terminology labels based on business type', () => {
      Store.saveBusiness({ name: 'Test Cafe', type: 'restaurant' });
      const container = document.createElement('div');
      Canvas.render(container);
      const labels = container.querySelectorAll('.bmc-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      // Restaurant should use "Your Guests" instead of "Customer Segments"
      expect(labelTexts).toContain('Your Guests');
    });

    test('renders status-testing class for items with testing hypotheses', () => {
      Store.addCanvasItem('valueProp', 'Great coffee');
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'People love our coffee',
        status: 'testing',
        actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      const testingItems = container.querySelectorAll('.status-testing');
      expect(testingItems.length).toBeGreaterThanOrEqual(1);
    });

    test('renders status-risk class for items with invalidated hypotheses', () => {
      Store.addCanvasItem('valueProp', 'Fast delivery');
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Customers want fast delivery',
        status: 'invalidated',
        actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      const riskItems = container.querySelectorAll('.status-risk');
      expect(riskItems.length).toBeGreaterThanOrEqual(1);
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
      expect(cards).toHaveLength(4);
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
      expect(counts[0].textContent).toBe('3');  // Total
      expect(counts[1].textContent).toBe('2');  // Testing
      expect(counts[2].textContent).toBe('1');  // Validated
      expect(counts[3].textContent).toBe('0');  // Invalidated
    });

    test('progress caps at 100%', () => {
      Store.addHypothesis({
        id: 'cap-h1',
        statement: 'Exceeded target',
        category: 'revenue',
        canvasElement: 'revenueStreams',
        status: 'testing',
        target: 50,
        unit: 'customers',
        actuals: [{ date: '2025-01-15', value: 80, note: '' }],
        priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const pct = container.querySelector('.hyp-progress-pct');
      expect(pct.textContent).toBe('100%');
    });

    test('renders data history table', () => {
      Store.addHypothesis({
        id: 'hist-h1',
        statement: 'History test',
        category: 'value',
        canvasElement: 'valueProp',
        status: 'testing',
        target: 10,
        actuals: [
          { date: '2025-01-01', value: 5, note: 'First week' },
          { date: '2025-01-08', value: 8, note: 'Second week' }
        ],
        priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const history = container.querySelector('.hyp-history');
      expect(history).toBeTruthy();
      expect(history.textContent).toContain('2 data points');
    });

    test('renders critical priority badge', () => {
      Store.addHypothesis({
        statement: 'Critical hyp',
        category: 'value',
        canvasElement: 'valueProp',
        status: 'testing',
        target: 10,
        actuals: [],
        priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const priorityBadge = container.querySelector('.hyp-priority');
      expect(priorityBadge).toBeTruthy();
      expect(priorityBadge.textContent).toBe('Critical');
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

    test('adds hypothesis and re-renders with nav preserved', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });
      window.location.hash = '#tracker';
      App.render();

      // Mock prompt sequence: statement, metric, target, unit
      global.prompt
        .mockReturnValueOnce('Test assumption')
        .mockReturnValueOnce('Daily customers')
        .mockReturnValueOnce('50')
        .mockReturnValueOnce('customers/day');

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('Test assumption');
      expect(hyps[0].metric).toBe('Daily customers');
      expect(hyps[0].target).toBe(50);

      // Verify nav is still present (bug fix check)
      const app = document.getElementById('app');
      expect(app.querySelector('.main-nav')).toBeTruthy();
      expect(app.querySelector('.hyp-card')).toBeTruthy();
    });
  });
});

describe('App', () => {
  describe('render()', () => {
    test('renders wizard when wizard not complete', () => {
      App.render();
      const app = document.getElementById('app');
      expect(app.querySelector('.ob-entrance') || app.querySelector('.ob-workspace')).toBeTruthy();
    });

    test('renders simulation when wizard is complete and no hash', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });
      window.location.hash = '';
      App.render();
      const app = document.getElementById('app');
      expect(app.querySelector('.sim-header')).toBeTruthy();
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

    test('settings allows nav even when wizard incomplete', () => {
      window.location.hash = '#settings';
      App.render();
      const app = document.getElementById('app');
      expect(app.textContent).toContain('Settings');
    });

    test('settings stage change updates business', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Stage Test', stage: 'idea' });
      window.location.hash = '#settings';
      App.render();

      const validationCard = document.querySelector('.stage-card[data-stage="validation"]');
      expect(validationCard).toBeTruthy();
      validationCard.click();

      const biz = Store.getBusiness();
      expect(biz.stage).toBe('validation');
    });

    test('nav brand shows business name when set', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Acme Corp' });
      window.location.hash = '#tracker';
      App.render();
      const brand = document.querySelector('.nav-brand');
      expect(brand.textContent).toBe('Acme Corp');
    });

    test('nav brand shows BMT when no business', () => {
      Store.setWizardComplete();
      window.location.hash = '#tracker';
      App.render();
      const brand = document.querySelector('.nav-brand');
      expect(brand.textContent).toBe('BMT');
    });

    test('nav hides Tracker and Canvas links when wizard incomplete', () => {
      window.location.hash = '#settings';
      App.render();
      const nav = document.querySelector('.main-nav');
      const links = nav.querySelectorAll('.nav-link');
      const linkTexts = Array.from(links).map(l => l.textContent);
      expect(linkTexts).not.toContain('Tracker');
      expect(linkTexts).not.toContain('Canvas');
      expect(linkTexts).toContain('Settings');
    });

    test('nav shows all links when wizard complete', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test' });
      window.location.hash = '#tracker';
      App.render();
      const nav = document.querySelector('.main-nav');
      const links = nav.querySelectorAll('.nav-link');
      const linkTexts = Array.from(links).map(l => l.textContent);
      expect(linkTexts).toContain('Projection');
      expect(linkTexts).toContain('Tracker');
      expect(linkTexts).toContain('Canvas');
      expect(linkTexts).toContain('Settings');
    });
  });
});

describe('SimulationUI', () => {
  beforeEach(() => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Sim Test', type: 'service' });
  });

  test('renders all main sections', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
    expect(container.querySelector('.sim-svg')).toBeTruthy();
    expect(container.querySelector('.sim-pl-table')).toBeTruthy();
  });

  test('renders scenario toggle with all three scenarios', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const scenarios = container.querySelectorAll('.sim-sc');
    expect(scenarios).toHaveLength(3);
    const labels = Array.from(scenarios).map(s => s.textContent);
    expect(labels).toContain('Pessimistic');
    expect(labels).toContain('Base Case');
    expect(labels).toContain('Optimistic');
  });

  test('renders edit assumptions button', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const editBtn = container.querySelector('#sim-toggle-edit');
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent).toBe('Edit Assumptions');
  });

  test('clicking edit shows slider panel', () => {
    // Must render into DOM-attached element (bindEvents uses document.getElementById)
    const app = document.getElementById('app');
    app.innerHTML = '';
    const container = document.createElement('div');
    app.appendChild(container);
    SimulationUI.render(container);

    const editBtn = document.getElementById('sim-toggle-edit');
    editBtn.click();

    // After click, edit panel should be visible
    expect(container.querySelector('.sim-edit-panel')).toBeTruthy();
    expect(container.querySelectorAll('input[type=range]').length).toBeGreaterThan(0);
  });

  test('scenario click switches active scenario', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const pessimistic = container.querySelector('.sim-sc[data-scenario="pessimistic"]');
    pessimistic.click();

    const active = container.querySelector('.sim-sc.active');
    expect(active.dataset.scenario).toBe('pessimistic');
  });

  test('renders KPI cards with values', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const kpis = container.querySelectorAll('.sim-kpi');
    expect(kpis.length).toBeGreaterThanOrEqual(6);

    const labels = Array.from(kpis).map(k => k.querySelector('.sim-kpi-label').textContent);
    expect(labels).toContain('Break-even');
    expect(labels).toContain('Y1 Revenue');
    expect(labels).toContain('Gross Margin');
  });

  test('renders revenue stream breakdown', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    expect(container.textContent).toContain('Revenue Streams');
    const streamBadges = container.querySelectorAll('.sim-type-badge');
    expect(streamBadges.length).toBeGreaterThan(0);
  });

  test('saves sim config to store', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const config = Store.getSimConfig();
    expect(config).toBeTruthy();
    expect(config.revenueStreams.length).toBeGreaterThan(0);
  });

  test('uses stored sim config when available', () => {
    const customConfig = SimulationTypes.getDefaults('restaurant');
    customConfig.startingCash = 77777;
    Store.saveSimConfig(customConfig);

    const container = document.createElement('div');
    SimulationUI.render(container);

    const config = Store.getSimConfig();
    expect(config.startingCash).toBe(77777);
  });

  test('P&L table shows correct row labels', () => {
    const container = document.createElement('div');
    SimulationUI.render(container);

    const tableText = container.querySelector('.sim-pl-wrap').textContent;
    expect(tableText).toContain('Revenue');
    expect(tableText).toContain('COGS');
    expect(tableText).toContain('Gross Profit');
    expect(tableText).toContain('Net Income');
    expect(tableText).toContain('Cash Balance');
  });
});

describe('Wizard', () => {
  describe('render()', () => {
    test('renders initial URL entry stage', () => {
      Wizard.reset();
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
      expect(container.querySelector('#ob-url')).toBeTruthy();
      expect(container.querySelector('#btn-analyze')).toBeTruthy();
      expect(container.querySelector('#btn-skip')).toBeTruthy();
    });
  });

  describe('reset()', () => {
    test('resets wizard state and shows URL stage', () => {
      Wizard.reset();
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
    });
  });
});
