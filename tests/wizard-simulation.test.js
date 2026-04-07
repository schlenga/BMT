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

// ── Wizard → Simulation Integration ──

describe('Integration: Wizard finish builds simulation config', () => {
  function setupCompleteBusiness(overrides) {
    const biz = Object.assign({
      id: Store.uid(),
      name: 'Test Bakery',
      type: 'restaurant',
      description: 'A neighborhood bakery',
      proudOf: 'Sourdough bread',
      goal: 'Grow revenue',
      concern: 'Rising flour costs',
      revenueRange: '$5K - $20K',
      teamSize: '2-5',
      createdAt: '2025-01-01',
      stage: 'validation'
    }, overrides || {});

    Store.saveBusiness(biz);
    return biz;
  }

  test('wizard finish populates sim config in store', () => {
    const biz = setupCompleteBusiness();
    const canvas = AI.buildCanvas({
      name: biz.name,
      type: biz.type,
      proudOf: biz.proudOf,
      segments: ['Locals', 'Office workers'],
      costs: ['Rent', 'Staff'],
      revenueRange: biz.revenueRange,
      teamSize: biz.teamSize
    });
    Store.saveCanvas(canvas);

    // Build sim config the way wizard.finish() does
    const simConfig = SimulationTypes.buildConfigFromWizard(biz, canvas);
    Store.saveSimConfig(simConfig);

    const saved = Store.getSimConfig();
    expect(saved).toBeTruthy();
    expect(saved.businessType).toBe('restaurant');
    expect(saved.startingCash).toBe(30000); // $5K-$20K range
    expect(saved.revenueStreams.length).toBeGreaterThan(0);
  });

  test('wizard financial overrides flow to simulation', () => {
    const biz = setupCompleteBusiness({ type: 'saas' });
    const canvas = Store.getCanvas();

    // Simulate user entering financial details
    const simOverrides = {
      startingCash: 75000,
      revenueStreams: SimulationTypes.getDefaults('saas').revenueStreams.map((rs, i) => {
        const s = JSON.parse(JSON.stringify(rs));
        if (i === 0) {
          s.unitPrice = 49;
          s.unitsPerMonth = 200;
        }
        return s;
      })
    };

    const simConfig = SimulationTypes.buildConfigFromWizard(biz, canvas, simOverrides);
    Store.saveSimConfig(simConfig);

    const saved = Store.getSimConfig();
    expect(saved.startingCash).toBe(75000);
    expect(saved.revenueStreams[0].unitPrice).toBe(49);
    expect(saved.revenueStreams[0].unitsPerMonth).toBe(200);
  });

  test('sim config runs correctly through SimEngine', () => {
    const biz = setupCompleteBusiness();
    const canvas = Store.getCanvas();
    const simConfig = SimulationTypes.buildConfigFromWizard(biz, canvas);

    const result = SimEngine.run(simConfig);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary.year1Revenue).toBe('number');
  });

  test('full wizard → simulation UI rendering pipeline', () => {
    setupCompleteBusiness();
    Store.setWizardComplete();

    // Navigate to simulation
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
    expect(app.querySelector('.sim-kpi-strip')).toBeTruthy();
    expect(app.querySelector('.sim-scenarios')).toBeTruthy();

    // KPIs should have values
    const kpis = app.querySelectorAll('.sim-kpi-value');
    expect(kpis.length).toBeGreaterThanOrEqual(4);
  });

  test('each business type produces a valid simulation after wizard setup', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      resetLocalStorage();
      setupDOM();

      setupCompleteBusiness({ type: type, name: 'Test ' + type });
      Store.setWizardComplete();

      window.location.hash = '#simulation';
      App.render();

      const app = document.getElementById('app');
      expect(app.querySelector('.sim-header')).toBeTruthy();
      expect(app.querySelector('.sim-kpi-strip')).toBeTruthy();

      // Verify results were saved
      const results = Store.getSimResults();
      expect(results).toBeTruthy();
      expect(results.months.length).toBeGreaterThan(0);
      expect(results.months[0].revenue).toBeGreaterThan(0);
    });
  });
});

// ── App routing with simulation ──

