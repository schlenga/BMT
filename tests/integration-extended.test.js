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

describe('Integration: Simulation Engine → Store → UI', () => {

  test('simulation config from wizard data produces valid projection', () => {
    const business = { type: 'restaurant', name: 'Cafe Test', revenueRange: '$5K - $20K' };
    const canvas = {
      revenueStreams: [{ id: 'r1', text: 'Dine-in sales' }],
      costStructure: [{ id: 'c1', text: 'Rent' }, { id: 'c2', text: 'Ingredients' }],
      customerSegments: [], valueProp: [], channels: [],
      customerRelationships: [], keyResources: [], keyActivities: [], keyPartners: []
    };
    const config = SimulationTypes.buildConfigFromWizard(business, canvas);
    const result = SimEngine.run(config);

    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
    expect(result.summary.year1Revenue).toBeGreaterThan(0);
    // Restaurant should have COGS
    expect(result.months[0].cogs).toBeGreaterThan(0);
  });

  test('saas simulation shows subscriber growth dynamics', () => {
    const config = SimulationTypes.getDefaults('saas');
    const result = SimEngine.run(config);

    // SaaS recurring revenue should grow over 36 months
    const month1Rev = result.months[0].revenue;
    const month36Rev = result.months[35].revenue;
    expect(month36Rev).toBeGreaterThan(month1Rev);

    // Should have subscriber data in stream breakdown
    const streams = result.months[0].revenueByStream;
    expect(streams.length).toBeGreaterThan(0);
    expect(streams[0].type).toBe('recurring');
  });

  test('three scenarios produce diverging cash trajectories', () => {
    const config = SimulationTypes.getDefaults('retail');
    const scenarios = SimEngine.runScenarios(config);

    const pessLast = scenarios.pessimistic.months[35].cashBalance;
    const baseLast = scenarios.base.months[35].cashBalance;
    const optLast = scenarios.optimistic.months[35].cashBalance;

    expect(optLast).toBeGreaterThan(baseLast);
    expect(baseLast).toBeGreaterThan(pessLast);
  });

  test('sim config saved from wizard loads correctly in SimulationUI', () => {
    // Simulate wizard completion
    Store.saveBusiness({ name: 'Full Flow', type: 'ecommerce', revenueRange: '$1K - $5K' });
    const canvas = Store.getCanvas();
    const config = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(), canvas
    );
    Store.saveSimConfig(config);
    Store.setWizardComplete();

    // Render simulation
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();

    // Verify KPIs are populated (not all zeros)
    const kpiValues = container.querySelectorAll('.sim-kpi-value');
    const nonEmpty = Array.from(kpiValues).filter(k => k.textContent !== '$0');
    expect(nonEmpty.length).toBeGreaterThan(0);
  });
});

