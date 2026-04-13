const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

describe('SimulationUI', () => {
  function setupBusiness(type) {
    type = type || 'service';
    Store.saveBusiness({ name: 'Test Biz', type: type, stage: 'validation' });
  }

  function renderUI() {
    var container = document.createElement('div');
    document.body.appendChild(container);
    setupBusiness();
    SimulationUI.render(container);
    return container;
  }

  describe('render()', () => {
    test('auto-creates sim config when none exists', () => {
      expect(Store.getSimConfig()).toBeNull();
      var container = renderUI();
      expect(Store.getSimConfig()).toBeTruthy();
      expect(Store.getSimConfig().businessType).toBe('service');
    });

    test('uses existing sim config when available', () => {
      setupBusiness('restaurant');
      var config = SimulationTypes.getDefaults('restaurant');
      config.startingCash = 77777;
      Store.saveSimConfig(config);

      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      var savedConfig = Store.getSimConfig();
      expect(savedConfig.startingCash).toBe(77777);
    });

    test('saves simulation results to store', () => {
      expect(Store.getSimResults()).toBeNull();
      var container = renderUI();
      var results = Store.getSimResults();
      expect(results).toBeTruthy();
      expect(results.months).toBeTruthy();
      expect(results.months.length).toBeGreaterThan(0);
    });

    test('renders all major sections', () => {
      var container = renderUI();
      expect(container.querySelector('.sim-header')).toBeTruthy();
      expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
      expect(container.querySelector('.sim-scenarios')).toBeTruthy();
      expect(container.querySelectorAll('.sim-section').length).toBeGreaterThanOrEqual(3);
    });

    test('renders SVG charts', () => {
      var container = renderUI();
      var svgs = container.querySelectorAll('.sim-svg');
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('KPI strip', () => {
    test('renders 6 KPI cards', () => {
      var container = renderUI();
      var kpis = container.querySelectorAll('.sim-kpi');
      expect(kpis).toHaveLength(6);
    });

    test('KPI cards contain labels and values', () => {
      var container = renderUI();
      var kpis = container.querySelectorAll('.sim-kpi');
      kpis.forEach(function(kpi) {
        expect(kpi.querySelector('.sim-kpi-label')).toBeTruthy();
        expect(kpi.querySelector('.sim-kpi-value')).toBeTruthy();
      });
    });

    test('KPI labels include expected metrics', () => {
      var container = renderUI();
      var labels = container.querySelectorAll('.sim-kpi-label');
      var labelTexts = Array.from(labels).map(function(l) { return l.textContent; });
      expect(labelTexts).toContain('Break-even');
      expect(labelTexts).toContain('Y1 Revenue');
      expect(labelTexts).toContain('Gross Margin');
    });
  });

  describe('scenario toggle', () => {
    test('renders three scenario options', () => {
      var container = renderUI();
      var scenarios = container.querySelectorAll('.sim-sc');
      expect(scenarios).toHaveLength(3);
    });

    test('base scenario is active by default', () => {
      var container = renderUI();
      var active = container.querySelector('.sim-sc.active');
      expect(active).toBeTruthy();
      expect(active.textContent).toBe('Base Case');
    });

    test('scenario labels are Pessimistic, Base Case, Optimistic', () => {
      var container = renderUI();
      var scenarios = container.querySelectorAll('.sim-sc');
      var texts = Array.from(scenarios).map(function(s) { return s.textContent; });
      expect(texts).toContain('Pessimistic');
      expect(texts).toContain('Base Case');
      expect(texts).toContain('Optimistic');
    });

    test('clicking scenario changes active state', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);

      var pessimistic = container.querySelector('.sim-sc[data-scenario="pessimistic"]');
      expect(pessimistic).toBeTruthy();
      pessimistic.click();

      var newActive = container.querySelector('.sim-sc.active');
      expect(newActive).toBeTruthy();
      expect(newActive.textContent).toBe('Pessimistic');
    });
  });

  describe('P&L table', () => {
    test('renders P&L table with quarterly columns', () => {
      var container = renderUI();
      var table = container.querySelector('.sim-pl-table');
      expect(table).toBeTruthy();
    });

    test('P&L table has Revenue row', () => {
      var container = renderUI();
      var table = container.querySelector('.sim-pl-table');
      expect(table.textContent).toContain('Revenue');
    });

    test('P&L table has COGS row', () => {
      var container = renderUI();
      var table = container.querySelector('.sim-pl-table');
      expect(table.textContent).toContain('COGS');
    });

    test('P&L table has Net Income row', () => {
      var container = renderUI();
      var table = container.querySelector('.sim-pl-table');
      expect(table.textContent).toContain('Net Income');
    });

    test('P&L table has Cash Balance row', () => {
      var container = renderUI();
      var table = container.querySelector('.sim-pl-table');
      expect(table.textContent).toContain('Cash Balance');
    });
  });

  describe('revenue stream breakdown', () => {
    test('renders stream breakdown table for multi-stream business', () => {
      Store.saveBusiness({ name: 'Restaurant', type: 'restaurant', stage: 'validation' });
      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      var tables = container.querySelectorAll('.sim-pl-table');
      // Should have P&L table + stream breakdown table
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });

    test('stream breakdown shows stream names', () => {
      Store.saveBusiness({ name: 'Restaurant', type: 'restaurant', stage: 'validation' });
      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      expect(container.textContent).toContain('Dine-in');
      expect(container.textContent).toContain('Takeaway');
    });

    test('stream breakdown shows type badges', () => {
      Store.saveBusiness({ name: 'Restaurant', type: 'restaurant', stage: 'validation' });
      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      var badges = container.querySelectorAll('.sim-type-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('edit mode', () => {
    // editMode is a closure variable inside SimulationUI that persists between tests.
    // Each test must ensure the edit panel is visible by clicking until it appears.
    function ensureEditMode(container) {
      if (!container.querySelector('.sim-edit-panel')) {
        container.querySelector('#sim-toggle-edit').click();
      }
      if (!container.querySelector('.sim-edit-panel')) {
        // If still not there, click again (was toggled off by a previous test)
        container.querySelector('#sim-toggle-edit').click();
      }
    }

    function ensureNoEditMode(container) {
      if (container.querySelector('.sim-edit-panel')) {
        container.querySelector('#sim-toggle-edit').click();
      }
    }

    test('clicking edit button toggles edit panel on and off', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);

      ensureNoEditMode(container);
      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();

      var editBtn = container.querySelector('#sim-toggle-edit');
      editBtn.click();

      expect(container.querySelector('.sim-edit-panel')).toBeTruthy();
      var doneBtn = container.querySelector('#sim-toggle-edit');
      expect(doneBtn.textContent).toBe('Done');

      // Toggle off
      doneBtn.click();
      expect(container.querySelector('.sim-edit-panel')).toBeFalsy();
    });

    test('edit panel contains starting cash slider', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);
      ensureEditMode(container);

      var cashSlider = container.querySelector('[data-key="startingCash"]');
      expect(cashSlider).toBeTruthy();
      expect(cashSlider.type).toBe('range');
    });

    test('edit panel contains projection months slider', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);
      ensureEditMode(container);

      var monthsSlider = container.querySelector('[data-key="projectionMonths"]');
      expect(monthsSlider).toBeTruthy();
    });

    test('edit panel contains revenue stream sliders', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);
      ensureEditMode(container);

      var priceSlider = container.querySelector('[data-key="rs_price_0"]');
      var volumeSlider = container.querySelector('[data-key="rs_volume_0"]');
      var growthSlider = container.querySelector('[data-key="rs_growth_0"]');
      expect(priceSlider).toBeTruthy();
      expect(volumeSlider).toBeTruthy();
      expect(growthSlider).toBeTruthy();
    });

    test('edit panel contains staff sliders', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);
      ensureEditMode(container);

      var staffCount = container.querySelector('[data-key="staff_count_0"]');
      var staffCost = container.querySelector('[data-key="staff_cost_0"]');
      expect(staffCount).toBeTruthy();
      expect(staffCost).toBeTruthy();
    });

    test('edit panel contains opex sliders', () => {
      var container = document.createElement('div');
      document.body.appendChild(container);
      setupBusiness();
      SimulationUI.render(container);
      ensureEditMode(container);

      var opexSlider = container.querySelector('[data-key="opex_0"]');
      expect(opexSlider).toBeTruthy();
    });

    test('SaaS edit panel shows churn slider for recurring streams', () => {
      Store.saveBusiness({ name: 'SaaS App', type: 'saas', stage: 'validation' });
      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);
      ensureEditMode(container);

      var churnSlider = container.querySelector('[data-key="rs_churn_0"]');
      expect(churnSlider).toBeTruthy();
    });
  });

  describe('cash flow chart', () => {
    test('renders SVG with scenario lines', () => {
      var container = renderUI();
      var svg = container.querySelector('.sim-svg');
      expect(svg).toBeTruthy();
      var polylines = svg.querySelectorAll('polyline');
      // Should have 3 scenario lines (pessimistic, base, optimistic)
      expect(polylines.length).toBe(3);
    });

    test('renders endpoint circle for base case', () => {
      var container = renderUI();
      var svg = container.querySelector('.sim-svg');
      var circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(1);
    });

    test('renders month labels', () => {
      var container = renderUI();
      var svg = container.querySelector('.sim-svg');
      var texts = svg.querySelectorAll('text');
      var textContents = Array.from(texts).map(function(t) { return t.textContent; });
      var hasMonthLabel = textContents.some(function(t) { return t.match(/^M\d+$/); });
      expect(hasMonthLabel).toBe(true);
    });
  });

  describe('revenue vs costs chart', () => {
    test('renders revenue and cost bars', () => {
      var container = renderUI();
      var svgs = container.querySelectorAll('.sim-svg');
      // Second SVG is the revenue chart
      expect(svgs.length).toBeGreaterThanOrEqual(2);
      var revChart = svgs[1];
      var rects = revChart.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  describe('rendering with different business types', () => {
    var types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(function(type) {
      test(type + ' type renders without errors', () => {
        Store.saveBusiness({ name: 'Test ' + type, type: type, stage: 'validation' });
        var container = document.createElement('div');
        document.body.appendChild(container);
        SimulationUI.render(container);

        expect(container.querySelector('.sim-header')).toBeTruthy();
        expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
        expect(container.querySelector('.sim-pl-table')).toBeTruthy();
      });
    });
  });

  describe('rendering with canvas data', () => {
    test('uses canvas revenue stream names in simulation', () => {
      Store.saveBusiness({ name: 'Canvas Biz', type: 'service', stage: 'validation' });
      Store.saveCanvas({
        customerSegments: [],
        valueProp: [],
        channels: [],
        customerRelationships: [],
        revenueStreams: [{ id: 'r1', text: 'Premium Consulting', notes: '' }],
        keyResources: [],
        keyActivities: [],
        keyPartners: [],
        costStructure: [{ id: 'c1', text: 'Office rent', notes: '' }]
      });

      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      expect(container.textContent).toContain('Premium Consulting');
    });
  });
});
