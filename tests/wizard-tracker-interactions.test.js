/**
 * Tests for wizard flow, tracker interactions, and cross-module data flow.
 * Covers the financials card, hypothesis selection, logging, filtering, and status changes.
 */
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

describe('Wizard — URL stage', () => {
  test('renders URL input and buttons', () => {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);

    expect(container.querySelector('#ob-url')).toBeTruthy();
    expect(container.querySelector('#btn-analyze')).toBeTruthy();
    expect(container.querySelector('#btn-skip')).toBeTruthy();
  });

  test('skip button transitions to workspace stage', () => {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);

    const skipBtn = container.querySelector('#btn-skip');
    skipBtn.click();

    expect(container.querySelector('.ob-workspace')).toBeTruthy();
    expect(container.querySelector('.ob-cards-panel')).toBeTruthy();
  });

  test('analyze button with empty URL skips to manual', () => {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);

    const urlInput = container.querySelector('#ob-url');
    urlInput.value = '';
    const analyzeBtn = container.querySelector('#btn-analyze');
    analyzeBtn.click();

    expect(container.querySelector('.ob-workspace')).toBeTruthy();
  });
});

describe('Wizard — workspace stage cards', () => {
  function skipToWorkspace() {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);
    container.querySelector('#btn-skip').click();
    return container;
  }

  test('identity card renders with name and proudOf fields', () => {
    const container = skipToWorkspace();

    expect(container.querySelector('#ob-name')).toBeTruthy();
    expect(container.querySelector('#ob-proud')).toBeTruthy();
    expect(container.querySelector('#btn-confirm-identity')).toBeTruthy();
  });

  test('customers card renders with segment chips', () => {
    const container = skipToWorkspace();

    const chips = container.querySelectorAll('#ob-segs .ob-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(container.querySelector('#btn-confirm-customers')).toBeTruthy();
  });

  test('customers confirm button is disabled with no segments selected', () => {
    const container = skipToWorkspace();

    const btn = container.querySelector('#btn-confirm-customers');
    expect(btn.disabled).toBe(true);
  });

  test('chip selection toggles active class', () => {
    const container = skipToWorkspace();

    const chips = container.querySelectorAll('#ob-segs .ob-chip');
    expect(chips.length).toBeGreaterThan(0);

    // Click first chip to select
    chips[0].click();
    expect(chips[0].classList.contains('active')).toBe(true);

    // Click again to deselect
    chips[0].click();
    expect(chips[0].classList.contains('active')).toBe(false);
  });

  test('live preview panel renders', () => {
    const container = skipToWorkspace();

    const preview = container.querySelector('#ob-preview');
    expect(preview).toBeTruthy();
    expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
  });
});

describe('Wizard — stage progression', () => {
  function advanceToStageB() {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);
    container.querySelector('#btn-skip').click();

    // Fill identity card
    const nameInput = container.querySelector('#ob-name');
    nameInput.value = 'Test Business';
    nameInput.dispatchEvent(new Event('input'));
    const proudInput = container.querySelector('#ob-proud');
    proudInput.value = 'Best in class service';
    proudInput.dispatchEvent(new Event('input'));
    container.querySelector('#btn-confirm-identity').click();

    // Fill customers card - select a chip
    const chips = container.querySelectorAll('#ob-segs .ob-chip');
    chips[0].click();
    container.querySelector('#btn-confirm-customers').click();

    return container;
  }

  test('confirming identity and customers reveals Stage B cards', () => {
    const container = advanceToStageB();

    // Stage B should now show economics and ambition cards
    expect(container.querySelector('#ob-revenue')).toBeTruthy();
    expect(container.querySelector('#ob-team')).toBeTruthy();
  });

  test('confirmed cards show summary with edit button', () => {
    const container = advanceToStageB();

    const editBtns = container.querySelectorAll('.ob-edit-btn');
    expect(editBtns.length).toBeGreaterThanOrEqual(2); // identity and customers
  });

  test('edit button re-opens a confirmed card', () => {
    const container = advanceToStageB();

    const editBtns = container.querySelectorAll('.ob-edit-btn');
    const identityEdit = Array.from(editBtns).find(b => b.dataset.edit === 'identity');
    expect(identityEdit).toBeTruthy();
    identityEdit.click();

    // Should show the input fields again
    expect(container.querySelector('#ob-name')).toBeTruthy();
  });
});

