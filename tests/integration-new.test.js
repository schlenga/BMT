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

describe('Bug fix: Export/Import with theme and terminology', () => {
  test('exportAll includes theme data', () => {
    Store.saveTheme({ accent: '#3498db', bg: '#fafafa' });
    const exported = JSON.parse(Store.exportAll());
    expect(exported.theme).toEqual({ accent: '#3498db', bg: '#fafafa' });
  });

  test('exportAll includes terminology data', () => {
    Store.saveTerminology({ businessType: 'restaurant', labels: { customerSegments: 'Guests' } });
    const exported = JSON.parse(Store.exportAll());
    expect(exported.terminology).toEqual({ businessType: 'restaurant', labels: { customerSegments: 'Guests' } });
  });

  test('importAll restores theme', () => {
    const data = { theme: { accent: '#e74c3c', bg: '#fff' } };
    Store.importAll(JSON.stringify(data));
    expect(Store.getTheme()).toEqual({ accent: '#e74c3c', bg: '#fff' });
  });

  test('importAll restores terminology', () => {
    const data = { terminology: { businessType: 'saas', labels: { customerSegments: 'Users' } } };
    Store.importAll(JSON.stringify(data));
    expect(Store.getTerminology()).toEqual({ businessType: 'saas', labels: { customerSegments: 'Users' } });
  });

  test('full roundtrip: save theme+terminology, export, reset, import, verify', () => {
    Store.saveBusiness({ name: 'Theme Test', type: 'restaurant' });
    Store.saveTheme({ accent: '#ff6600', accentLight: '#ffe0cc' });
    Store.saveTerminology({ businessType: 'restaurant', labels: { customerSegments: 'Guests' } });
    Store.setWizardComplete();

    const exported = Store.exportAll();
    Store.resetAll();

    expect(Store.getTheme()).toBeNull();
    expect(Store.getTerminology()).toBeNull();

    Store.importAll(exported);

    expect(Store.getTheme()).toEqual({ accent: '#ff6600', accentLight: '#ffe0cc' });
    expect(Store.getTerminology()).toEqual({ businessType: 'restaurant', labels: { customerSegments: 'Guests' } });
    expect(Store.getBusiness().name).toBe('Theme Test');
  });

  test('import without theme/terminology does not crash (backwards compat)', () => {
    const oldFormatExport = JSON.stringify({
      business: { name: 'Old Export' },
      canvas: Store.getCanvas(),
      hypotheses: [],
      wizardComplete: true,
      toolPrefs: {},
      promptState: { completed: [], dismissed: [] },
      simConfig: null
    });

    const result = Store.importAll(oldFormatExport);
    expect(result).toBe(true);
    expect(Store.getBusiness().name).toBe('Old Export');
    expect(Store.getTheme()).toBeNull();
    expect(Store.getTerminology()).toBeNull();
  });
});

describe('Bug fix: Tracker.addNew() uses correct container', () => {
  test('addNew creates hypothesis and triggers App.render', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test', type: 'service' });
    window.location.hash = '#tracker';

    global.prompt
      .mockReturnValueOnce('Test assumption')
      .mockReturnValueOnce('Metric')
      .mockReturnValueOnce('100')
      .mockReturnValueOnce('units');

    Tracker.addNew();

    const hyps = Store.getHypotheses();
    expect(hyps).toHaveLength(1);
    expect(hyps[0].statement).toBe('Test assumption');

    const app = document.getElementById('app');
    expect(app.querySelector('.main-nav')).toBeTruthy();
  });
});

