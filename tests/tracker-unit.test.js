const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);

  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

function resetTrackerFilter(container) {
  const allBtn = Array.from(container.querySelectorAll('.filter-btn'))
    .find(f => f.dataset.filter === 'all');
  if (allBtn) allBtn.click();
}

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
});

describe('Tracker', () => {
  describe('render()', () => {
    test('renders summary cards with correct counts', () => {
      Store.addHypothesis({ statement: 'H1', status: 'testing', category: 'value', actuals: [] });
      Store.addHypothesis({ statement: 'H2', status: 'validated', category: 'customer', actuals: [] });
      Store.addHypothesis({ statement: 'H3', status: 'invalidated', category: 'revenue', actuals: [] });
      Store.addHypothesis({ statement: 'H4', status: 'testing', category: 'cost', actuals: [] });

      const container = document.createElement('div');
      Tracker.render(container);
      const counts = container.querySelectorAll('.summary-count');
      expect(counts[0].textContent).toBe('4');
      expect(counts[1].textContent).toBe('2');
      expect(counts[2].textContent).toBe('1');
      expect(counts[3].textContent).toBe('1');
    });

    test('renders filter buttons for all categories', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      const filters = container.querySelectorAll('.filter-btn');
      expect(filters.length).toBeGreaterThanOrEqual(7);
      const filterKeys = Array.from(filters).map(f => f.dataset.filter);
      expect(filterKeys).toContain('all');
      expect(filterKeys).toContain('critical');
      expect(filterKeys).toContain('customer');
      expect(filterKeys).toContain('value');
      expect(filterKeys).toContain('revenue');
      expect(filterKeys).toContain('growth');
      expect(filterKeys).toContain('cost');
    });

    test('filter click re-renders with filtered results', () => {
      Store.addHypothesis({ statement: 'Cust hyp', status: 'testing', category: 'customer', actuals: [], priority: 'important' });
      Store.addHypothesis({ statement: 'Val hyp', status: 'testing', category: 'value', actuals: [], priority: 'critical' });

      const container = document.createElement('div');
      Tracker.render(container);

      const criticalFilter = Array.from(container.querySelectorAll('.filter-btn'))
        .find(f => f.dataset.filter === 'critical');
      criticalFilter.click();

      const cards = container.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain('Val hyp');

      resetTrackerFilter(container);
    });

    test('lean tip shows for empty hypotheses', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip).toBeTruthy();
      expect(tip.textContent).toContain('Canvas');
    });

    test('lean tip contextual for testing-only state', () => {
      Store.addHypothesis({ statement: 'H1', status: 'testing', category: 'value', actuals: [] });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('critical assumptions');
    });

    test('lean tip for validated progress', () => {
      Store.addHypothesis({ statement: 'H1', status: 'validated', category: 'value', actuals: [] });
      Store.addHypothesis({ statement: 'H2', status: 'testing', category: 'value', actuals: [] });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('validation');
    });

    test('lean tip for invalidated learning', () => {
      Store.addHypothesis({ statement: 'H1', status: 'invalidated', category: 'value', actuals: [] });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('wrong');
    });

    test('empty state when no hypotheses', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.tracker-empty')).toBeTruthy();
    });

    test('progress bar shows correct percentage', () => {
      Store.addHypothesis({
        id: 'prog-1', statement: 'Test', category: 'revenue',
        canvasElement: 'revenueStreams', status: 'testing',
        target: 100, unit: 'sales', actuals: [{ date: '2025-01-15', value: 45, note: '' }],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const pct = container.querySelector('.hyp-progress-pct');
      expect(pct.textContent).toBe('45%');
    });

    test('progress caps at 100%', () => {
      Store.addHypothesis({
        id: 'cap-1', statement: 'Exceeded', category: 'revenue',
        canvasElement: 'revenueStreams', status: 'testing',
        target: 50, unit: 'sales', actuals: [{ date: '2025-01-15', value: 80, note: '' }],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const pct = container.querySelector('.hyp-progress-pct');
      expect(pct.textContent).toBe('100%');
    });

    test('progress is 0 when no actuals', () => {
      Store.addHypothesis({
        id: 'zero-1', statement: 'No data', category: 'revenue',
        canvasElement: 'revenueStreams', status: 'testing',
        target: 100, unit: 'sales', actuals: [],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const pct = container.querySelector('.hyp-progress-pct');
      expect(pct.textContent).toBe('0%');
    });

    test('sparkline renders with 2+ data points', () => {
      Store.addHypothesis({
        id: 'spark-1', statement: 'Sparkline', category: 'value',
        canvasElement: 'valueProp', status: 'testing', target: 100,
        actuals: [
          { date: '2025-01-01', value: 20, note: '' },
          { date: '2025-01-15', value: 50, note: '' }
        ],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.sparkline')).toBeTruthy();
    });

    test('no sparkline with single data point', () => {
      Store.addHypothesis({
        id: 'nospark-1', statement: 'One point', category: 'value',
        canvasElement: 'valueProp', status: 'testing', target: 100,
        actuals: [{ date: '2025-01-01', value: 20, note: '' }],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.sparkline')).toBeNull();
    });

    test('data history shows correct point count', () => {
      Store.addHypothesis({
        id: 'hist-1', statement: 'History', category: 'value',
        canvasElement: 'valueProp', status: 'testing', target: 10,
        actuals: [
          { date: '2025-01-01', value: 5, note: 'A' },
          { date: '2025-01-08', value: 8, note: 'B' },
          { date: '2025-01-15', value: 9, note: 'C' }
        ],
        priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const history = container.querySelector('.hyp-history');
      expect(history.textContent).toContain('3 data points');
    });

    test('critical priority badge rendered', () => {
      Store.addHypothesis({
        statement: 'Critical', category: 'value', canvasElement: 'valueProp',
        status: 'testing', target: 10, actuals: [], priority: 'critical'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.hyp-priority')).toBeTruthy();
    });

    test('no priority badge for non-critical', () => {
      Store.addHypothesis({
        statement: 'Important', category: 'value', canvasElement: 'valueProp',
        status: 'testing', target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.hyp-priority')).toBeNull();
    });

    test('status badge shows correct label', () => {
      Store.addHypothesis({
        statement: 'Validated', category: 'value', canvasElement: 'valueProp',
        status: 'validated', target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const status = container.querySelector('.hyp-status');
      expect(status.textContent).toBe('Validated');
    });

    test('log data button shows logging form', () => {
      Store.addHypothesis({
        id: 'log-1', statement: 'Log test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      const logBtn = container.querySelector('.btn-log');
      logBtn.click();

      expect(container.querySelector('.hyp-log-form')).toBeTruthy();
    });

    test('save log adds actual to store', () => {
      Store.addHypothesis({
        id: 'save-log-1', statement: 'Save test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      document.body.appendChild(container);
      Tracker.render(container);

      container.querySelector('.btn-log').click();

      const valInput = document.getElementById('log-value-save-log-1');
      valInput.value = '7';
      const noteInput = document.getElementById('log-note-save-log-1');
      noteInput.value = 'Test note';

      container.querySelector('.btn-log-save').click();

      const hyps = Store.getHypotheses();
      expect(hyps[0].actuals).toHaveLength(1);
      expect(hyps[0].actuals[0].value).toBe(7);
    });

    test('cancel log hides form', () => {
      Store.addHypothesis({
        id: 'cancel-1', statement: 'Cancel test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      container.querySelector('.btn-log').click();
      expect(container.querySelector('.hyp-log-form')).toBeTruthy();

      container.querySelector('.btn-log-cancel').click();
      expect(container.querySelector('.hyp-log-form')).toBeNull();
    });

    test('status change updates store', () => {
      Store.addHypothesis({
        id: 'status-1', statement: 'Status test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      const select = container.querySelector('.hyp-status-select');
      select.value = 'validated';
      select.dispatchEvent(new Event('change'));

      expect(Store.getHypotheses()[0].status).toBe('validated');
    });

    test('delete hypothesis removes from store', () => {
      Store.addHypothesis({
        id: 'del-1', statement: 'Delete test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      global.confirm.mockReturnValueOnce(true);
      container.querySelector('.btn-delete-hyp').click();

      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('delete hypothesis cancelled does not remove', () => {
      Store.addHypothesis({
        id: 'nodelete-1', statement: 'Keep me', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      global.confirm.mockReturnValueOnce(false);
      container.querySelector('.btn-delete-hyp').click();

      expect(Store.getHypotheses()).toHaveLength(1);
    });

    test('timeframe displayed when present', () => {
      Store.addHypothesis({
        statement: 'Timeframe test', category: 'value', canvasElement: 'valueProp',
        status: 'testing', target: 10, timeframe: 'First 3 months',
        actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.querySelector('.hyp-timeframe').textContent).toBe('First 3 months');
    });

    test('action prompt dismiss adds to dismissed state', () => {
      Store.saveBusiness({ name: 'Test', stage: 'idea', type: 'service' });
      Store.addHypothesis({
        id: 'dismiss-1', statement: 'Dismiss test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'critical',
        createdAt: '2020-01-01'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      const dismissBtn = container.querySelector('.action-prompt-dismiss');
      if (dismissBtn) {
        dismissBtn.click();
        const state = Store.getPromptState();
        expect(state.dismissed.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('action prompt done adds to completed state', () => {
      Store.saveBusiness({ name: 'Test', stage: 'idea', type: 'service' });
      Store.addHypothesis({
        id: 'done-1', statement: 'Done test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'critical',
        createdAt: '2020-01-01'
      });
      const container = document.createElement('div');
      Tracker.render(container);

      const doneBtn = container.querySelector('.action-prompt-done-btn');
      if (doneBtn) {
        doneBtn.click();
        const state = Store.getPromptState();
        expect(state.completed.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('escapes HTML in hypothesis statement', () => {
      Store.addHypothesis({
        statement: '<img src=x onerror=alert(1)>', category: 'value',
        canvasElement: 'valueProp', status: 'testing', actuals: [], priority: 'important'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      expect(container.innerHTML).not.toContain('<img src=x');
    });
  });

  describe('addNew()', () => {
    test('creates hypothesis with all prompt data', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });
      window.location.hash = '#tracker';

      global.prompt
        .mockReturnValueOnce('Customers will pay $50')
        .mockReturnValueOnce('Revenue per month')
        .mockReturnValueOnce('5000')
        .mockReturnValueOnce('$/month');

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('Customers will pay $50');
      expect(hyps[0].metric).toBe('Revenue per month');
      expect(hyps[0].target).toBe(5000);
      expect(hyps[0].unit).toBe('$/month');
    });

    test('does nothing when first prompt cancelled', () => {
      global.prompt.mockReturnValueOnce(null);
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('does nothing on empty input', () => {
      global.prompt.mockReturnValueOnce('   ');
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('handles missing optional fields', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service' });

      global.prompt
        .mockReturnValueOnce('Simple hypothesis')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('Simple hypothesis');
      expect(hyps[0].metric).toBe('Metric');
      expect(hyps[0].target).toBe(0);
    });
  });
});