describe('Wizard — onboarding data persistence', () => {
  test('saves progress to store', () => {
    Wizard.reset();
    const container = document.getElementById('app');
    Wizard.render(container);
    container.querySelector('#btn-skip').click();

    // Fill and confirm identity
    container.querySelector('#ob-name').value = 'Persisted Biz';
    container.querySelector('#ob-name').dispatchEvent(new Event('input'));
    container.querySelector('#ob-proud').value = 'Great stuff';
    container.querySelector('#ob-proud').dispatchEvent(new Event('input'));
    container.querySelector('#btn-confirm-identity').click();

    // Check saved data
    const saved = Store.getOnboardingData();
    expect(saved).toBeTruthy();
    expect(saved.data.name).toBe('Persisted Biz');
    expect(saved.confirmed.identity).toBe(true);
  });
});

describe('Tracker — filter interactions', () => {
  test('filter buttons change displayed hypotheses', () => {
    Store.addHypothesis({
      statement: 'Customer hyp', category: 'customer',
      canvasElement: 'customerSegments', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });
    Store.addHypothesis({
      statement: 'Value hyp', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 5, actuals: [], priority: 'important'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    // All filter: both visible
    let cards = container.querySelectorAll('.hyp-card');
    expect(cards).toHaveLength(2);

    // Click customer filter
    const customerFilter = Array.from(container.querySelectorAll('.filter-btn'))
      .find(b => b.dataset.filter === 'customer');
    expect(customerFilter).toBeTruthy();
    customerFilter.click();

    // After re-render, should only show customer hypothesis
    cards = container.querySelectorAll('.hyp-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Customer hyp');
  });

  test('critical filter shows only critical priority', () => {
    Store.addHypothesis({
      statement: 'Critical one', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });
    Store.addHypothesis({
      statement: 'Normal one', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'important'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const critFilter = Array.from(container.querySelectorAll('.filter-btn'))
      .find(b => b.dataset.filter === 'critical');
    critFilter.click();

    const cards = container.querySelectorAll('.hyp-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Critical one');
  });
});

describe('Tracker — logging interaction', () => {
  test('log button opens logging form', () => {
    const hyp = Store.addHypothesis({
      statement: 'Log test', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const logBtn = container.querySelector('.btn-log');
    expect(logBtn).toBeTruthy();
    logBtn.click();

    // After click, form should appear
    const form = container.querySelector('.hyp-log-form');
    expect(form).toBeTruthy();
    expect(container.querySelector('#log-value-' + hyp.id)).toBeTruthy();
  });

  test('saving log data adds actual to hypothesis', () => {
    const hyp = Store.addHypothesis({
      statement: 'Save log test', category: 'revenue',
      canvasElement: 'revenueStreams', status: 'testing',
      target: 100, actuals: [], priority: 'critical'
    });

    // Render tracker into the main app container so getElementById works
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app');
    Tracker.render(container);

    // Open log form
    const logBtn = container.querySelector('.btn-log');
    logBtn.click();

    // Fill in value — the form elements use document.getElementById
    const valueInput = document.getElementById('log-value-' + hyp.id);
    expect(valueInput).toBeTruthy();
    valueInput.value = '42';

    // Save
    const saveBtn = container.querySelector('.btn-log-save');
    saveBtn.click();

    // Verify data was saved
    const updated = Store.getHypotheses()[0];
    expect(updated.actuals).toHaveLength(1);
    expect(updated.actuals[0].value).toBe(42);
  });

  test('cancel button closes log form', () => {
    Store.addHypothesis({
      statement: 'Cancel test', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    // Open then cancel
    container.querySelector('.btn-log').click();
    expect(container.querySelector('.hyp-log-form')).toBeTruthy();

    container.querySelector('.btn-log-cancel').click();
    expect(container.querySelector('.hyp-log-form')).toBeNull();
  });
});

describe('Tracker — status change', () => {
  test('changing status via select updates store', () => {
    const hyp = Store.addHypothesis({
      statement: 'Status change', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const select = container.querySelector('.hyp-status-select');
    expect(select).toBeTruthy();
    select.value = 'validated';
    select.dispatchEvent(new Event('change'));

    const updated = Store.getHypotheses()[0];
    expect(updated.status).toBe('validated');
  });
});

describe('Tracker — delete hypothesis', () => {
  test('delete button removes hypothesis after confirm', () => {
    Store.addHypothesis({
      statement: 'Delete me', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    global.confirm.mockReturnValueOnce(true);

    const container = document.createElement('div');
    Tracker.render(container);

    const deleteBtn = container.querySelector('.btn-delete-hyp');
    expect(deleteBtn).toBeTruthy();
    deleteBtn.click();

    expect(Store.getHypotheses()).toHaveLength(0);
  });

  test('delete button does nothing when cancelled', () => {
    Store.addHypothesis({
      statement: 'Keep me', category: 'value',
      canvasElement: 'valueProp', status: 'testing',
      target: 10, actuals: [], priority: 'critical'
    });

    global.confirm.mockReturnValueOnce(false);

    const container = document.createElement('div');
    Tracker.render(container);

    const deleteBtn = container.querySelector('.btn-delete-hyp');
    deleteBtn.click();

    expect(Store.getHypotheses()).toHaveLength(1);
  });
});

describe('Tracker — action prompts', () => {
  test('action prompts render for testing hypotheses', () => {
    Store.addHypothesis({
      id: 'ap-h1', statement: 'Test something', category: 'customer',
      canvasElement: 'customerSegments', status: 'testing',
      createdAt: new Date().toISOString().slice(0, 10),
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const prompts = container.querySelector('.action-prompts');
    expect(prompts).toBeTruthy();
    const cards = container.querySelectorAll('.action-prompt-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  test('dismiss button removes prompt', () => {
    Store.addHypothesis({
      id: 'dismiss-h1', statement: 'Dismiss test', category: 'customer',
      canvasElement: 'customerSegments', status: 'testing',
      createdAt: new Date().toISOString().slice(0, 10),
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const dismissBtn = container.querySelector('.action-prompt-dismiss');
    if (dismissBtn) {
      const key = dismissBtn.dataset.key;
      dismissBtn.click();
      const state = Store.getPromptState();
      expect(state.dismissed).toContain(key);
    }
  });

  test('done button completes prompt', () => {
    Store.addHypothesis({
      id: 'done-h1', statement: 'Complete test', category: 'customer',
      canvasElement: 'customerSegments', status: 'testing',
      createdAt: new Date().toISOString().slice(0, 10),
      target: 10, actuals: [], priority: 'critical'
    });

    const container = document.createElement('div');
    Tracker.render(container);

    const doneBtn = container.querySelector('.action-prompt-done-btn');
    if (doneBtn) {
      doneBtn.click();
      const state = Store.getPromptState();
      expect(state.completed.length).toBeGreaterThan(0);
    }
  });
});

describe('Tracker — addNew', () => {
  test('adds hypothesis with user input', () => {
    // Set up the DOM with an app container
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app');
    Tracker.render(container);

    global.prompt
      .mockReturnValueOnce('My new hypothesis')  // statement
      .mockReturnValueOnce('Revenue per month')   // metric
      .mockReturnValueOnce('5000')                // target
      .mockReturnValueOnce('$/month');            // unit

    Tracker.addNew();

    const hyps = Store.getHypotheses();
    expect(hyps).toHaveLength(1);
    expect(hyps[0].statement).toBe('My new hypothesis');
    expect(hyps[0].metric).toBe('Revenue per month');
    expect(hyps[0].target).toBe(5000);
    expect(hyps[0].unit).toBe('$/month');
    expect(hyps[0].category).toBe('value');
    expect(hyps[0].priority).toBe('important');
  });
});

describe('Canvas — edit interactions', () => {
  test('clicking an item enters edit mode', () => {
    Store.saveBusiness({ name: 'Test' });
    Store.addCanvasItem('customerSegments', 'Students');

    const container = document.createElement('div');
    Canvas.render(container);

    const item = container.querySelector('.bmc-item');
    expect(item).toBeTruthy();
    item.click();

    // After click, should show edit input
    const input = container.querySelector('.bmc-edit-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Students');
  });

  test('save button in edit mode updates item', () => {
    Store.saveBusiness({ name: 'Test' });
    Store.addCanvasItem('customerSegments', 'Original text');

    const container = document.createElement('div');
    Canvas.render(container);

    // Click to edit
    container.querySelector('.bmc-item').click();

    const input = container.querySelector('.bmc-edit-input');
    // Simulate typing in the input
    Object.defineProperty(input, 'value', { value: 'Updated text', writable: true });

    const saveBtn = container.querySelector('.bmc-save');
    saveBtn.click();

    const canvas = Store.getCanvas();
    expect(canvas.customerSegments[0].text).toBe('Updated text');
  });

  test('delete button in edit mode removes item', () => {
    Store.saveBusiness({ name: 'Test' });
    Store.addCanvasItem('customerSegments', 'To be deleted');

    const container = document.createElement('div');
    Canvas.render(container);

    container.querySelector('.bmc-item').click();

    const deleteBtn = container.querySelector('.bmc-delete');
    deleteBtn.click();

    const canvas = Store.getCanvas();
    expect(canvas.customerSegments).toHaveLength(0);
  });
});

describe('Integration: Simulation config from wizard to dashboard', () => {
  test('wizard financials flow into simulation config correctly', () => {
    // Simulate a wizard completion with financial overrides
    Store.saveBusiness({
      id: Store.uid(),
      name: 'Finance Test',
      type: 'saas',
      description: 'SaaS platform',
      revenueRange: '$5K - $20K',
      teamSize: '2-5',
      createdAt: '2025-01-01',
      stage: 'validation'
    });

    const canvas = AI.buildCanvas({
      segments: ['Developers'],
      proudOf: 'Best developer tool',
      costs: ['Hosting', 'Marketing'],
      revenueRange: '$5K - $20K',
      teamSize: '2-5'
    });
    Store.saveCanvas(canvas);

    // Build config with overrides (simulating wizard financial inputs)
    const simConfig = SimulationTypes.buildConfigFromWizard(
      Store.getBusiness(),
      canvas,
      { startingCash: 50000 }
    );
    Store.saveSimConfig(simConfig);

    // Verify config
    expect(simConfig.startingCash).toBe(50000);
    expect(simConfig.businessType).toBe('saas');

    // Run simulation
    const result = SimEngine.run(simConfig);
    expect(result.months).toHaveLength(36);
    expect(result.months[0].cashBalance).toBeTruthy();

    // Render dashboard
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
  });

  test('default config auto-generates when none exists', () => {
    Store.saveBusiness({ name: 'Auto Config', type: 'ecommerce' });
    // No simConfig saved

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Should auto-generate
    const config = Store.getSimConfig();
    expect(config).toBeTruthy();
    expect(config.businessType).toBe('ecommerce');
  });
});

describe('Integration: Hypothesis lifecycle', () => {
  test('full lifecycle: create → log data → validate → appears in canvas', () => {
    Store.saveBusiness({ name: 'Lifecycle Test', type: 'service' });
    Store.addCanvasItem('valueProp', 'Best service');

    // Create hypothesis
    const hyp = Store.addHypothesis({
      statement: 'Customers will pay $200/hour',
      category: 'revenue',
      canvasElement: 'revenueStreams',
      status: 'testing',
      target: 10,
      unit: 'clients',
      priority: 'critical'
    });

    // Log data
    Store.addActual(hyp.id, { value: 3, note: 'Week 1', date: '2025-01-07' });
    Store.addActual(hyp.id, { value: 7, note: 'Week 2', date: '2025-01-14' });
    Store.addActual(hyp.id, { value: 12, note: 'Week 3', date: '2025-01-21' });

    // Validate
    Store.updateHypothesis(hyp.id, { status: 'validated' });

    // Verify state
    const updated = Store.getHypotheses()[0];
    expect(updated.status).toBe('validated');
    expect(updated.actuals).toHaveLength(3);
    expect(updated.actuals[2].value).toBe(12);

    // Render tracker
    const trackerContainer = document.createElement('div');
    Tracker.render(trackerContainer);
    const card = trackerContainer.querySelector('.hyp-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.hyp-progress-pct').textContent).toBe('100%');

    // Render canvas (validated hypothesis should reflect)
    const canvasContainer = document.createElement('div');
    Canvas.render(canvasContainer);
    // Canvas items should exist
    expect(canvasContainer.querySelectorAll('.bmc-item').length).toBeGreaterThan(0);
  });
});
