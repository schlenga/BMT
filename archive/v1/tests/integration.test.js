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

describe('Integration: Wizard → Store → Canvas → Tracker', () => {
  test('completing wizard populates store, canvas, and tracker', () => {
    const wizardData = {
      name: 'Test Coffee Shop',
      type: 'restaurant',
      description: 'A cozy coffee shop',
      proudOf: 'Best espresso in town',
      segments: ['Office workers nearby', 'Students'],
      revenueRange: '$5K - $20K',
      costs: ['Rent / lease', 'Staff wages', 'Ingredients & supplies'],
      teamSize: '2-5',
      goal: 'Grow revenue',
      concern: 'Competition from chains',
      websiteData: null
    };

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

    const hyps = AI.keywordFallbackHypotheses(wizardData);
    hyps.forEach(h => Store.addHypothesis(h));

    Store.setWizardComplete();

    // Verify store state
    const biz = Store.getBusiness();
    expect(biz.name).toBe('Test Coffee Shop');
    expect(biz.type).toBe('restaurant');
    expect(biz.stage).toBe('validation');

    const savedCanvas = Store.getCanvas();
    expect(savedCanvas.customerSegments.length).toBeGreaterThanOrEqual(2);
    expect(savedCanvas.valueProp.length).toBeGreaterThanOrEqual(1);
    expect(savedCanvas.costStructure.length).toBeGreaterThanOrEqual(3);
    expect(savedCanvas.keyActivities.length).toBeGreaterThanOrEqual(2);

    const savedHyps = Store.getHypotheses();
    expect(savedHyps.length).toBeGreaterThanOrEqual(3);

    // Render tracker and verify
    const trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);
    const hypCards = trackerContainer.querySelectorAll('.hyp-card');
    expect(hypCards.length).toBe(savedHyps.length);

    // Render canvas and verify
    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    const title = canvasContainer.querySelector('.page-title');
    expect(title.textContent).toBe('Test Coffee Shop');
    const bmcItems = canvasContainer.querySelectorAll('.bmc-item');
    expect(bmcItems.length).toBeGreaterThan(0);
  });

  test('logging data updates tracker display', () => {
    const hyp = Store.addHypothesis({
      statement: 'We can get 50 daily customers',
      category: 'customer',
      canvasElement: 'customerSegments',
      status: 'testing',
      target: 50,
      unit: 'customers/day',
      priority: 'critical'
    });

    Store.addActual(hyp.id, { value: 15, note: 'Day 1', date: '2025-01-01' });
    Store.addActual(hyp.id, { value: 25, note: 'Day 2', date: '2025-01-02' });
    Store.addActual(hyp.id, { value: 35, note: 'Day 3', date: '2025-01-03' });

    const container = document.createElement('div');
    Tracker.render(container);

    const progress = container.querySelector('.hyp-progress-pct');
    expect(progress).toBeTruthy();
    expect(progress.textContent).toBe('70%');

    expect(container.querySelector('.sparkline')).toBeTruthy();

    const history = container.querySelector('.hyp-history');
    expect(history).toBeTruthy();
    expect(history.textContent).toContain('3 data points');
  });

  test('hypothesis status change reflects in canvas item styling', () => {
    Store.addCanvasItem('valueProp', 'Great coffee');
    Store.addHypothesis({
      statement: 'People love our coffee',
      category: 'value',
      canvasElement: 'valueProp',
      status: 'testing',
      target: 10,
      actuals: [],
      priority: 'critical'
    });

    const container = document.createElement('div');
    Canvas.render(container);
    const testingItems = container.querySelectorAll('.status-testing');
    expect(testingItems.length).toBeGreaterThanOrEqual(1);
  });

  test('export and import preserves full state', () => {
    Store.saveBusiness({ name: 'Export Biz', type: 'saas', stage: 'growth' });
    Store.addCanvasItem('valueProp', 'Cool feature');
    Store.addHypothesis({
      statement: 'Users want this',
      category: 'value',
      canvasElement: 'valueProp',
      status: 'validated',
      target: 100,
      actuals: [{ date: '2025-01-01', value: 120, note: 'Exceeded!' }]
    });
    Store.setWizardComplete();
    Store.saveToolPrefs({ social: ['instagram', 'tiktok'] });
    Store.completePrompt('test-prompt', null);
    Store.dismissPrompt('dismissed-prompt');

    const exported = Store.exportAll();

    Store.resetAll();
    expect(Store.getBusiness()).toBeNull();

    const result = Store.importAll(exported);
    expect(result).toBe(true);

    expect(Store.getBusiness().name).toBe('Export Biz');
    expect(Store.getCanvas().valueProp).toHaveLength(1);
    expect(Store.getHypotheses()).toHaveLength(1);
    expect(Store.getHypotheses()[0].actuals).toHaveLength(1);
    expect(Store.isWizardComplete()).toBe(true);
    expect(Store.getToolPrefs()).toEqual({ social: ['instagram', 'tiktok'] });
    expect(Store.getPromptState().completed).toHaveLength(1);
    expect(Store.getPromptState().dismissed).toContain('dismissed-prompt');
  });

  test('prompts integrate tool preferences correctly', () => {
    Store.saveBusiness({ name: 'Tool Test', stage: 'validation', type: 'service' });
    Store.saveToolPrefs({ payments: ['stripe'], email: ['mailchimp'] });

    const hyps = [{
      id: 'rev-1',
      status: 'testing',
      category: 'revenue',
      statement: 'Clients will pay $200/hour',
      createdAt: new Date().toISOString().slice(0, 10),
      actuals: [],
      target: 5000,
      unit: '$/month',
      priority: 'critical'
    }];

    const biz = Store.getBusiness();
    const toolPrefs = Store.getToolPrefs();
    const promptState = Store.getPromptState();

    const prompts = Prompts.generateSync(hyps, biz, toolPrefs, promptState);

    const revPrompt = prompts.find(p => p.key === 'revenue-presell-rev-1');
    expect(revPrompt).toBeTruthy();
    expect(revPrompt.tool).toBeTruthy();
    expect(revPrompt.tool.name).toBe('Stripe');

    const followupPrompt = prompts.find(p => p.key === 'biz-followup');
    expect(followupPrompt).toBeTruthy();
    expect(followupPrompt.tool.name).toBe('Mailchimp');
  });

  test('reset clears everything and shows wizard', () => {
    Store.saveBusiness({ name: 'Test' });
    Store.setWizardComplete();
    Store.addHypothesis({ statement: 'Test' });

    Store.resetAll();
    Wizard.reset();

    expect(Store.getBusiness()).toBeNull();
    expect(Store.isWizardComplete()).toBe(false);
    expect(Store.getHypotheses()).toEqual([]);

    window.location.hash = '#wizard';
    App.render();
    const app = document.getElementById('app');
    expect(app.querySelector('.ob-entrance') || app.querySelector('.ob-workspace')).toBeTruthy();
  });

  test('canvas add item via UI flow', () => {
    Store.saveBusiness({ name: 'Test' });
    const container = document.createElement('div');
    Canvas.render(container);

    global.prompt.mockReturnValueOnce('New customer segment');
    const addBtns = container.querySelectorAll('.bmc-add');
    let segAddBtn = null;
    addBtns.forEach(btn => {
      if (btn.dataset.element === 'customerSegments') segAddBtn = btn;
    });
    expect(segAddBtn).toBeTruthy();
    segAddBtn.click();

    const canvas = Store.getCanvas();
    expect(canvas.customerSegments).toHaveLength(1);
    expect(canvas.customerSegments[0].text).toBe('New customer segment');
  });

  test('settings stage change updates business', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Stage Test', stage: 'idea' });

    window.location.hash = '#settings';
    App.render();

    const validationCard = document.querySelector('.stage-card[data-stage="validation"]');
    expect(validationCard).toBeTruthy();
    validationCard.click();

    const biz = Store.getBusiness();
    expect(biz.stage).toBe('validation');
  });

  test('AI detectType feeds into canvas and prompts consistently', () => {
    const description = 'We run a small cafe serving artisanal coffee and pastries';
    const type = AI.detectType(description);
    expect(type).toBe('restaurant');

    const segments = AI.getSuggestions(AI.SEGMENTS, type);
    expect(segments).toContain('Food enthusiasts');

    const costs = AI.getSuggestions(AI.COSTS, type);
    expect(costs).toContain('Ingredients & supplies');

    const channels = AI.getSuggestions(AI.CHANNELS, type);
    expect(channels).toContain('Walk-in foot traffic');
  });

  test('adaptive terminology flows through canvas rendering', () => {
    Store.saveBusiness({ name: 'SaaS Co', type: 'saas' });
    const container = document.createElement('div');
    Canvas.render(container);
    const labels = container.querySelectorAll('.bmc-label');
    const labelTexts = Array.from(labels).map(l => l.textContent);
    expect(labelTexts).toContain('Your Users');
    expect(labelTexts).toContain('Burn Rate');
  });

  test('theme persistence through save and restore', () => {
    const palette = AI.generatePalette('#3498db');
    AI.applyTheme(palette);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#3498db');

    // Clear styles
    document.documentElement.style.removeProperty('--accent');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');

    // Restore
    AI.restoreTheme();
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#3498db');
  });
});
