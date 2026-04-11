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
  Wizard.reset();
});

// ── Wizard financials card & sim config integration ──

describe('Wizard financials card', () => {
  function setupWizardWithBusinessData() {
    // Simulate wizard data by directly storing business info
    Store.saveBusiness({
      id: Store.uid(),
      name: 'Test Bakery',
      type: 'restaurant',
      description: 'A local bakery',
      proudOf: 'Fresh bread daily',
      goal: 'Grow revenue',
      concern: 'Rising costs',
      revenueRange: '$5K - $20K',
      teamSize: '2-5',
      createdAt: '2025-01-01',
      stage: 'validation'
    });
    Store.setWizardComplete();
  }

  test('SimulationTypes.buildConfigFromWizard produces valid config from wizard data', () => {
    const business = { type: 'restaurant', name: 'Test Bakery', revenueRange: '$5K - $20K' };
    const canvas = {
      customerSegments: [{ id: 'cs1', text: 'Local residents' }],
      valueProp: [{ id: 'vp1', text: 'Fresh bread daily' }],
      revenueStreams: [{ id: 'rs1', text: 'Bread sales' }, { id: 'rs2', text: 'Coffee' }],
      costStructure: [{ id: 'cc1', text: 'Rent' }, { id: 'cc2', text: 'Ingredients' }],
      channels: [], customerRelationships: [], keyResources: [], keyActivities: [], keyPartners: []
    };

    const config = SimulationTypes.buildConfigFromWizard(business, canvas);

    expect(config.businessType).toBe('restaurant');
    expect(config.businessName).toBe('Test Bakery');
    expect(config.startingCash).toBe(30000); // $5K-$20K maps to 30000
    expect(config.revenueStreams).toHaveLength(2);
    expect(config.revenueStreams[0].name).toBe('Bread sales');
    expect(config.revenueStreams[1].name).toBe('Coffee');
    expect(config.opex).toHaveLength(2);
  });

  test('wizard financial overrides flow into sim config', () => {
    const business = { type: 'saas', name: 'TestApp' };
    const canvas = { revenueStreams: [], costStructure: [] };
    const overrides = {
      startingCash: 50000,
      revenueStreams: [{
        id: 'rs1', name: 'Plans', type: 'recurring',
        unitPrice: 99, unitsPerMonth: 200, growthRate: 10,
        churnRate: 3, cogsPerUnit: 5, cogsPct: 0
      }]
    };

    const config = SimulationTypes.buildConfigFromWizard(business, canvas, overrides);
    expect(config.startingCash).toBe(50000);
    expect(config.revenueStreams).toHaveLength(1);
    expect(config.revenueStreams[0].unitPrice).toBe(99);
    expect(config.revenueStreams[0].unitsPerMonth).toBe(200);
  });

  test('zero starting cash is preserved (bug fix verification)', () => {
    const business = { type: 'service' };
    const config = SimulationTypes.buildConfigFromWizard(business, null, { startingCash: 0 });
    expect(config.startingCash).toBe(0);

    // Verify the simulation runs correctly with zero starting cash
    const result = SimEngine.run(config);
    expect(result.months[0].cashBalance).toBeDefined();
    expect(typeof result.months[0].cashBalance).toBe('number');
  });
});

// ── Wizard → Simulation → Store flow ──

describe('Wizard → Simulation full flow', () => {
  test('completing wizard creates valid sim config in store', () => {
    // Simulate what wizard.finish() does
    const wizardData = {
      name: 'Flow Test Cafe',
      type: 'restaurant',
      description: 'A cafe',
      proudOf: 'Great coffee',
      segments: ['Office workers', 'Students'],
      revenueRange: '$5K - $20K',
      costs: ['Rent / lease', 'Staff wages'],
      teamSize: '2-5',
      goal: 'Grow revenue',
      concern: 'Competition'
    };

    // Store business
    Store.saveBusiness({
      id: Store.uid(),
      name: wizardData.name,
      type: wizardData.type,
      description: wizardData.description,
      revenueRange: wizardData.revenueRange,
      teamSize: wizardData.teamSize,
      stage: 'validation',
      createdAt: '2025-01-01'
    });

    // Build and save canvas
    const canvas = AI.buildCanvas(wizardData);
    Store.saveCanvas(canvas);

    // Build sim config (mirrors wizard.finish() logic)
    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      canvas
    );
    Store.saveSimConfig(simConfig);
    Store.setWizardComplete();

    // Verify sim config
    const savedConfig = Store.getSimConfig();
    expect(savedConfig).toBeTruthy();
    expect(savedConfig.businessType).toBe('restaurant');
    expect(savedConfig.startingCash).toBe(30000);
    expect(savedConfig.revenueStreams.length).toBeGreaterThan(0);
    expect(savedConfig.opex.length).toBeGreaterThan(0);

    // Verify the simulation can run with this config
    const result = SimEngine.run(savedConfig);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
  });

  test('wizard financial details override defaults in sim config', () => {
    Store.saveBusiness({
      id: Store.uid(),
      name: 'Override Test',
      type: 'service',
      revenueRange: '$1K - $5K',
      stage: 'idea',
      createdAt: '2025-01-01'
    });

    const canvas = Store.getCanvas();
    const tmpl = SimulationTypes.getDefaults('service');
    const baseStreams = tmpl.revenueStreams;
    const overrideStreams = baseStreams.map((rs, i) => {
      const s = JSON.parse(JSON.stringify(rs));
      if (i === 0) {
        s.unitPrice = 150;
        s.unitsPerMonth = 80;
      }
      return s;
    });

    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      canvas,
      { startingCash: 25000, revenueStreams: overrideStreams }
    );
    Store.saveSimConfig(simConfig);

    const saved = Store.getSimConfig();
    expect(saved.startingCash).toBe(25000);
    expect(saved.revenueStreams[0].unitPrice).toBe(150);
    expect(saved.revenueStreams[0].unitsPerMonth).toBe(80);
  });

  test('simulation renders correctly after wizard flow', () => {
    Store.saveBusiness({ name: 'Render Test', type: 'ecommerce', stage: 'validation' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Should render without errors
    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();

    // Config should be auto-created
    const config = Store.getSimConfig();
    expect(config.businessType).toBe('ecommerce');

    container.remove();
  });
});

