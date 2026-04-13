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

describe('Integration: Wizard → Simulation Config', () => {
  test('wizard financial data flows into simulation config', () => {
    var business = {
      type: 'restaurant',
      name: 'Test Cafe',
      revenueRange: '$5K - $20K',
      stage: 'validation'
    };
    Store.saveBusiness(business);

    var canvas = Store.getCanvas();
    canvas.revenueStreams.push({ id: 'r1', text: 'Dine-in revenue', notes: '' });
    canvas.revenueStreams.push({ id: 'r2', text: 'Takeaway orders', notes: '' });
    canvas.costStructure.push({ id: 'c1', text: 'Rent / lease', notes: '' });
    canvas.costStructure.push({ id: 'c2', text: 'Staff wages', notes: '' });
    Store.saveCanvas(canvas);

    var config = SimulationTypes.buildConfigFromWizard(business, canvas);
    Store.saveSimConfig(config);

    expect(config.businessType).toBe('restaurant');
    expect(config.startingCash).toBe(30000); // from $5K-$20K range
    expect(config.revenueStreams[0].name).toBe('Dine-in revenue');
    expect(config.revenueStreams[1].name).toBe('Takeaway orders');
    expect(config.opex[0].name).toBe('Rent / lease');

    // Run simulation with this config
    var result = SimEngine.run(config);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
  });

  test('wizard overrides customize simulation defaults', () => {
    var business = { type: 'service', name: 'Consulting LLC' };
    var canvas = { revenueStreams: [], costStructure: [] };
    var overrides = {
      startingCash: 50000,
      projectionMonths: 24
    };

    var config = SimulationTypes.buildConfigFromWizard(business, canvas, overrides);
    expect(config.startingCash).toBe(50000);
    expect(config.projectionMonths).toBe(24);

    var result = SimEngine.run(config);
    expect(result.months).toHaveLength(24);
    expect(result.months[0].cashBalance).toBe(50000 + result.months[0].netIncome);
  });

  test('pre-revenue business gets appropriate starting cash', () => {
    var business = { type: 'saas', name: 'My App', revenueRange: 'Pre-revenue' };
    var config = SimulationTypes.buildConfigFromWizard(business, { revenueStreams: [], costStructure: [] });
    expect(config.startingCash).toBe(5000);
  });

  test('high-revenue business gets appropriate starting cash', () => {
    var business = { type: 'ecommerce', name: 'Big Store', revenueRange: '$100K+' };
    var config = SimulationTypes.buildConfigFromWizard(business, { revenueStreams: [], costStructure: [] });
    expect(config.startingCash).toBe(200000);
  });
});

describe('Integration: Simulation → UI Rendering', () => {
  test('simulation results render correctly in UI', () => {
    Store.saveBusiness({ name: 'Render Test', type: 'retail', stage: 'growth' });
    var config = SimulationTypes.getDefaults('retail');
    Store.saveSimConfig(config);

    var container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Verify KPIs display real values
    var kpiValues = container.querySelectorAll('.sim-kpi-value');
    expect(kpiValues.length).toBe(6);

    // Verify cash chart renders with data
    var polylines = container.querySelectorAll('.sim-svg polyline');
    expect(polylines.length).toBe(3);

    // Verify P&L table has numeric values
    var plNums = container.querySelectorAll('.sim-pl-num');
    expect(plNums.length).toBeGreaterThan(0);
  });

  test('scenario switching changes displayed data', () => {
    Store.saveBusiness({ name: 'Scenario Test', type: 'service', stage: 'validation' });
    var container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Get base case revenue
    var baseResults = Store.getSimResults();
    var baseRevenue = baseResults.summary.year1Revenue;

    // Switch to optimistic
    var optBtn = container.querySelector('.sim-sc[data-scenario="optimistic"]');
    optBtn.click();

    var optResults = Store.getSimResults();
    var optRevenue = optResults.summary.year1Revenue;

    expect(optRevenue).toBeGreaterThan(baseRevenue);
  });

  test('scenario switching changes displayed data to pessimistic', () => {
    Store.saveBusiness({ name: 'Pessimistic Test', type: 'service', stage: 'validation' });
    var container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    var baseResults = Store.getSimResults();
    var baseRevenue = baseResults.summary.year1Revenue;

    var pessBtn = container.querySelector('.sim-sc[data-scenario="pessimistic"]');
    pessBtn.click();

    var pessResults = Store.getSimResults();
    var pessRevenue = pessResults.summary.year1Revenue;

    expect(pessRevenue).toBeLessThan(baseRevenue);
  });
});

