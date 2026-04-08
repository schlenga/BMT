const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);
  global.fetch = jest.fn().mockRejectedValue(new Error('no network'));

  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
});

describe('Integration: Simulation flow', () => {
  test('wizard financial inputs flow through to simulation config', () => {
    // Simulate what finish() does in wizard
    const business = {
      id: Store.uid(),
      name: 'Integration Cafe',
      type: 'restaurant',
      description: 'A test cafe',
      revenueRange: '$5K - $20K',
      teamSize: '2-5',
      stage: 'validation',
      createdAt: '2025-01-01'
    };
    Store.saveBusiness(business);

    const canvas = AI.buildCanvas({
      segments: ['Students'],
      costs: ['Rent'],
      revenueRange: '$5K - $20K'
    });
    Store.saveCanvas(canvas);

    // Build sim config with user overrides
    const simConfig = SimulationTypes.buildConfigFromWizard(
      business, canvas,
      { startingCash: 50000 }
    );
    Store.saveSimConfig(simConfig);
    Store.setWizardComplete();

    // Render simulation
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Verify it rendered
    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();

    // Verify config was used
    const savedConfig = Store.getSimConfig();
    expect(savedConfig.startingCash).toBe(50000);
    expect(savedConfig.businessType).toBe('restaurant');
  });

  test('simulation results are persisted to store', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const results = Store.getSimResults();
    expect(results).toBeTruthy();
    expect(results.months).toBeTruthy();
    expect(results.months.length).toBeGreaterThan(0);
  });

  test('changing scenario updates simulation results', () => {
    Store.saveBusiness({ name: 'Test', type: 'saas' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const baseResults = Store.getSimResults();
    const baseRevenue = baseResults.summary.year1Revenue;

    // Switch to pessimistic
    container.querySelector('[data-scenario="pessimistic"]').click();

    const pessResults = Store.getSimResults();
    expect(pessResults.summary.year1Revenue).toBeLessThan(baseRevenue);
  });

  test('edit assumptions flow updates live simulation', () => {
    Store.saveBusiness({ name: 'Edit Test', type: 'service' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const initialRevenue = Store.getSimResults().summary.year1Revenue;

    // Open edit panel and increase price
    container.querySelector('#sim-toggle-edit').click();

    const priceSlider = container.querySelector('[data-key="rs_price_0"]');
    priceSlider.value = '500';
    priceSlider.dispatchEvent(new Event('input'));
    priceSlider.dispatchEvent(new Event('change'));

    // Revenue should have increased
    const updatedRevenue = Store.getSimResults().summary.year1Revenue;
    expect(updatedRevenue).toBeGreaterThan(initialRevenue);
  });

  test('simulation config included in export/import cycle', () => {
    Store.saveBusiness({ name: 'Export Sim', type: 'retail' });
    Store.setWizardComplete();

    const config = SimulationTypes.getDefaults('retail');
    config.startingCash = 77777;
    Store.saveSimConfig(config);

    const exported = Store.exportAll();
    Store.resetAll();

    Store.importAll(exported);
    const imported = Store.getSimConfig();
    expect(imported.startingCash).toBe(77777);
    expect(imported.businessType).toBe('retail');
  });

  test('all business types can render simulation without errors', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      resetLocalStorage();
      Store.saveBusiness({ name: type + ' biz', type: type });
      Store.setWizardComplete();

      const container = document.createElement('div');
      document.body.appendChild(container);
      expect(() => SimulationUI.render(container)).not.toThrow();
      expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();

      const results = Store.getSimResults();
      expect(results.months.length).toBeGreaterThan(0);
      expect(results.months[0].revenue).toBeGreaterThan(0);
    });
  });

  test('SaaS simulation shows churn impact on subscriber counts', () => {
    Store.saveBusiness({ name: 'SaaS Co', type: 'saas' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const results = Store.getSimResults();
    // SaaS defaults have churn, so check that revenue is not strictly linear
    const m0Rev = results.months[0].revenue;
    const m11Rev = results.months[11].revenue;
    // With growth > churn, revenue should still increase
    expect(m11Rev).toBeGreaterThan(m0Rev);
  });

  test('restaurant simulation includes seasonality effects', () => {
    Store.saveBusiness({ name: 'Ristorante', type: 'restaurant' });
    Store.setWizardComplete();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const results = Store.getSimResults();
    // Restaurant has seasonality - revenue shouldn't be perfectly flat
    const revenues = results.months.slice(0, 12).map(m => m.revenue);
    const allSame = revenues.every(r => r === revenues[0]);
    expect(allSame).toBe(false);
  });

  test('tracker addNew uses App.render (bug regression)', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Render Test', type: 'service', stage: 'validation' });
    window.location.hash = '#tracker';
    App.render();

    global.prompt
      .mockReturnValueOnce('Test hyp')
      .mockReturnValueOnce('Count')
      .mockReturnValueOnce('10')
      .mockReturnValueOnce('items');

    Tracker.addNew();

    // After addNew, the app should have a nav bar (not just tracker content)
    const app = document.getElementById('app');
    expect(app.querySelector('.main-nav')).toBeTruthy();
    expect(app.querySelector('.hyp-card')).toBeTruthy();
  });

  test('app routing: simulation is default after wizard complete', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Route Test', type: 'service' });
    window.location.hash = '';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
  });

  test('app routing: wizard shows when not complete', () => {
    window.location.hash = '';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.ob-entrance') || app.querySelector('.ob-workspace')).toBeTruthy();
  });
});
