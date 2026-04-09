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

function setupAndRender(type) {
  type = type || 'service';
  Store.saveBusiness({ name: 'Test Biz', type: type, stage: 'validation' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  SimulationUI.render(container);
  return container;
}

// Helper: ensure edit panel is visible (handles persistent editMode state)
function openEditMode(container) {
  if (!container.querySelector('.sim-edit-panel')) {
    container.querySelector('#sim-toggle-edit').click();
  }
}

// Helper: ensure edit panel is hidden
function closeEditMode(container) {
  if (container.querySelector('.sim-edit-panel')) {
    container.querySelector('#sim-toggle-edit').click();
  }
}

describe('SimulationUI interactions', () => {
  describe('scenario switching', () => {
    test('clicking pessimistic scenario re-renders with different data', () => {
      const container = setupAndRender();
      const pessTab = container.querySelector('[data-scenario="pessimistic"]');
      expect(pessTab).toBeTruthy();
      pessTab.click();

      const activeTab = container.querySelector('.sim-sc.active');
      expect(activeTab.textContent).toBe('Pessimistic');
    });

    test('clicking optimistic scenario re-renders', () => {
      const container = setupAndRender();
      const optTab = container.querySelector('[data-scenario="optimistic"]');
      optTab.click();

      const activeTab = container.querySelector('.sim-sc.active');
      expect(activeTab.textContent).toBe('Optimistic');
    });

    test('switching back to base scenario works', () => {
      const container = setupAndRender();
      container.querySelector('[data-scenario="pessimistic"]').click();
      container.querySelector('[data-scenario="base"]').click();

      const activeTab = container.querySelector('.sim-sc.active');
      expect(activeTab.textContent).toBe('Base Case');
    });
  });

  describe('edit mode', () => {
    test('toggling Edit Assumptions shows and hides edit panel', () => {
      const container = setupAndRender();
      closeEditMode(container);
      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();

      container.querySelector('#sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeTruthy();

      container.querySelector('#sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();
    });

    test('edit panel contains sliders for starting cash and projection months', () => {
      const container = setupAndRender();
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      expect(sliders.length).toBeGreaterThan(0);

      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys).toContain('startingCash');
      expect(keys).toContain('projectionMonths');
    });

    test('edit panel contains revenue stream sliders', () => {
      const container = setupAndRender();
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys.some(k => k.startsWith('rs_price_'))).toBe(true);
      expect(keys.some(k => k.startsWith('rs_volume_'))).toBe(true);
      expect(keys.some(k => k.startsWith('rs_growth_'))).toBe(true);
    });

    test('edit panel contains staff sliders', () => {
      const container = setupAndRender();
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys.some(k => k.startsWith('staff_count_'))).toBe(true);
      expect(keys.some(k => k.startsWith('staff_cost_'))).toBe(true);
    });

    test('edit panel contains opex sliders', () => {
      const container = setupAndRender();
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys.some(k => k.startsWith('opex_'))).toBe(true);
    });

    test('changing slider updates config value', () => {
      const container = setupAndRender();
      openEditMode(container);

      const cashSlider = container.querySelector('input[data-key="startingCash"]');
      expect(cashSlider).toBeTruthy();

      cashSlider.value = '50000';
      cashSlider.dispatchEvent(new Event('input'));
      cashSlider.dispatchEvent(new Event('change'));

      const savedConfig = Store.getSimConfig();
      expect(savedConfig.startingCash).toBe(50000);
    });

    test('revenue stream slider updates config', () => {
      const container = setupAndRender();
      openEditMode(container);

      const priceSlider = container.querySelector('input[data-key="rs_price_0"]');
      expect(priceSlider).toBeTruthy();

      priceSlider.value = '120';
      priceSlider.dispatchEvent(new Event('input'));
      priceSlider.dispatchEvent(new Event('change'));

      const savedConfig = Store.getSimConfig();
      expect(savedConfig.revenueStreams[0].unitPrice).toBe(120);
    });
  });

  describe('charts', () => {
    test('renders cash flow SVG chart', () => {
      const container = setupAndRender();
      const svgs = container.querySelectorAll('.sim-svg');
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });

    test('cash chart has scenario lines', () => {
      const container = setupAndRender();
      const firstSvg = container.querySelector('.sim-svg');
      const polylines = firstSvg.querySelectorAll('polyline');
      expect(polylines.length).toBe(3); // pessimistic, optimistic, base
    });

    test('revenue chart has bars', () => {
      const container = setupAndRender();
      const svgs = container.querySelectorAll('.sim-svg');
      const revenueChart = svgs[1]; // second chart
      const rects = revenueChart.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('P&L table', () => {
    test('P&L table has quarterly and annual columns', () => {
      const container = setupAndRender();
      const table = container.querySelector('.sim-pl-table');
      expect(table).toBeTruthy();
      const headers = table.querySelectorAll('.sim-pl-yr');
      expect(headers.length).toBeGreaterThan(0);
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts.some(h => h.startsWith('Q'))).toBe(true);
    });

    test('P&L table has revenue, COGS, and net income rows', () => {
      const container = setupAndRender();
      const table = container.querySelector('.sim-pl-table');
      const cellTexts = table.textContent;
      expect(cellTexts).toContain('Revenue');
      expect(cellTexts).toContain('COGS');
      expect(cellTexts).toContain('Net Income');
      expect(cellTexts).toContain('Cash Balance');
    });
  });

  describe('revenue stream breakdown', () => {
    test('renders stream breakdown table', () => {
      const container = setupAndRender();
      const tables = container.querySelectorAll('.sim-pl-table');
      // Should have at least 2 tables: P&L and stream breakdown
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });

    test('stream breakdown shows margin and share columns', () => {
      const container = setupAndRender();
      const tables = container.querySelectorAll('.sim-pl-table');
      const lastTable = tables[tables.length - 1];
      const text = lastTable.textContent;
      expect(text).toContain('Margin');
      expect(text).toContain('% of Total');
    });
  });

  describe('different business types', () => {
    ['restaurant', 'retail', 'saas', 'ecommerce', 'subscription'].forEach(type => {
      test(`renders correctly for ${type} type`, () => {
        const container = setupAndRender(type);
        expect(container.querySelector('.sim-header')).toBeTruthy();
        expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
        expect(container.querySelector('.sim-svg')).toBeTruthy();
      });
    });

    test('SaaS type shows churn slider in edit mode', () => {
      const container = setupAndRender('saas');
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys.some(k => k.startsWith('rs_churn_'))).toBe(true);
    });

    test('restaurant type shows COGS % slider in edit mode', () => {
      const container = setupAndRender('restaurant');
      openEditMode(container);

      const sliders = container.querySelectorAll('.sim-edit-panel input[type=range]');
      const keys = Array.from(sliders).map(s => s.dataset.key);
      expect(keys.some(k => k.startsWith('rs_cogspct_'))).toBe(true);
    });
  });

  describe('config persistence', () => {
    test('auto-builds config from wizard data when none saved', () => {
      Store.saveBusiness({ name: 'New Biz', type: 'retail' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const config = Store.getSimConfig();
      expect(config).toBeTruthy();
      expect(config.businessType).toBe('retail');
    });

    test('uses saved config when available', () => {
      Store.saveBusiness({ name: 'Existing', type: 'service' });
      const customConfig = SimulationTypes.getDefaults('service');
      customConfig.startingCash = 99999;
      Store.saveSimConfig(customConfig);

      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      // Should use the custom starting cash
      const config = Store.getSimConfig();
      expect(config.startingCash).toBe(99999);
    });

    test('saves sim results after render', () => {
      Store.saveBusiness({ name: 'Results Test', type: 'service' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const results = Store.getSimResults();
      expect(results).toBeTruthy();
      expect(results.months).toBeTruthy();
      expect(results.summary).toBeTruthy();
    });
  });
});