describe('Bug fix: Wizard tryResume applies theme correctly', () => {
  test('resume with brand colors applies theme via CSS vars', () => {
    const palette = AI.generatePalette('#2ecc71');
    AI.applyTheme(palette);

    Store.saveOnboardingData({
      stage: 'workspace',
      cardStage: 'A',
      confirmed: { identity: false, customers: false, economics: false, financials: false, ambition: false },
      data: {
        websiteUrl: '', websiteData: null,
        brandColors: { primary: '#2ecc71', secondary: null },
        greeting: '', name: 'Green Biz', type: 'service', description: '',
        proudOf: '', segments: [], revenueRange: '', costs: [],
        teamSize: '', goal: '', concern: '', toolPrefs: {},
        aiHypotheses: [], selectedHypIds: null,
        startingCash: '', avgPrice: '', monthlyVolume: ''
      }
    });

    document.documentElement.style.removeProperty('--accent');

    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);

    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#2ecc71');
  });
});

describe('Simulation ↔ Store ↔ UI flow', () => {
  test('build config from wizard data, run simulation, render UI', () => {
    Store.saveBusiness({ name: 'Sim Test', type: 'restaurant', revenueRange: '$5K - $20K' });
    Store.saveCanvas({
      customerSegments: [{ id: '1', text: 'Diners', notes: '' }],
      valueProp: [{ id: '2', text: 'Great food', notes: '' }],
      channels: [], customerRelationships: [], revenueStreams: [],
      keyResources: [], keyActivities: [], keyPartners: [],
      costStructure: [{ id: '3', text: 'Rent', notes: '' }]
    });

    const config = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      Store.getCanvas()
    );
    Store.saveSimConfig(config);

    const result = SimEngine.run(config);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].revenue).toBeGreaterThan(0);
    Store.saveSimResults(result);

    Store.setWizardComplete();
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
  });

  test('different scenarios produce different results', () => {
    const config = SimulationTypes.getDefaults('saas');
    config.projectionMonths = 12;
    const scenarios = SimEngine.runScenarios(config);

    expect(scenarios.pessimistic.summary.year1Revenue)
      .toBeLessThan(scenarios.base.summary.year1Revenue);
    expect(scenarios.optimistic.summary.year1Revenue)
      .toBeGreaterThan(scenarios.base.summary.year1Revenue);
  });

  test('wizard financial overrides flow into simulation', () => {
    const business = { type: 'service', name: 'Override Test' };
    const canvas = { revenueStreams: [], costStructure: [] };
    const config = SimulationTypes.buildConfigFromWizard(business, canvas, {
      startingCash: 50000
    });

    expect(config.startingCash).toBe(50000);
    const result = SimEngine.run(config);
    expect(result.months[0].cashBalance).toBeDefined();
  });
});

describe('Prompts ↔ Tracker integration', () => {
  test('tool preferences appear in generated prompts', () => {
    Store.saveBusiness({ name: 'Tool Test', stage: 'validation', type: 'service' });
    Store.saveToolPrefs({ payments: ['stripe'] });

    const hyps = [{
      id: 'rev-1', status: 'testing', category: 'revenue',
      statement: 'Clients will pay', createdAt: new Date().toISOString().slice(0, 10),
      actuals: [], target: 5000, unit: '$/month', priority: 'critical'
    }];

    const prompts = Prompts.generateSync(hyps, Store.getBusiness(), Store.getToolPrefs(), Store.getPromptState());
    const revPrompt = prompts.find(p => p.key === 'revenue-presell-rev-1');
    expect(revPrompt).toBeTruthy();
    expect(revPrompt.tool).toBeTruthy();
    expect(revPrompt.tool.name).toBe('Stripe');
  });

  test('completed prompt is excluded from next generation', () => {
    Store.saveBusiness({ name: 'Test', stage: 'idea', type: 'service' });
    Store.completePrompt('biz-pitch', null);

    const prompts = Prompts.generateSync([], Store.getBusiness(), {}, Store.getPromptState());
    const pitchPrompt = prompts.find(p => p.key === 'biz-pitch');
    expect(pitchPrompt).toBeUndefined();
  });

  test('dismissed prompt is excluded from next generation', () => {
    Store.saveBusiness({ name: 'Test', stage: 'idea', type: 'service' });
    Store.dismissPrompt('biz-competitors');

    const prompts = Prompts.generateSync([], Store.getBusiness(), {}, Store.getPromptState());
    const compPrompt = prompts.find(p => p.key === 'biz-competitors');
    expect(compPrompt).toBeUndefined();
  });
});