describe('Integration: All Business Types End-to-End', () => {
  var types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

  types.forEach(function(type) {
    test(type + ': wizard data → config → simulation → UI', () => {
      // Set up business
      Store.saveBusiness({
        name: 'Test ' + type,
        type: type,
        stage: 'validation',
        revenueRange: '$5K - $20K',
        teamSize: '2-5'
      });

      // Build canvas with type-specific suggestions
      var segs = AI.getSuggestions(AI.SEGMENTS, type).slice(0, 2);
      var costs = AI.getSuggestions(AI.COSTS, type).slice(0, 3);
      var canvas = Store.getCanvas();
      segs.forEach(function(s) { canvas.customerSegments.push({ id: Store.uid(), text: s, notes: '' }); });
      costs.forEach(function(c) { canvas.costStructure.push({ id: Store.uid(), text: c, notes: '' }); });
      Store.saveCanvas(canvas);

      // Build config from wizard data
      var config = SimulationTypes.buildConfigFromWizard(Store.getBusiness(), canvas);
      Store.saveSimConfig(config);

      // Run simulation
      var result = SimEngine.run(config);
      expect(result.months).toHaveLength(36);
      expect(result.months[0].revenue).toBeGreaterThan(0);
      expect(result.years).toHaveLength(3);

      // Run scenarios
      var scenarios = SimEngine.runScenarios(config);
      expect(scenarios.pessimistic.summary.year1Revenue).toBeLessThan(scenarios.optimistic.summary.year1Revenue);

      // Render UI
      var container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      expect(container.querySelector('.sim-header')).toBeTruthy();
      expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
      expect(container.querySelector('.sim-pl-table')).toBeTruthy();
    });
  });
});

describe('Integration: Hypothesis Tracking with Simulation', () => {
  test('hypothesis progress reflects in tracker while simulation runs', () => {
    Store.saveBusiness({ name: 'Combined Test', type: 'service', stage: 'validation' });
    Store.setWizardComplete();

    // Add hypothesis
    var hyp = Store.addHypothesis({
      statement: 'Revenue will reach $5000/month',
      category: 'revenue',
      canvasElement: 'revenueStreams',
      status: 'testing',
      target: 5000,
      unit: '$/month',
      priority: 'critical'
    });

    // Log data points
    Store.addActual(hyp.id, { value: 1000, date: '2025-01-01' });
    Store.addActual(hyp.id, { value: 2500, date: '2025-02-01' });
    Store.addActual(hyp.id, { value: 4000, date: '2025-03-01' });

    // Render tracker
    var trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);

    var progress = trackerContainer.querySelector('.hyp-progress-pct');
    expect(progress).toBeTruthy();
    expect(progress.textContent).toBe('80%'); // 4000/5000

    // Also render simulation
    var simContainer = document.createElement('div');
    document.body.appendChild(simContainer);
    SimulationUI.render(simContainer);
    expect(simContainer.querySelector('.sim-header')).toBeTruthy();
  });
});

describe('Integration: Export/Import with Simulation Data', () => {
  test('exported data includes simulation config', () => {
    Store.saveBusiness({ name: 'Export Test', type: 'saas' });
    var config = SimulationTypes.getDefaults('saas');
    config.startingCash = 42000;
    Store.saveSimConfig(config);
    Store.setWizardComplete();

    var exported = JSON.parse(Store.exportAll());
    expect(exported.simConfig).toBeTruthy();
    expect(exported.simConfig.startingCash).toBe(42000);
    expect(exported.simConfig.businessType).toBe('saas');
  });

  test('imported simulation config renders correctly', () => {
    var config = SimulationTypes.getDefaults('restaurant');
    config.startingCash = 75000;

    var importData = {
      business: { name: 'Imported Biz', type: 'restaurant', stage: 'growth' },
      canvas: { customerSegments: [], valueProp: [], channels: [], customerRelationships: [], revenueStreams: [], keyResources: [], keyActivities: [], keyPartners: [], costStructure: [] },
      hypotheses: [],
      wizardComplete: true,
      simConfig: config
    };

    Store.importAll(JSON.stringify(importData));
    expect(Store.getSimConfig().startingCash).toBe(75000);

    var container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
  });
});

