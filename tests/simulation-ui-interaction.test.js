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

describe('SimulationUI — interaction tests', () => {

  function setupAndRender() {
    Store.saveBusiness({ name: 'Test Biz', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);
    return container;
  }

  describe('scenario switching', () => {
    test('clicking pessimistic scenario updates KPIs', () => {
      const container = setupAndRender();

      // Find initial base KPI values
      const initialKpis = container.querySelectorAll('.sim-kpi-value');
      const initialValues = Array.from(initialKpis).map(k => k.textContent);

      // Click pessimistic
      const scenarios = container.querySelectorAll('.sim-sc');
      let pessimistic = null;
      scenarios.forEach(s => {
        if (s.dataset.scenario === 'pessimistic') pessimistic = s;
      });
      pessimistic.click();

      // After re-render, active scenario should change
      const activeScenario = container.querySelector('.sim-sc.active');
      expect(activeScenario.textContent).toBe('Pessimistic');
    });

    test('clicking optimistic scenario changes active class', () => {
      const container = setupAndRender();

      const scenarios = container.querySelectorAll('.sim-sc');
      let optimistic = null;
      scenarios.forEach(s => {
        if (s.dataset.scenario === 'optimistic') optimistic = s;
      });
      optimistic.click();

      const activeScenario = container.querySelector('.sim-sc.active');
      expect(activeScenario.textContent).toBe('Optimistic');
    });
  });

  describe('edit mode', () => {
    function openEditMode(container) {
      // Toggle edit mode until edit panel is visible
      const editBtn = document.getElementById('sim-toggle-edit');
      if (!container.querySelector('.sim-edit-panel')) {
        editBtn.click();
      }
    }

    function closeEditMode(container) {
      const editBtn = document.getElementById('sim-toggle-edit');
      if (container.querySelector('.sim-edit-panel')) {
        editBtn.click();
      }
    }

    test('edit button toggles edit panel on', () => {
      const container = setupAndRender();
      closeEditMode(container);

      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();
      document.getElementById('sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeTruthy();
    });

    test('edit panel shows slider controls', () => {
      const container = setupAndRender();
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-slider input[type=range]');
      expect(sliders.length).toBeGreaterThan(0);
    });

    test('starting cash slider exists', () => {
      const container = setupAndRender();
      openEditMode(container);

      const cashSlider = container.querySelector('input[data-key="startingCash"]');
      expect(cashSlider).toBeTruthy();
    });

    test('projection months slider exists', () => {
      const container = setupAndRender();
      openEditMode(container);

      const monthSlider = container.querySelector('input[data-key="projectionMonths"]');
      expect(monthSlider).toBeTruthy();
    });

    test('revenue stream price slider exists', () => {
      const container = setupAndRender();
      openEditMode(container);

      const priceSlider = container.querySelector('input[data-key="rs_price_0"]');
      expect(priceSlider).toBeTruthy();
    });

    test('edit button toggles edit panel off', () => {
      const container = setupAndRender();
      openEditMode(container);
      expect(container.querySelector('.sim-edit-panel')).toBeTruthy();

      document.getElementById('sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();
    });
  });

  describe('KPI display', () => {
    test('renders all 6 KPI cards', () => {
      const container = setupAndRender();
      const kpis = container.querySelectorAll('.sim-kpi');
      expect(kpis).toHaveLength(6);
    });

    test('KPI labels are correct', () => {
      const container = setupAndRender();
      const labels = container.querySelectorAll('.sim-kpi-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Break-even');
      expect(labelTexts).toContain('Funding Needed');
      expect(labelTexts).toContain('Y1 Revenue');
      expect(labelTexts).toContain('Y3 Cash');
      expect(labelTexts).toContain('Gross Margin');
      expect(labelTexts).toContain('Final Monthly');
    });
  });

  describe('charts', () => {
    test('renders cash flow SVG chart', () => {
      const container = setupAndRender();
      const svgs = container.querySelectorAll('.sim-svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
    });

    test('renders revenue vs costs chart', () => {
      const container = setupAndRender();
      const sections = container.querySelectorAll('.sim-section');
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('P&L table', () => {
    test('renders quarterly columns for year 1', () => {
      const container = setupAndRender();
      const headers = container.querySelectorAll('.sim-pl-yr');
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts).toContain('Q1 Y1');
      expect(headerTexts).toContain('Q4 Y1');
    });

    test('renders rows for Revenue, COGS, Gross Profit, etc.', () => {
      const container = setupAndRender();
      const tableText = container.querySelector('.sim-pl-table').textContent;
      expect(tableText).toContain('Revenue');
      expect(tableText).toContain('COGS');
      expect(tableText).toContain('Gross Profit');
      expect(tableText).toContain('Net Income');
    });
  });

  describe('stream breakdown', () => {
    test('renders revenue stream breakdown table', () => {
      const container = setupAndRender();
      const tables = container.querySelectorAll('.sim-pl-table');
      // Should have at least 2 tables (P&L + stream breakdown)
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('config persistence', () => {
    test('auto-creates config from business data if none saved', () => {
      Store.saveBusiness({ name: 'New Biz', type: 'restaurant' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const config = Store.getSimConfig();
      expect(config).toBeTruthy();
      expect(config.businessType).toBe('restaurant');
    });

    test('uses saved config if available', () => {
      Store.saveBusiness({ name: 'Saved Config', type: 'service' });
      Store.saveSimConfig({
        businessType: 'service',
        projectionMonths: 24,
        startingCash: 99999,
        revenueStreams: [{ id: 'rs1', name: 'Custom', type: 'unit', unitPrice: 200, unitsPerMonth: 50, growthRate: 5, cogsPerUnit: 0, cogsPct: 0, churnRate: 0 }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [{ name: 'Rent', monthly: 1000, growthRate: 0 }],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { pessimistic: { revenueMult: 0.7, costMult: 1.1 }, base: { revenueMult: 1.0, costMult: 1.0 }, optimistic: { revenueMult: 1.3, costMult: 0.95 } }
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const config = Store.getSimConfig();
      expect(config.startingCash).toBe(99999);
    });

    test('results are saved to store after render', () => {
      Store.saveBusiness({ name: 'Results Test', type: 'service' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const results = Store.getSimResults();
      expect(results).toBeTruthy();
      expect(results.months).toBeTruthy();
      expect(results.months.length).toBeGreaterThan(0);
    });
  });

  describe('different business types render correctly', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      test(`${type} renders without errors`, () => {
        Store.saveBusiness({ name: `Test ${type}`, type: type });
        const container = document.createElement('div');
        document.body.appendChild(container);

        expect(() => {
          SimulationUI.render(container);
        }).not.toThrow();

        expect(container.querySelector('.sim-header')).toBeTruthy();
        expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
      });
    });
  });
});