describe('Full end-to-end flow', () => {
  test('create business → canvas → hypotheses → log data → export → import', () => {
    Store.saveBusiness({
      id: Store.uid(), name: 'E2E Biz', type: 'retail',
      description: 'A test retail shop', proudOf: 'Great products',
      goal: 'Grow revenue', concern: 'Competition',
      revenueRange: '$5K - $20K', teamSize: '2-5',
      createdAt: '2025-01-01', stage: 'validation'
    });

    const wizardData = {
      name: 'E2E Biz', type: 'retail',
      proudOf: 'Great products',
      segments: ['Gift shoppers', 'Brand-conscious buyers'],
      costs: ['Rent / lease', 'Inventory / stock'],
      revenueRange: '$5K - $20K', teamSize: '2-5',
      goal: 'Grow revenue', concern: 'Competition',
      websiteData: null
    };
    const canvas = AI.buildCanvas(wizardData);
    Store.saveCanvas(canvas);

    const hyps = AI.keywordFallbackHypotheses(wizardData);
    hyps.forEach(h => Store.addHypothesis(h));
    Store.setWizardComplete();

    const savedHyps = Store.getHypotheses();
    expect(savedHyps.length).toBeGreaterThan(0);

    Store.addActual(savedHyps[0].id, { date: '2025-01-15', value: 5, note: 'Week 1' });
    Store.addActual(savedHyps[0].id, { date: '2025-01-22', value: 8, note: 'Week 2' });

    const trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);
    expect(trackerContainer.querySelectorAll('.hyp-card').length).toBe(savedHyps.length);
    expect(trackerContainer.querySelector('.sparkline')).toBeTruthy();

    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    expect(canvasContainer.querySelector('.page-title').textContent).toBe('E2E Biz');

    Store.saveTheme({ accent: '#e67e22' });
    Store.saveTerminology({ businessType: 'retail', labels: { customerSegments: 'Shoppers' } });

    const exported = Store.exportAll();
    Store.resetAll();
    expect(Store.getBusiness()).toBeNull();

    Store.importAll(exported);
    expect(Store.getBusiness().name).toBe('E2E Biz');
    expect(Store.getHypotheses().length).toBe(savedHyps.length);
    expect(Store.getHypotheses()[0].actuals).toHaveLength(2);
    expect(Store.getTheme().accent).toBe('#e67e22');
    expect(Store.getTerminology().businessType).toBe('retail');
  });
});

describe('Adaptive terminology flows through all views', () => {
  test('restaurant terminology in canvas and tracker', () => {
    Store.saveBusiness({ name: 'My Cafe', type: 'restaurant', stage: 'validation' });
    Store.addHypothesis({
      statement: 'Guests love our food', category: 'customer',
      canvasElement: 'customerSegments', status: 'testing',
      target: 50, actuals: [], priority: 'critical'
    });

    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    const labels = Array.from(canvasContainer.querySelectorAll('.bmc-label')).map(l => l.textContent);
    expect(labels).toContain('Your Guests');
    expect(labels).toContain('Running Costs');

    const trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);
    expect(trackerContainer.querySelector('.tracker-summary')).toBeTruthy();
  });

  test('ecommerce terminology applied correctly', () => {
    Store.saveBusiness({ name: 'My Shop', type: 'ecommerce' });
    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    const labels = Array.from(canvasContainer.querySelectorAll('.bmc-label')).map(l => l.textContent);
    expect(labels).toContain('Your Buyers');
    expect(labels).toContain('Cost of Goods & Ops');
  });
});