describe('Integration: Canvas Cost Matching', () => {
  test('canvas cost names are matched to default opex values', () => {
    var business = { type: 'restaurant' };
    var canvas = {
      revenueStreams: [],
      costStructure: [
        { id: 'c1', text: 'Rent', notes: '' },
        { id: 'c2', text: 'Marketing budget', notes: '' },
        { id: 'c3', text: 'Custom expense', notes: '' }
      ]
    };

    var config = SimulationTypes.buildConfigFromWizard(business, canvas);

    // 'Rent' should match 'Rent / Lease' default ($4000)
    var rentOpex = config.opex.find(function(o) { return o.name === 'Rent'; });
    expect(rentOpex).toBeTruthy();
    expect(rentOpex.monthly).toBe(4000);

    // 'Marketing budget' should match 'Marketing & advertising' default ($500)
    var mktOpex = config.opex.find(function(o) { return o.name === 'Marketing budget'; });
    expect(mktOpex).toBeTruthy();
    expect(mktOpex.monthly).toBe(500);

    // 'Custom expense' should use default fallback ($300)
    var customOpex = config.opex.find(function(o) { return o.name === 'Custom expense'; });
    expect(customOpex).toBeTruthy();
    expect(customOpex.monthly).toBe(300);
  });
});

describe('Integration: SimEngine Edge Cases', () => {
  test('zero growth rate produces flat revenue', () => {
    var config = {
      projectionMonths: 12,
      startingCash: 10000,
      revenueStreams: [{
        id: 'rs1', name: 'Flat', type: 'unit',
        unitPrice: 50, unitsPerMonth: 100, growthRate: 0,
        cogsPerUnit: 0, cogsPct: 0, churnRate: 0,
        seasonality: null
      }],
      staff: [], opex: [], capex: [],
      scenario: 'base',
      scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
    };

    var result = SimEngine.run(config);
    expect(result.months[0].revenue).toBe(result.months[11].revenue);
  });

  test('high churn with no growth leads to revenue decline', () => {
    var config = {
      projectionMonths: 12,
      startingCash: 10000,
      revenueStreams: [{
        id: 'rs1', name: 'Subs', type: 'recurring',
        unitPrice: 50, unitsPerMonth: 100, growthRate: 0,
        cogsPerUnit: 0, cogsPct: 0, churnRate: 15,
        seasonality: null
      }],
      staff: [], opex: [], capex: [],
      scenario: 'base',
      scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
    };

    var result = SimEngine.run(config);
    // With 15% monthly churn and no growth, revenue should decline significantly
    expect(result.months[11].revenue).toBeLessThan(result.months[0].revenue * 0.5);
  });

  test('staff hiring trigger increases headcount over time', () => {
    var config = {
      projectionMonths: 12,
      startingCash: 100000,
      revenueStreams: [],
      staff: [{ role: 'Engineer', count: 2, monthlyCost: 5000, hireEveryMonths: 3 }],
      opex: [], capex: [],
      scenario: 'base',
      scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
    };

    var result = SimEngine.run(config);
    // Month 0: 2 engineers, Month 3: 3, Month 6: 4, Month 9: 5
    expect(result.months[0].headcount).toBe(2);
    expect(result.months[3].headcount).toBe(3);
    expect(result.months[6].headcount).toBe(4);
    expect(result.months[11].headcount).toBe(5);
  });

  test('multiple capex events in different months', () => {
    var config = {
      projectionMonths: 12,
      startingCash: 100000,
      revenueStreams: [],
      staff: [],
      opex: [],
      capex: [
        { name: 'Equipment', amount: 20000, month: 0 },
        { name: 'Renovation', amount: 15000, month: 6 }
      ],
      scenario: 'base',
      scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
    };

    var result = SimEngine.run(config);
    expect(result.months[0].capex).toBe(20000);
    expect(result.months[5].capex).toBe(0);
    expect(result.months[6].capex).toBe(15000);
    expect(result.summary.totalCapex).toBe(35000);
  });

  test('combined COGS per unit and percentage', () => {
    var config = {
      projectionMonths: 6,
      startingCash: 0,
      revenueStreams: [{
        id: 'rs1', name: 'Test', type: 'unit',
        unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
        cogsPerUnit: 10, cogsPct: 20, churnRate: 0,
        seasonality: null
      }],
      staff: [], opex: [], capex: [],
      scenario: 'base',
      scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
    };

    var result = SimEngine.run(config);
    // COGS = 10 units * $10/unit + 20% of $1000 = $100 + $200 = $300
    expect(result.months[0].cogs).toBe(300);
  });

  test('annual rollup sums correctly', () => {
    var config = SimulationTypes.getDefaults('service');
    config.projectionMonths = 24;
    var result = SimEngine.run(config);

    // Year 1 rollup should sum months 0-11
    var year1 = result.years[0];
    var sumRevenue = 0;
    for (var i = 0; i < 12; i++) sumRevenue += result.months[i].revenue;
    expect(year1.revenue).toBe(Math.round(sumRevenue));
  });

  test('currency formatter handles edge cases', () => {
    expect(SimEngine.currency(0)).toBe('$0');
    expect(SimEngine.currency(-0)).toBe('$0');
    expect(SimEngine.currency(999)).toBe('$999');
    expect(SimEngine.currency(1000)).toBe('$1.0K');
    expect(SimEngine.currency(999999)).toBe('$1000.0K');
    expect(SimEngine.currency(1000000)).toBe('$1.0M');
    expect(SimEngine.currency(-500)).toBe('-$500');
    expect(SimEngine.currency(-1500)).toBe('-$1.5K');
  });

  test('pct formatter handles edge cases', () => {
    expect(SimEngine.pct(0)).toBe('0.0%');
    expect(SimEngine.pct(100)).toBe('100.0%');
    expect(SimEngine.pct(-5.5)).toBe('-5.5%');
    expect(SimEngine.pct(null)).toBe('0.0%');
    expect(SimEngine.pct(undefined)).toBe('0.0%');
  });
});

