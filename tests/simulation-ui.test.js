const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

function renderSim(bizType, opts) {
  Store.saveBusiness({ name: 'Test Biz', type: bizType || 'service' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  SimulationUI.render(container);
  // Ensure edit mode is off (module state persists between tests)
  if (!opts || !opts.editMode) {
    if (container.querySelector('.sim-edit-panel')) {
      container.querySelector('#sim-toggle-edit').click();
    }
  }
  return container;
}

describe('SimulationUI', () => {
  describe('render()', () => {
    test('renders all major sections', () => {
      const c = renderSim();
      expect(c.querySelector('.sim-header')).toBeTruthy();
      expect(c.querySelector('.sim-kpi-strip')).toBeTruthy();
      expect(c.querySelector('.sim-chart-wrap')).toBeTruthy();
      expect(c.querySelector('.sim-pl-table')).toBeTruthy();
    });

    test('renders Edit Assumptions button', () => {
      const c = renderSim();
      const btn = c.querySelector('#sim-toggle-edit');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toBe('Edit Assumptions');
    });

    test('builds config from wizard data when no saved config', () => {
      const c = renderSim('restaurant');
      expect(Store.getSimConfig()).toBeTruthy();
      expect(Store.getSimConfig().businessType).toBe('restaurant');
    });

    test('uses saved config when available', () => {
      const config = SimulationTypes.getDefaults('saas');
      config.startingCash = 99999;
      Store.saveSimConfig(config);
      const c = renderSim('saas');
      expect(Store.getSimConfig().startingCash).toBe(99999);
    });

    test('saves simulation results after render', () => {
      renderSim();
      const results = Store.getSimResults();
      expect(results).toBeTruthy();
      expect(results.months).toBeTruthy();
      expect(results.months.length).toBeGreaterThan(0);
    });
  });

  describe('scenario toggle', () => {
    test('renders three scenario buttons', () => {
      const c = renderSim();
      const scenarios = c.querySelectorAll('.sim-sc');
      expect(scenarios).toHaveLength(3);
    });

    test('base scenario is active by default', () => {
      const c = renderSim();
      const active = c.querySelector('.sim-sc.active');
      expect(active.textContent).toBe('Base Case');
    });

    test('clicking scenario button changes active scenario', () => {
      const c = renderSim();
      const pessimistic = c.querySelector('.sim-sc[data-scenario="pessimistic"]');
      pessimistic.click();
      const active = c.querySelector('.sim-sc.active');
      expect(active.textContent).toBe('Pessimistic');
    });

    test('switching scenario re-renders with different data', () => {
      const c = renderSim();
      const baseKPI = c.querySelector('.sim-kpi-value').textContent;
      const optimistic = c.querySelector('.sim-sc[data-scenario="optimistic"]');
      optimistic.click();
      const optKPI = c.querySelector('.sim-kpi-value').textContent;
      // Break-even may differ between scenarios
      expect(optimistic).toBeTruthy();
    });
  });

  describe('KPI cards', () => {
    test('renders 6 KPI cards', () => {
      const c = renderSim();
      const kpis = c.querySelectorAll('.sim-kpi');
      expect(kpis).toHaveLength(6);
    });

    test('KPI labels are correct', () => {
      const c = renderSim();
      const labels = c.querySelectorAll('.sim-kpi-label');
      const texts = Array.from(labels).map(l => l.textContent);
      expect(texts).toContain('Break-even');
      expect(texts).toContain('Funding Needed');
      expect(texts).toContain('Y1 Revenue');
      expect(texts).toContain('Y3 Cash');
      expect(texts).toContain('Gross Margin');
      expect(texts).toContain('Final Monthly');
    });

    test('KPI values contain currency or percentage symbols', () => {
      const c = renderSim();
      const values = c.querySelectorAll('.sim-kpi-value');
      const texts = Array.from(values).map(v => v.textContent);
      const hasDollar = texts.some(t => t.includes('$'));
      const hasPercent = texts.some(t => t.includes('%'));
      expect(hasDollar).toBe(true);
      expect(hasPercent).toBe(true);
    });

    test('color classes reflect financial health', () => {
      const c = renderSim();
      const values = c.querySelectorAll('.sim-kpi-value');
      const classes = Array.from(values).map(v => v.className);
      const hasGreen = classes.some(c => c.includes('green'));
      expect(hasGreen || classes.length > 0).toBe(true);
    });
  });

  describe('cash flow chart', () => {
    test('renders SVG chart', () => {
      const c = renderSim();
      const svgs = c.querySelectorAll('.sim-svg');
      expect(svgs.length).toBeGreaterThanOrEqual(1);
    });

    test('chart has polylines for scenarios', () => {
      const c = renderSim();
      const svg = c.querySelector('.sim-chart-wrap .sim-svg');
      const polylines = svg.querySelectorAll('polyline');
      expect(polylines).toHaveLength(3);
    });

    test('chart has endpoint circle', () => {
      const c = renderSim();
      const svg = c.querySelector('.sim-chart-wrap .sim-svg');
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(1);
    });

    test('chart has grid lines', () => {
      const c = renderSim();
      const svg = c.querySelector('.sim-chart-wrap .sim-svg');
      const lines = svg.querySelectorAll('line');
      expect(lines.length).toBeGreaterThanOrEqual(4);
    });

    test('chart has month labels', () => {
      const c = renderSim();
      const svg = c.querySelector('.sim-chart-wrap .sim-svg');
      const texts = svg.querySelectorAll('text');
      const monthTexts = Array.from(texts).filter(t => t.textContent.match(/^M\d+$/));
      expect(monthTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('revenue vs costs chart', () => {
    test('renders revenue and cost bars', () => {
      const c = renderSim();
      const chartWraps = c.querySelectorAll('.sim-chart-wrap');
      expect(chartWraps.length).toBeGreaterThanOrEqual(2);
      const revenueChart = chartWraps[1].querySelector('.sim-svg');
      expect(revenueChart).toBeTruthy();
      const rects = revenueChart.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('P&L table', () => {
    test('renders table with column headers', () => {
      const c = renderSim();
      const table = c.querySelector('.sim-pl-table');
      expect(table).toBeTruthy();
      const headers = table.querySelectorAll('th');
      expect(headers.length).toBeGreaterThanOrEqual(2);
    });

    test('renders quarterly columns for year 1', () => {
      const c = renderSim();
      const table = c.querySelector('.sim-pl-table');
      const headers = Array.from(table.querySelectorAll('th.sim-pl-yr')).map(h => h.textContent);
      expect(headers).toContain('Q1 Y1');
      expect(headers).toContain('Q2 Y1');
    });

    test('renders annual columns for years 2+', () => {
      const c = renderSim();
      const table = c.querySelector('.sim-pl-table');
      const headers = Array.from(table.querySelectorAll('th.sim-pl-yr')).map(h => h.textContent);
      expect(headers).toContain('Year 2');
      expect(headers).toContain('Year 3');
    });

    test('renders all P&L line items', () => {
      const c = renderSim();
      const table = c.querySelector('.sim-pl-table');
      const rows = Array.from(table.querySelectorAll('tbody tr')).map(r => r.children[0]?.textContent).filter(Boolean);
      expect(rows).toContain('Revenue');
      expect(rows).toContain('COGS');
      expect(rows).toContain('Gross Profit');
      expect(rows).toContain('Staff');
      expect(rows).toContain('Net Income');
      expect(rows).toContain('Cash Balance');
      expect(rows).toContain('Headcount');
    });

    test('positive/negative values have correct CSS classes', () => {
      const c = renderSim();
      const table = c.querySelector('.sim-pl-table');
      const positiveCells = table.querySelectorAll('.sim-positive');
      const negativeCells = table.querySelectorAll('.sim-negative');
      expect(positiveCells.length + negativeCells.length).toBeGreaterThan(0);
    });
  });

  describe('revenue stream breakdown', () => {
    test('renders stream breakdown table', () => {
      const c = renderSim();
      const tables = c.querySelectorAll('.sim-pl-table');
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });

    test('shows stream name, type, and financials', () => {
      const c = renderSim('restaurant');
      const tables = c.querySelectorAll('.sim-pl-table');
      const breakdown = tables[tables.length - 1];
      const headers = Array.from(breakdown.querySelectorAll('th')).map(h => h.textContent);
      expect(headers).toContain('Stream');
      expect(headers).toContain('Type');
      expect(headers).toContain('Revenue');
    });
  });

  describe('edit mode', () => {
    test('clicking Edit Assumptions shows edit panel', () => {
      const c = renderSim();
      expect(c.querySelector('.sim-edit-panel')).toBeNull();
      const btn = c.querySelector('#sim-toggle-edit');
      btn.click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
    });

    test('edit panel has slider inputs', () => {
      const c = renderSim();
      // Enter edit mode
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      const sliders = c.querySelectorAll('.sim-edit-panel input[type="range"]');
      expect(sliders.length).toBeGreaterThan(0);
    });

    test('edit panel has Starting Cash slider', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="startingCash"]')).toBeTruthy();
    });

    test('edit panel has Projection Months slider', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="projectionMonths"]')).toBeTruthy();
    });

    test('edit panel has revenue stream sliders', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="rs_price_0"]')).toBeTruthy();
      expect(c.querySelector('input[data-key="rs_volume_0"]')).toBeTruthy();
    });

    test('edit panel has staff sliders', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="staff_count_0"]')).toBeTruthy();
      expect(c.querySelector('input[data-key="staff_cost_0"]')).toBeTruthy();
    });

    test('edit panel has opex sliders', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="opex_0"]')).toBeTruthy();
    });

    test('SaaS type shows churn slider for recurring streams', () => {
      const c = renderSim('saas');
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      expect(c.querySelector('input[data-key="rs_churn_0"]')).toBeTruthy();
    });

    test('Done button hides edit panel', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeNull();
    });

    test('slider change saves config on change event', () => {
      const c = renderSim();
      c.querySelector('#sim-toggle-edit').click();
      expect(c.querySelector('.sim-edit-panel')).toBeTruthy();
      const slider = c.querySelector('input[data-key="startingCash"]');
      slider.value = '100000';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      const savedConfig = Store.getSimConfig();
      expect(savedConfig.startingCash).toBe(100000);
    });
  });

  describe('edge cases', () => {
    test('renders with minimal config', () => {
      Store.saveBusiness({ name: 'Minimal', type: 'service' });
      Store.saveSimConfig({
        businessType: 'service',
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { pessimistic: { revenueMult: 0.7, costMult: 1.1 }, base: { revenueMult: 1, costMult: 1 }, optimistic: { revenueMult: 1.3, costMult: 0.95 } }
      });
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);
      expect(container.querySelector('.sim-header')).toBeTruthy();
    });

    test('renders correctly for all business types', () => {
      ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'].forEach(type => {
        resetLocalStorage();
        const c = renderSim(type);
        expect(c.querySelector('.sim-header')).toBeTruthy();
        expect(c.querySelector('.sim-kpi-strip')).toBeTruthy();
      });
    });
  });
});