// ── Export/Import with simulation data ──

describe('Export/Import with simulation data', () => {
  test('export includes sim config', () => {
    Store.saveBusiness({ name: 'Export Test', type: 'saas' });
    const config = SimulationTypes.getDefaults('saas');
    config.startingCash = 77777;
    Store.saveSimConfig(config);

    const exported = JSON.parse(Store.exportAll());
    expect(exported.simConfig).toBeTruthy();
    expect(exported.simConfig.startingCash).toBe(77777);
    expect(exported.simConfig.businessType).toBe('saas');
  });

  test('import restores sim config and simulation works', () => {
    const config = SimulationTypes.getDefaults('retail');
    config.startingCash = 42000;

    const data = {
      business: { name: 'Import Sim', type: 'retail', stage: 'growth' },
      canvas: Store.getCanvas(),
      hypotheses: [],
      wizardComplete: true,
      simConfig: config
    };

    Store.importAll(JSON.stringify(data));

    const restored = Store.getSimConfig();
    expect(restored).toBeTruthy();
    expect(restored.startingCash).toBe(42000);
    expect(restored.businessType).toBe('retail');

    // Verify simulation runs with restored config
    const result = SimEngine.run(restored);
    expect(result.months).toHaveLength(36);
  });

  test('export without sim config does not break import', () => {
    const data = {
      business: { name: 'No Sim', type: 'service' },
      wizardComplete: true
    };

    expect(Store.importAll(JSON.stringify(data))).toBe(true);
    expect(Store.getSimConfig()).toBeNull();
  });
});

// ── App routing with simulation ──

describe('App routing with simulation', () => {
  test('default route is simulation when wizard is complete', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Route Test', type: 'service' });
    window.location.hash = '';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
  });

  test('simulation nav link is active on simulation route', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Nav Test', type: 'service' });
    window.location.hash = '#simulation';
    App.render();

    const activeLink = document.querySelector('.nav-link.active');
    expect(activeLink).toBeTruthy();
    expect(activeLink.textContent).toBe('Projection');
  });

  test('brand click navigates to simulation (post-merge fix)', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Brand Test', type: 'service' });
    window.location.hash = '#simulation';
    App.render();

    const brand = document.querySelector('.nav-brand');
    expect(brand).toBeTruthy();
    expect(brand.getAttribute('onclick')).toContain('#simulation');
  });

  test('nav shows Projection link when wizard complete', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Nav Test', type: 'service' });
    App.render();

    const links = document.querySelectorAll('.nav-link');
    const linkTexts = Array.from(links).map(l => l.textContent);
    expect(linkTexts).toContain('Projection');
    expect(linkTexts).toContain('Tracker');
    expect(linkTexts).toContain('Canvas');
    expect(linkTexts).toContain('Settings');
  });
});

// ── Escaped output verification (XSS fix) ──

describe('XSS prevention in tracker', () => {
  test('hypothesis target values are HTML-escaped in tracker', () => {
    Store.addHypothesis({
      statement: 'Test hypothesis',
      category: 'value',
      canvasElement: 'valueProp',
      status: 'testing',
      target: 100,
      unit: 'users',
      priority: 'critical',
      actuals: [{ date: '2025-01-01', value: 50, note: 'test' }]
    });

    const container = document.createElement('div');
    Tracker.render(container);

    // Values should be rendered as text, not raw
    const metricVal = container.querySelector('.hyp-metric-val');
    expect(metricVal).toBeTruthy();
    expect(metricVal.innerHTML).toContain('50');
    expect(metricVal.innerHTML).toContain('100');
  });

  test('hypothesis target with HTML characters is escaped', () => {
    Store.addHypothesis({
      statement: 'Test <script>alert(1)</script>',
      category: 'value',
      canvasElement: 'valueProp',
      status: 'testing',
      target: 42,
      unit: '<img src=x>',
      priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    // The statement should be escaped
    const statement = container.querySelector('.hyp-statement');
    expect(statement.innerHTML).not.toContain('<script>');
    expect(statement.innerHTML).toContain('&lt;script&gt;');

    // Unit should be escaped
    const metric = container.querySelector('.hyp-metric');
    expect(metric.innerHTML).not.toContain('<img');
    expect(metric.innerHTML).toContain('&lt;img');
  });
});