describe('App routing with simulation', () => {
  beforeEach(() => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Route Test', type: 'service' });
  });

  test('default route is simulation when wizard complete', () => {
    window.location.hash = '';
    App.render();
    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
  });

  test('#simulation renders simulation page', () => {
    window.location.hash = '#simulation';
    App.render();
    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
  });

  test('#tracker renders tracker page', () => {
    window.location.hash = '#tracker';
    App.render();
    const app = document.getElementById('app');
    expect(app.querySelector('.tracker-header')).toBeTruthy();
  });

  test('#canvas renders canvas page', () => {
    window.location.hash = '#canvas';
    App.render();
    const app = document.getElementById('app');
    expect(app.querySelector('.bmc-grid')).toBeTruthy();
  });

  test('nav shows Projection link when wizard complete', () => {
    window.location.hash = '#simulation';
    App.render();
    const nav = document.querySelector('.main-nav');
    const links = Array.from(nav.querySelectorAll('.nav-link')).map(l => l.textContent);
    expect(links).toContain('Projection');
  });

  test('Projection link is active on simulation page', () => {
    window.location.hash = '#simulation';
    App.render();
    const nav = document.querySelector('.main-nav');
    const activeLink = nav.querySelector('.nav-link.active');
    expect(activeLink.textContent).toBe('Projection');
  });

  test('nav brand links to simulation page', () => {
    window.location.hash = '#tracker';
    App.render();
    const brand = document.querySelector('.nav-brand');
    expect(brand).toBeTruthy();
    expect(brand.getAttribute('onclick')).toContain('#simulation');
  });

  test('nav hides Projection link when wizard incomplete', () => {
    resetLocalStorage();
    window.location.hash = '#settings';
    App.render();
    const nav = document.querySelector('.main-nav');
    const links = Array.from(nav.querySelectorAll('.nav-link')).map(l => l.textContent);
    expect(links).not.toContain('Projection');
  });
});

// ── Store simulation data in export/import ──

describe('Simulation data persistence', () => {
  test('sim config survives export → reset → import cycle', () => {
    Store.saveBusiness({ name: 'Export Test', type: 'saas' });
    const config = SimulationTypes.getDefaults('saas');
    config.startingCash = 77777;
    Store.saveSimConfig(config);
    Store.setWizardComplete();

    const exported = Store.exportAll();
    Store.resetAll();

    expect(Store.getSimConfig()).toBeNull();

    Store.importAll(exported);
    const restored = Store.getSimConfig();
    expect(restored).toBeTruthy();
    expect(restored.startingCash).toBe(77777);
    expect(restored.businessType).toBe('saas');
  });

  test('resetAll clears sim config and results', () => {
    Store.saveSimConfig({ test: true });
    Store.saveSimResults({ months: [] });
    Store.resetAll();

    expect(Store.getSimConfig()).toBeNull();
    expect(Store.getSimResults()).toBeNull();
  });
});

// ── Wizard with financials card ──

describe('Wizard financials integration', () => {
  test('SimulationTypes provides smart defaults per business type', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      const tmpl = SimulationTypes.getTemplate(type);
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
      expect(tmpl.revenueStreams[0].unitPrice).toBeGreaterThan(0);
      expect(tmpl.revenueStreams[0].unitsPerMonth).toBeGreaterThan(0);
      expect(tmpl.startingCash).toBeGreaterThan(0);
    });
  });

  test('KPI labels used in financials card match simulation type', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      const labels = SimulationTypes.getKpiLabels(type);
      expect(labels.units).toBeTruthy();
      expect(typeof labels.units).toBe('string');
      expect(labels.units.length).toBeGreaterThan(0);
    });
  });

  test('wizard data with no financial details uses type defaults', () => {
    const biz = { type: 'restaurant', name: 'Pizza Place' };
    const config = SimulationTypes.buildConfigFromWizard(biz, null);

    // Should use restaurant defaults
    const tmpl = SimulationTypes.getTemplate('restaurant');
    expect(config.startingCash).toBe(tmpl.startingCash);
    expect(config.revenueStreams).toHaveLength(tmpl.revenueStreams.length);
  });

  test('wizard data with partial financial details merges with defaults', () => {
    const biz = { type: 'saas', name: 'SaaS App' };
    const config = SimulationTypes.buildConfigFromWizard(biz, null, {
      startingCash: 50000
    });

    expect(config.startingCash).toBe(50000);
    // Other fields should come from defaults
    expect(config.staff.length).toBeGreaterThan(0);
    expect(config.opex.length).toBeGreaterThan(0);
  });
});

// ── Wizard onboarding data persistence ──

describe('Wizard onboarding data persistence', () => {
  test('saves and restores onboarding progress', () => {
    const data = {
      stage: 'workspace',
      cardStage: 'B',
      confirmed: { identity: true, customers: true, economics: false, financials: false, ambition: false },
      data: { name: 'My Biz', type: 'service', segments: ['Students'] }
    };

    Store.saveOnboardingData(data);
    const restored = Store.getOnboardingData();
    expect(restored.stage).toBe('workspace');
    expect(restored.cardStage).toBe('B');
    expect(restored.confirmed.identity).toBe(true);
    expect(restored.data.name).toBe('My Biz');
  });

  test('clearOnboardingData removes saved progress', () => {
    Store.saveOnboardingData({ stage: 'workspace' });
    Store.clearOnboardingData();
    expect(Store.getOnboardingData()).toBeNull();
  });
});
