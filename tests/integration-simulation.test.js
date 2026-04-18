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

describe('Integration: Wizard → Simulation Config → SimEngine', () => {
  test('wizard data flows into simulation config via buildConfigFromWizard', () => {
    const wizardData = {
      name: 'Test Coffee Shop',
      type: 'restaurant',
      description: 'A cozy coffee shop',
      proudOf: 'Best espresso in town',
      segments: ['Office workers nearby'],
      revenueRange: '$5K - $20K',
      costs: ['Rent / lease', 'Ingredients & supplies'],
      teamSize: '2-5',
      goal: 'Grow revenue',
      concern: 'Competition',
      websiteData: null
    };

    // Simulate what wizard.finish() does
    Store.saveBusiness({
      id: Store.uid(),
      name: wizardData.name,
      type: wizardData.type,
      description: wizardData.description,
      revenueRange: wizardData.revenueRange,
      teamSize: wizardData.teamSize,
      createdAt: '2025-01-01',
      stage: 'validation'
    });

    const canvas = AI.buildCanvas(wizardData);
    Store.saveCanvas(canvas);

    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      canvas
    );
    Store.saveSimConfig(simConfig);

    expect(simConfig.businessType).toBe('restaurant');
    expect(simConfig.startingCash).toBe(30000); // from $5K-$20K range

    // Run simulation and verify it produces valid results
    const result = SimEngine.run(simConfig);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
  });

  test('wizard financials override defaults in simulation config', () => {
    Store.saveBusiness({ type: 'saas', name: 'SaaS Co' });
    const canvas = Store.getCanvas();

    const overrides = {
      startingCash: 75000,
      revenueStreams: [{
        id: 'rs1', name: 'Custom Plan', type: 'recurring',
        unitPrice: 99, unitsPerMonth: 200,
        growthRate: 10, churnRate: 3,
        cogsPerUnit: 5, cogsPct: 0
      }]
    };

    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(), canvas, overrides
    );

    expect(simConfig.startingCash).toBe(75000);
    expect(simConfig.revenueStreams[0].name).toBe('Custom Plan');
    expect(simConfig.revenueStreams[0].unitPrice).toBe(99);
    expect(simConfig.revenueStreams[0].unitsPerMonth).toBe(200);

    const result = SimEngine.run(simConfig);
    expect(result.months[0].revenue).toBe(99 * 200);
  });

  test('simulation config renders correctly in SimulationUI', () => {
    Store.saveBusiness({ name: 'UI Flow Test', type: 'retail' });
    const config = SimulationTypes.getDefaults('retail');
    config.startingCash = 45000;
    Store.saveSimConfig(config);

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();

    // Verify results were saved
    const results = Store.getSimResults();
    expect(results).toBeTruthy();
    expect(results.months).toHaveLength(36);
  });
});

describe('Integration: Scenario comparison', () => {
  test('three scenarios produce different results for same config', () => {
    Store.saveBusiness({ type: 'restaurant', name: 'Test' });
    const config = SimulationTypes.getDefaults('restaurant');
    const scenarios = SimEngine.runScenarios(config);

    const pessY1 = scenarios.pessimistic.summary.year1Revenue;
    const baseY1 = scenarios.base.summary.year1Revenue;
    const optY1 = scenarios.optimistic.summary.year1Revenue;

    expect(pessY1).toBeLessThan(baseY1);
    expect(baseY1).toBeLessThan(optY1);
  });

  test('scenario switching in UI updates displayed data', () => {
    Store.saveBusiness({ name: 'Scenario Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Get base case KPI values
    const baseKpis = Array.from(container.querySelectorAll('.sim-kpi-value')).map(v => v.textContent);

    // Switch to pessimistic
    const pessTab = container.querySelector('.sim-sc[data-scenario="pessimistic"]');
    pessTab.click();

    const pessKpis = Array.from(container.querySelectorAll('.sim-kpi-value')).map(v => v.textContent);

    // At least one KPI should be different between scenarios
    expect(pessKpis).not.toEqual(baseKpis);
  });
});

describe('Integration: Export/Import with simulation data', () => {
  test('export includes simulation config and results', () => {
    Store.saveBusiness({ name: 'Export Test', type: 'service' });
    const config = SimulationTypes.getDefaults('service');
    Store.saveSimConfig(config);

    const result = SimEngine.run(config);
    Store.saveSimResults(result);

    const exported = JSON.parse(Store.exportAll());
    expect(exported.simConfig).toBeTruthy();
    expect(exported.simConfig.businessType).toBe('service');
    expect(exported.simResults).toBeTruthy();
    expect(exported.simResults.months).toHaveLength(36);
  });

  test('import restores simulation state fully', () => {
    Store.saveBusiness({ name: 'Import Test', type: 'saas' });
    const config = SimulationTypes.getDefaults('saas');
    config.startingCash = 77777;
    Store.saveSimConfig(config);
    Store.saveSimResults(SimEngine.run(config));

    const exported = Store.exportAll();
    Store.resetAll();

    expect(Store.getSimConfig()).toBeNull();
    expect(Store.getSimResults()).toBeNull();

    Store.importAll(exported);

    expect(Store.getSimConfig().startingCash).toBe(77777);
    expect(Store.getSimResults().months).toHaveLength(36);
  });
});

describe('Integration: Canvas → Simulation linkage', () => {
  test('canvas cost structure maps to simulation opex', () => {
    Store.saveBusiness({ type: 'retail', name: 'Canvas Test' });
    Store.addCanvasItem('costStructure', 'Marketing');
    Store.addCanvasItem('costStructure', 'Warehouse rent');
    Store.addCanvasItem('costStructure', 'Insurance');

    const canvas = Store.getCanvas();
    const config = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(), canvas
    );

    expect(config.opex).toHaveLength(3);
    expect(config.opex.map(o => o.name)).toEqual(['Marketing', 'Warehouse rent', 'Insurance']);
    // Each should have a monthly amount
    config.opex.forEach(o => expect(o.monthly).toBeGreaterThan(0));
  });

  test('canvas revenue streams map to simulation revenue', () => {
    Store.saveBusiness({ type: 'service', name: 'Revenue Test' });
    Store.addCanvasItem('revenueStreams', 'Consulting fees');
    Store.addCanvasItem('revenueStreams', 'Workshop revenue');

    const canvas = Store.getCanvas();
    const config = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(), canvas
    );

    expect(config.revenueStreams[0].name).toBe('Consulting fees');
    expect(config.revenueStreams[1].name).toBe('Workshop revenue');
  });
});

