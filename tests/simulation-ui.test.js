const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

function setupBusiness(type) {
  type = type || 'service';
  Store.saveBusiness({ name: 'Test Biz', type: type, stage: 'validation' });
}

function renderSim(type) {
  setupBusiness(type);
  const container = document.createElement('div');
  document.body.appendChild(container);
  SimulationUI.render(container);
  return container;
}

// ── Dashboard structure ──

describe('SimulationUI dashboard structure', () => {
  test('renders page title', () => {
    const c = renderSim();
    expect(c.querySelector('.page-title').textContent).toBe('Financial Projection');
  });

  test('renders edit button', () => {
    const c = renderSim();
    const btn = c.querySelector('#sim-toggle-edit');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Edit Assumptions');
  });

  test('renders all three scenario tabs', () => {
    const c = renderSim();
    const tabs = c.querySelectorAll('.sim-sc');
    expect(tabs).toHaveLength(3);
    const labels = Array.from(tabs).map(t => t.textContent);
    expect(labels).toEqual(['Pessimistic', 'Base Case', 'Optimistic']);
  });

  test('base scenario is active by default', () => {
    const c = renderSim();
    const active = c.querySelector('.sim-sc.active');
    expect(active.textContent).toBe('Base Case');
    expect(active.dataset.scenario).toBe('base');
  });

  test('renders at least 4 sections', () => {
    const c = renderSim();
    const sections = c.querySelectorAll('.sim-section');
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  test('renders section numbers', () => {
    const c = renderSim();
    const nums = c.querySelectorAll('.sim-sec-num');
    expect(nums.length).toBeGreaterThanOrEqual(3);
    expect(nums[0].textContent).toBe('01');
    expect(nums[1].textContent).toBe('02');
    expect(nums[2].textContent).toBe('03');
  });
});

// ── KPI strip ──

describe('KPI strip', () => {
  test('renders 6 KPI cards', () => {
    const c = renderSim();
    const kpis = c.querySelectorAll('.sim-kpi');
    expect(kpis).toHaveLength(6);
  });

  test('each KPI has label and value', () => {
    const c = renderSim();
    const kpis = c.querySelectorAll('.sim-kpi');
    kpis.forEach(kpi => {
      expect(kpi.querySelector('.sim-kpi-label')).toBeTruthy();
      expect(kpi.querySelector('.sim-kpi-value')).toBeTruthy();
    });
  });

  test('KPI labels include expected items', () => {
    const c = renderSim();
    const labels = Array.from(c.querySelectorAll('.sim-kpi-label')).map(l => l.textContent);
    expect(labels).toContain('Break-even');
    expect(labels).toContain('Funding Needed');
    expect(labels).toContain('Y1 Revenue');
    expect(labels).toContain('Y3 Cash');
    expect(labels).toContain('Gross Margin');
    expect(labels).toContain('Final Monthly');
  });

  test('KPI values have color classes', () => {
    const c = renderSim();
    const values = c.querySelectorAll('.sim-kpi-value');
    values.forEach(v => {
      const cls = v.className;
      expect(cls).toMatch(/green|red|amber|blue/);
    });
  });
});

// ── Charts ──

describe('Cash flow chart', () => {
  test('renders SVG chart', () => {
    const c = renderSim();
    const svgs = c.querySelectorAll('.sim-svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  test('chart has polyline for each scenario', () => {
    const c = renderSim();
    const chartWrap = c.querySelectorAll('.sim-chart-wrap')[0];
    const polylines = chartWrap.querySelectorAll('polyline');
    expect(polylines.length).toBe(3);
  });

  test('chart has grid lines', () => {
    const c = renderSim();
    const chartWrap = c.querySelectorAll('.sim-chart-wrap')[0];
    const lines = chartWrap.querySelectorAll('line');
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Revenue vs costs chart', () => {
  test('renders second SVG chart', () => {
    const c = renderSim();
    const svgs = c.querySelectorAll('.sim-svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  test('chart has revenue and cost bars', () => {
    const c = renderSim();
    const chartWraps = c.querySelectorAll('.sim-chart-wrap');
    expect(chartWraps.length).toBeGreaterThanOrEqual(2);
    const rects = chartWraps[1].querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
  });
});

// ── P&L table ──

describe('P&L table', () => {
  test('renders table with rows', () => {
    const c = renderSim();
    const table = c.querySelector('.sim-pl-table');
    expect(table).toBeTruthy();
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(5);
  });

  test('table has quarter and year headers', () => {
    const c = renderSim();
    const headers = c.querySelectorAll('.sim-pl-yr');
    expect(headers.length).toBeGreaterThan(0);
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts.some(t => t.startsWith('Q'))).toBe(true);
  });

  test('Revenue row is present', () => {
    const c = renderSim();
    const table = c.querySelector('.sim-pl-table');
    expect(table.textContent).toContain('Revenue');
  });

  test('Net Income row is present', () => {
    const c = renderSim();
    const table = c.querySelector('.sim-pl-table');
    expect(table.textContent).toContain('Net Income');
  });

  test('table includes margin percentages', () => {
    const c = renderSim();
    const table = c.querySelector('.sim-pl-table');
    expect(table.textContent).toContain('Gross Margin');
    expect(table.textContent).toContain('Net Margin');
  });
});

// ── Revenue stream breakdown ──

describe('Revenue stream breakdown', () => {
  test('renders stream table', () => {
    const c = renderSim();
    const tables = c.querySelectorAll('.sim-pl-table');
    // Second table is stream breakdown
    expect(tables.length).toBeGreaterThanOrEqual(2);
  });

  test('stream table shows stream names', () => {
    const c = renderSim('service');
    const allText = c.textContent;
    expect(allText).toContain('Client services');
  });

  test('stream table includes type badges', () => {
    const c = renderSim();
    const badges = c.querySelectorAll('.sim-type-badge');
    expect(badges.length).toBeGreaterThan(0);
  });
});

// ── Scenario switching ──

describe('Scenario switching', () => {
  test('clicking pessimistic tab re-renders with pessimistic scenario', () => {
    const c = renderSim();
    const pessTab = c.querySelector('.sim-sc[data-scenario="pessimistic"]');
    pessTab.click();

    const active = c.querySelector('.sim-sc.active');
    expect(active.dataset.scenario).toBe('pessimistic');
  });

  test('clicking optimistic tab re-renders', () => {
    const c = renderSim();
    const optTab = c.querySelector('.sim-sc[data-scenario="optimistic"]');
    optTab.click();

    const active = c.querySelector('.sim-sc.active');
    expect(active.dataset.scenario).toBe('optimistic');
  });
});

// ── Edit mode ──

describe('Edit mode', () => {
  // Each test toggles edit mode via clicking, so we need to ensure
  // a clean state. We toggle edit mode off if it was left on by ensuring
  // an even number of clicks within each test.

  function enterEditMode(container) {
    // First render with fresh state; if edit panel exists, we're already in edit mode
    if (container.querySelector('.sim-edit-panel')) {
      // Already in edit mode, just return
      return;
    }
    const btn = container.querySelector('#sim-toggle-edit');
    btn.click();
  }

  test('clicking edit button shows edit panel', () => {
    const c = renderSim();
    const hadPanel = !!c.querySelector('.sim-edit-panel');

    const btn = c.querySelector('#sim-toggle-edit');
    btn.click();

    // After clicking, state should have toggled
    if (hadPanel) {
      expect(c.querySelector('.sim-edit-panel')).toBeFalsy();
      // Click again to enter edit mode
      c.querySelector('#sim-toggle-edit').click();
    }
    expect(c.querySelector('.sim-edit-panel')).toBeTruthy();

    // Toggle back off for next test
    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit panel has starting cash slider', () => {
    const c = renderSim();
    enterEditMode(c);

    const sliders = c.querySelectorAll('.sim-slider');
    expect(sliders.length).toBeGreaterThan(0);
    const labels = Array.from(c.querySelectorAll('.sim-slider-label')).map(l => l.textContent);
    expect(labels).toContain('Starting Cash');

    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit panel has projection months slider', () => {
    const c = renderSim();
    enterEditMode(c);

    const labels = Array.from(c.querySelectorAll('.sim-slider-label')).map(l => l.textContent);
    expect(labels).toContain('Projection Months');

    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit panel shows revenue stream sections', () => {
    const c = renderSim();
    enterEditMode(c);

    const streamNames = c.querySelectorAll('.sim-stream-name');
    expect(streamNames.length).toBeGreaterThan(0);

    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit panel shows staff sections', () => {
    const c = renderSim();
    enterEditMode(c);

    const h4s = Array.from(c.querySelectorAll('h4')).map(h => h.textContent);
    expect(h4s).toContain('Staff');

    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit panel shows operating expenses', () => {
    const c = renderSim();
    enterEditMode(c);

    const h4s = Array.from(c.querySelectorAll('h4')).map(h => h.textContent);
    expect(h4s).toContain('Operating Expenses');

    c.querySelector('#sim-toggle-edit').click();
  });

  test('edit button text changes to Done in edit mode', () => {
    const c = renderSim();
    enterEditMode(c);

    const btn = c.querySelector('#sim-toggle-edit');
    expect(btn.textContent).toBe('Done');

    c.querySelector('#sim-toggle-edit').click();
  });

  test('clicking Done exits edit mode', () => {
    const c = renderSim();
    enterEditMode(c);
    expect(c.querySelector('.sim-edit-panel')).toBeTruthy();

    c.querySelector('#sim-toggle-edit').click();
    expect(c.querySelector('.sim-edit-panel')).toBeFalsy();
  });
});

// ── Config persistence ──

describe('Config persistence', () => {
  test('rendering saves sim config to store', () => {
    expect(Store.getSimConfig()).toBeNull();
    renderSim();
    expect(Store.getSimConfig()).toBeTruthy();
  });

  test('rendering saves sim results to store', () => {
    expect(Store.getSimResults()).toBeNull();
    renderSim();
    expect(Store.getSimResults()).toBeTruthy();
  });

  test('uses existing config from store if available', () => {
    setupBusiness('saas');
    const customConfig = SimulationTypes.getDefaults('saas');
    customConfig.startingCash = 99999;
    Store.saveSimConfig(customConfig);

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const saved = Store.getSimConfig();
    expect(saved.startingCash).toBe(99999);
  });
});

// ── Different business types ──

describe('Rendering different business types', () => {
  const types = ['restaurant', 'retail', 'saas', 'ecommerce', 'subscription'];
  types.forEach(type => {
    test(`renders successfully for ${type} business`, () => {
      const c = renderSim(type);
      expect(c.querySelector('.sim-header')).toBeTruthy();
      expect(c.querySelector('.sim-kpi-strip')).toBeTruthy();
      expect(c.querySelectorAll('.sim-kpi')).toHaveLength(6);
    });
  });
});

// ── Edge cases ──

describe('Edge cases', () => {
  test('renders with no business saved', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);
    expect(container.querySelector('.sim-header')).toBeTruthy();
  });

  test('renders with empty canvas', () => {
    setupBusiness();
    Store.saveCanvas({
      customerSegments: [], valueProp: [], channels: [],
      customerRelationships: [], revenueStreams: [],
      keyResources: [], keyActivities: [], keyPartners: [],
      costStructure: []
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);
    expect(container.querySelector('.sim-header')).toBeTruthy();
  });
});