describe('Integration: Canvas ↔ Tracker ↔ Prompts', () => {

  test('adding canvas item and hypothesis links them in UI', () => {
    Store.saveBusiness({ name: 'Link Test', type: 'service' });
    Store.addCanvasItem('customerSegments', 'Enterprise clients');
    Store.addHypothesis({
      statement: 'Enterprise clients will pay premium',
      category: 'customer',
      canvasElement: 'customerSegments',
      status: 'testing',
      target: 5,
      unit: 'clients',
      actuals: [],
      priority: 'critical'
    });

    // Canvas shows badge
    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    const badge = canvasContainer.querySelector('.bmc-hyp-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('1');

    // Tracker shows the hypothesis
    const trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);
    expect(trackerContainer.querySelector('.hyp-card')).toBeTruthy();
  });

  test('hypothesis lifecycle: testing → validated → prompts change', () => {
    Store.saveBusiness({ name: 'Lifecycle', type: 'service', stage: 'validation' });
    const hyp = Store.addHypothesis({
      statement: 'People want our service',
      category: 'value',
      canvasElement: 'valueProp',
      status: 'testing',
      target: 10,
      actuals: [],
      priority: 'critical',
      createdAt: new Date().toISOString().slice(0, 10)
    });

    // Testing phase — should get action prompts
    const testingPrompts = Prompts.generateSync(
      Store.getHypotheses(),
      Store.getBusiness(),
      Store.getToolPrefs(),
      Store.getPromptState()
    );
    const testingActions = testingPrompts.filter(p => p.hypId === hyp.id);
    expect(testingActions.length).toBeGreaterThan(0);

    // Validate the hypothesis
    Store.updateHypothesis(hyp.id, { status: 'validated' });
    const validatedPrompts = Prompts.generateSync(
      Store.getHypotheses(),
      Store.getBusiness(),
      Store.getToolPrefs(),
      Store.getPromptState()
    );
    const doubleDown = validatedPrompts.find(p => p.key === 'double-down-' + hyp.id);
    expect(doubleDown).toBeTruthy();
  });

  test('invalidated hypothesis generates pivot prompt', () => {
    Store.saveBusiness({ name: 'Pivot Test', type: 'service' });
    const hyp = Store.addHypothesis({
      statement: 'Wrong assumption',
      category: 'customer',
      canvasElement: 'customerSegments',
      status: 'invalidated',
      target: 50,
      actuals: [{ date: '2025-01-15', value: 2 }],
      priority: 'critical',
      createdAt: '2025-01-01'
    });

    const prompts = Prompts.generateSync(
      Store.getHypotheses(),
      Store.getBusiness(),
      Store.getToolPrefs(),
      Store.getPromptState()
    );
    const pivot = prompts.find(p => p.key === 'pivot-' + hyp.id);
    expect(pivot).toBeTruthy();
    expect(pivot.title).toContain('pivot');
  });
});

describe('Integration: App routing and navigation', () => {

  test('navigating through all pages works without errors', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Nav Test', type: 'service', stage: 'validation' });
    Store.addHypothesis({
      statement: 'Test', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    const routes = ['simulation', 'tracker', 'canvas', 'settings'];
    routes.forEach(route => {
      window.location.hash = '#' + route;
      expect(() => App.render()).not.toThrow();
    });
  });

  test('settings tool chip toggle persists preferences', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Tool Test' });
    window.location.hash = '#settings';
    App.render();

    const chips = document.querySelectorAll('.settings-tool-chips .wiz-chip');
    if (chips.length > 0) {
      const chip = chips[0];
      const cat = chip.dataset.cat;
      const tid = chip.dataset.val;

      chip.click();

      const prefs = Store.getToolPrefs();
      expect(prefs[cat]).toContain(tid);

      // Click again to deselect
      chip.click();
      const prefs2 = Store.getToolPrefs();
      expect(prefs2[cat]).not.toContain(tid);
    }
  });

  test('export produces valid JSON that can be reimported', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Export Test', type: 'saas', stage: 'growth' });
    Store.addCanvasItem('valueProp', 'Great product');
    Store.addHypothesis({ statement: 'Users want X', category: 'value', status: 'testing', actuals: [] });
    Store.saveSimConfig(SimulationTypes.getDefaults('saas'));

    const exported = Store.exportAll();
    const parsed = JSON.parse(exported);

    expect(parsed.business.name).toBe('Export Test');
    expect(parsed.canvas.valueProp).toHaveLength(1);
    expect(parsed.hypotheses).toHaveLength(1);
    expect(parsed.simConfig).toBeTruthy();
    expect(parsed.exportedAt).toBeTruthy();

    // Reset and reimport
    Store.resetAll();
    expect(Store.getBusiness()).toBeNull();

    const result = Store.importAll(exported);
    expect(result).toBe(true);
    expect(Store.getBusiness().name).toBe('Export Test');
    expect(Store.getSimConfig()).toBeTruthy();
  });

  test('reset clears sim config and results', () => {
    Store.saveBusiness({ name: 'Reset Test', type: 'service' });
    Store.saveSimConfig({ businessType: 'test' });
    Store.saveSimResults({ months: [] });

    Store.resetAll();

    expect(Store.getSimConfig()).toBeNull();
    expect(Store.getSimResults()).toBeNull();
  });
});