describe('Integration: Full App routing with simulation', () => {
  test('navigating to simulation route renders dashboard', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Route Test', type: 'service' });
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
    expect(app.querySelector('.main-nav')).toBeTruthy();

    // Nav should show Projection as active
    const links = Array.from(app.querySelectorAll('.nav-link'));
    const activeLink = links.find(l => l.classList.contains('active'));
    expect(activeLink.textContent).toBe('Projection');
  });

  test('simulation page renders after completing wizard flow', () => {
    // Simulate full wizard completion
    const wizData = {
      name: 'Full Flow Biz',
      type: 'ecommerce',
      description: 'Online store',
      proudOf: 'Great products',
      segments: ['Online bargain hunters'],
      revenueRange: '$1K - $5K',
      costs: ['Inventory', 'Shipping & fulfillment'],
      teamSize: 'Just me',
      goal: 'Grow revenue',
      concern: 'Marketing costs',
      websiteData: null
    };

    Store.saveBusiness({
      id: Store.uid(),
      name: wizData.name,
      type: wizData.type,
      description: wizData.description,
      revenueRange: wizData.revenueRange,
      teamSize: wizData.teamSize,
      createdAt: '2025-01-01',
      stage: 'idea'
    });

    const canvas = AI.buildCanvas(wizData);
    Store.saveCanvas(canvas);

    const hyps = AI.keywordFallbackHypotheses(wizData);
    hyps.forEach(h => Store.addHypothesis(h));

    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(), canvas
    );
    Store.saveSimConfig(simConfig);
    Store.setWizardComplete();

    // Navigate to simulation
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
    expect(app.querySelectorAll('.sim-kpi')).toHaveLength(6);

    // Navigate to tracker - should show hypotheses
    window.location.hash = '#tracker';
    App.render();
    expect(app.querySelectorAll('.hyp-card').length).toBe(hyps.length);

    // Navigate to canvas - should show data
    window.location.hash = '#canvas';
    App.render();
    expect(app.querySelector('.bmc-grid')).toBeTruthy();
  });
});

describe('Integration: Business type affects simulation defaults', () => {
  const typeChecks = {
    restaurant: { minRevenue: 30000, hasSeasonality: true },
    saas: { hasChurn: true },
    ecommerce: { hasSeasonality: true }
  };

  Object.entries(typeChecks).forEach(([type, checks]) => {
    test(`${type} defaults produce type-appropriate simulation`, () => {
      const config = SimulationTypes.getDefaults(type);
      const result = SimEngine.run(config);

      expect(result.months[0].revenue).toBeGreaterThan(0);

      if (checks.hasSeasonality) {
        const revenues = result.months.slice(0, 12).map(m => m.revenue);
        const hasVariation = Math.max(...revenues) / Math.min(...revenues) > 1.1;
        expect(hasVariation).toBe(true);
      }

      if (checks.hasChurn) {
        const streams = config.revenueStreams.filter(s => s.type === 'recurring');
        expect(streams.length).toBeGreaterThan(0);
        streams.forEach(s => expect(s.churnRate).toBeGreaterThan(0));
      }
    });
  });
});