describe('Integration: Settings → Simulation Impact', () => {
  test('changing business stage does not break simulation', () => {
    Store.saveBusiness({ name: 'Stage Biz', type: 'service', stage: 'idea' });
    Store.setWizardComplete();

    // Render simulation
    var container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);
    expect(container.querySelector('.sim-header')).toBeTruthy();

    // Change stage
    var biz = Store.getBusiness();
    biz.stage = 'growth';
    Store.saveBusiness(biz);

    // Re-render simulation
    SimulationUI.render(container);
    expect(container.querySelector('.sim-header')).toBeTruthy();
  });
});

describe('Integration: Tracker addNew() bug fix verification', () => {
  test('addNew re-renders correctly via App.render', () => {
    Store.saveBusiness({ name: 'AddNew Test', type: 'service', stage: 'validation' });
    Store.setWizardComplete();

    // Render tracker through App
    window.location.hash = '#tracker';
    App.render();

    var app = document.getElementById('app');
    expect(app.querySelector('.main-nav')).toBeTruthy();
    expect(app.querySelector('.tracker-summary')).toBeTruthy();

    // Simulate addNew
    global.prompt
      .mockReturnValueOnce('New hypothesis test')
      .mockReturnValueOnce('Signups')
      .mockReturnValueOnce('100')
      .mockReturnValueOnce('users');
    Tracker.addNew();

    // Verify hypothesis was added
    var hyps = Store.getHypotheses();
    expect(hyps).toHaveLength(1);
    expect(hyps[0].statement).toBe('New hypothesis test');

    // Verify nav is still present (the bug was that it was overwritten)
    app = document.getElementById('app');
    expect(app.querySelector('.main-nav')).toBeTruthy();
  });
});