describe('Integration: Full onboarding to dashboard flow', () => {

  test('end-to-end: wizard data → config → simulation → display', () => {
    // Step 1: Simulate completed wizard data
    const wizardData = {
      name: 'Artisan Bakery',
      type: 'restaurant',
      description: 'A cozy neighborhood bakery',
      proudOf: 'Homemade sourdough bread',
      segments: ['Local residents', 'Food enthusiasts', 'Office workers nearby'],
      revenueRange: '$5K - $20K',
      costs: ['Rent / lease', 'Staff wages', 'Ingredients & supplies'],
      teamSize: '2-5',
      goal: 'Grow revenue',
      concern: 'Rising ingredient costs'
    };

    // Step 2: Save business and canvas
    Store.saveBusiness({
      id: Store.uid(),
      name: wizardData.name,
      type: wizardData.type,
      description: wizardData.description,
      proudOf: wizardData.proudOf,
      goal: wizardData.goal,
      concern: wizardData.concern,
      revenueRange: wizardData.revenueRange,
      teamSize: wizardData.teamSize,
      createdAt: '2025-01-01',
      stage: 'validation'
    });

    const canvas = AI.buildCanvas(wizardData);
    Store.saveCanvas(canvas);

    // Step 3: Generate and save hypotheses
    const hyps = AI.keywordFallbackHypotheses(wizardData);
    hyps.forEach(h => Store.addHypothesis(h));

    // Step 4: Build and save simulation config
    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      canvas,
      { startingCash: 25000 }
    );
    Store.saveSimConfig(simConfig);
    Store.setWizardComplete();

    // Step 5: Verify everything is connected

    // Canvas has populated data
    const savedCanvas = Store.getCanvas();
    expect(savedCanvas.customerSegments.length).toBeGreaterThanOrEqual(3);
    expect(savedCanvas.valueProp.length).toBeGreaterThanOrEqual(1);
    expect(savedCanvas.costStructure.length).toBeGreaterThanOrEqual(3);

    // Hypotheses exist and have correct structure
    const savedHyps = Store.getHypotheses();
    expect(savedHyps.length).toBeGreaterThanOrEqual(3);
    savedHyps.forEach(h => {
      expect(h.id).toBeTruthy();
      expect(h.statement).toBeTruthy();
      expect(h.status).toBe('testing');
    });

    // Sim config is valid
    const savedConfig = Store.getSimConfig();
    expect(savedConfig.startingCash).toBe(25000);
    expect(savedConfig.businessType).toBe('restaurant');

    // Step 6: Run simulation and verify results
    const result = SimEngine.run(savedConfig);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
    expect(result.summary.year1Revenue).toBeGreaterThan(0);

    // Step 7: Render all views without error
    const simContainer = document.createElement('div');
    document.body.appendChild(simContainer);
    expect(() => SimulationUI.render(simContainer)).not.toThrow();
    expect(simContainer.querySelector('.sim-kpi-strip')).toBeTruthy();

    const canvasContainer = document.createElement('div');
    expect(() => Canvas.render(canvasContainer)).not.toThrow();
    expect(canvasContainer.querySelector('.bmc-grid')).toBeTruthy();

    const trackerContainer = document.createElement('div');
    expect(() => Tracker.render(trackerContainer)).not.toThrow();
    const cards = trackerContainer.querySelectorAll('.hyp-card');
    expect(cards.length).toBe(savedHyps.length);

    // Step 8: Action prompts generated
    const prompts = Prompts.generateSync(
      savedHyps, Store.getBusiness(), Store.getToolPrefs(), Store.getPromptState()
    );
    expect(prompts.length).toBeGreaterThan(0);
  });
});
