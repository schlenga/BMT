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

function renderTracker(bizType) {
  if (!Store.getBusiness()) {
    Store.saveBusiness({ name: 'Test Biz', type: bizType || 'service', stage: 'validation' });
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  Tracker.render(container);
  // Reset filter to 'all' to avoid state leaking between tests
  const allBtn = container.querySelector('.filter-btn[data-filter="all"]');
  if (allBtn && !allBtn.classList.contains('active')) {
    allBtn.click();
  }
  return container;
}

function addTestHyp(overrides) {
  return Store.addHypothesis(Object.assign({
    statement: 'Test hypothesis',
    category: 'value',
    canvasElement: 'valueProp',
    status: 'testing',
    target: 100,
    unit: 'users',
    actuals: [],
    priority: 'critical'
  }, overrides));
}

describe('Tracker', () => {
  describe('filter functionality', () => {
    test('all filter shows all hypotheses', () => {
      addTestHyp({ category: 'customer', statement: 'Customer hyp' });
      addTestHyp({ category: 'value', statement: 'Value hyp' });
      addTestHyp({ category: 'revenue', statement: 'Revenue hyp' });
      const c = renderTracker();
      const cards = c.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(3);
    });

    test('category filter shows only matching hypotheses', () => {
      addTestHyp({ category: 'customer', statement: 'Customer hyp' });
      addTestHyp({ category: 'value', statement: 'Value hyp' });
      addTestHyp({ category: 'revenue', statement: 'Revenue hyp' });
      const c = renderTracker();
      c.querySelector('.filter-btn[data-filter="customer"]').click();
      const cards = c.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain('Customer hyp');
    });

    test('critical filter shows only critical priority hypotheses', () => {
      addTestHyp({ priority: 'critical', statement: 'Critical one' });
      addTestHyp({ priority: 'important', statement: 'Important one' });
      const c = renderTracker();
      c.querySelector('.filter-btn[data-filter="critical"]').click();
      const cards = c.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain('Critical one');
    });

    test('empty category filter shows empty state', () => {
      addTestHyp({ category: 'customer' });
      const c = renderTracker();
      c.querySelector('.filter-btn[data-filter="revenue"]').click();
      expect(c.querySelector('.tracker-empty')).toBeTruthy();
    });

    test('clicking filter updates active class', () => {
      const c = renderTracker();
      c.querySelector('.filter-btn[data-filter="value"]').click();
      const valueBtn = c.querySelector('.filter-btn[data-filter="value"]');
      expect(valueBtn.classList.contains('active')).toBe(true);
    });
  });

  describe('log data flow', () => {
    test('clicking Log Data shows form', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      expect(c.querySelector('.hyp-log-form')).toBeTruthy();
    });

    test('saving log persists data to store', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      c.querySelector('.log-value').value = '42';
      c.querySelector('.btn-log-save').click();
      const stored = Store.getHypotheses()[0];
      expect(stored.actuals).toHaveLength(1);
      expect(stored.actuals[0].value).toBe(42);
    });

    test('cancel log hides form', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      expect(c.querySelector('.hyp-log-form')).toBeTruthy();
      c.querySelector('.btn-log-cancel').click();
      expect(c.querySelector('.hyp-log-form')).toBeNull();
    });

    test('toggle log button hides form if already open', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      expect(c.querySelector('.hyp-log-form')).toBeTruthy();
      c.querySelector('.btn-log').click();
      expect(c.querySelector('.hyp-log-form')).toBeNull();
    });

    test('log form has date, value, and note inputs', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      expect(c.querySelector('.log-date')).toBeTruthy();
      expect(c.querySelector('.log-value')).toBeTruthy();
      expect(c.querySelector('.log-note')).toBeTruthy();
    });

    test('log saves note text', () => {
      addTestHyp();
      const c = renderTracker();
      c.querySelector('.btn-log').click();
      c.querySelector('.log-value').value = '10';
      c.querySelector('.log-note').value = 'My note';
      c.querySelector('.btn-log-save').click();
      const stored = Store.getHypotheses()[0];
      expect(stored.actuals[0].note).toBe('My note');
    });
  });

  describe('status change', () => {
    test('changing status dropdown updates store', () => {
      addTestHyp();
      const c = renderTracker();
      const select = c.querySelector('.hyp-status-select');
      select.value = 'validated';
      select.dispatchEvent(new Event('change'));
      expect(Store.getHypotheses()[0].status).toBe('validated');
    });
  });

  describe('delete hypothesis', () => {
    test('delete removes hypothesis from store', () => {
      addTestHyp();
      const c = renderTracker();
      global.confirm.mockReturnValueOnce(true);
      c.querySelector('.btn-delete-hyp').click();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('delete cancelled does not remove', () => {
      addTestHyp();
      const c = renderTracker();
      global.confirm.mockReturnValueOnce(false);
      c.querySelector('.btn-delete-hyp').click();
      expect(Store.getHypotheses()).toHaveLength(1);
    });
  });

  describe('progress bar', () => {
    test('renders correct percentage', () => {
      addTestHyp({ target: 100, actuals: [{ date: '2025-01-01', value: 60, note: '' }] });
      const c = renderTracker();
      expect(c.querySelector('.hyp-progress-pct').textContent).toBe('60%');
    });

    test('caps at 100%', () => {
      addTestHyp({ target: 50, actuals: [{ date: '2025-01-01', value: 80, note: '' }] });
      const c = renderTracker();
      expect(c.querySelector('.hyp-progress-pct').textContent).toBe('100%');
    });

    test('shows 0% when no data logged', () => {
      addTestHyp({ target: 100 });
      const c = renderTracker();
      const bar = c.querySelector('.hyp-progress-fill');
      expect(bar.style.width).toBe('0%');
    });

    test('green bar color when target met', () => {
      addTestHyp({ target: 50, actuals: [{ date: '2025-01-01', value: 60, note: '' }] });
      const c = renderTracker();
      const bar = c.querySelector('.hyp-progress-fill');
      expect(bar.style.background).toContain('39, 174, 96');
    });

    test('red bar color when below 60%', () => {
      addTestHyp({ target: 100, actuals: [{ date: '2025-01-01', value: 20, note: '' }] });
      const c = renderTracker();
      const bar = c.querySelector('.hyp-progress-fill');
      expect(bar.style.background).toContain('231, 76, 60');
    });

    test('yellow bar color at 60-99%', () => {
      addTestHyp({ target: 100, actuals: [{ date: '2025-01-01', value: 70, note: '' }] });
      const c = renderTracker();
      const bar = c.querySelector('.hyp-progress-fill');
      expect(bar.style.background).toContain('243, 156, 18');
    });
  });

  describe('sparkline', () => {
    test('renders SVG sparkline with 2+ data points', () => {
      addTestHyp({
        actuals: [
          { date: '2025-01-01', value: 10, note: '' },
          { date: '2025-01-02', value: 20, note: '' }
        ]
      });
      const c = renderTracker();
      expect(c.querySelector('.sparkline')).toBeTruthy();
    });

    test('no sparkline with fewer than 2 data points', () => {
      addTestHyp({ actuals: [{ date: '2025-01-01', value: 10, note: '' }] });
      const c = renderTracker();
      expect(c.querySelector('.sparkline')).toBeNull();
    });

    test('sparkline has polyline element', () => {
      addTestHyp({
        actuals: [
          { date: '2025-01-01', value: 10, note: '' },
          { date: '2025-01-02', value: 20, note: '' },
          { date: '2025-01-03', value: 30, note: '' }
        ]
      });
      const c = renderTracker();
      expect(c.querySelector('.sparkline polyline')).toBeTruthy();
    });

    test('sparkline has target line when target set', () => {
      addTestHyp({
        target: 50,
        actuals: [
          { date: '2025-01-01', value: 10, note: '' },
          { date: '2025-01-02', value: 30, note: '' }
        ]
      });
      const c = renderTracker();
      const lines = c.querySelectorAll('.sparkline line');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('summary counts', () => {
    test('shows correct total count', () => {
      addTestHyp({ status: 'testing' });
      addTestHyp({ status: 'validated' });
      addTestHyp({ status: 'invalidated' });
      const c = renderTracker();
      const counts = c.querySelectorAll('.summary-count');
      expect(counts[0].textContent).toBe('3');
    });

    test('shows correct status counts', () => {
      addTestHyp({ status: 'testing' });
      addTestHyp({ status: 'testing' });
      addTestHyp({ status: 'validated' });
      const c = renderTracker();
      const counts = c.querySelectorAll('.summary-count');
      expect(counts[1].textContent).toBe('2');
      expect(counts[2].textContent).toBe('1');
      expect(counts[3].textContent).toBe('0');
    });
  });

  describe('lean tips', () => {
    test('shows tip for no hypotheses', () => {
      const c = renderTracker();
      expect(c.querySelector('.lean-tip').textContent).toContain('Canvas');
    });

    test('shows tip when all testing', () => {
      addTestHyp({ status: 'testing' });
      const c = renderTracker();
      expect(c.querySelector('.lean-tip').textContent).toContain('critical assumptions');
    });

    test('shows tip when validated progress', () => {
      addTestHyp({ status: 'validated' });
      addTestHyp({ status: 'validated' });
      const c = renderTracker();
      expect(c.querySelector('.lean-tip').textContent).toContain('gaining validation');
    });

    test('shows tip when invalidated', () => {
      addTestHyp({ status: 'invalidated' });
      addTestHyp({ status: 'invalidated' });
      const c = renderTracker();
      expect(c.querySelector('.lean-tip').textContent).toContain('wrong');
    });
  });

  describe('data history', () => {
    test('renders data history with correct point count', () => {
      addTestHyp({
        actuals: [
          { date: '2025-01-01', value: 10, note: 'First' },
          { date: '2025-01-08', value: 20, note: 'Second' }
        ]
      });
      const c = renderTracker();
      const history = c.querySelector('.hyp-history');
      expect(history).toBeTruthy();
      expect(history.textContent).toContain('2 data points');
    });

    test('no history section when no data points', () => {
      addTestHyp();
      const c = renderTracker();
      expect(c.querySelector('.hyp-history')).toBeNull();
    });

    test('singular data point text', () => {
      addTestHyp({ actuals: [{ date: '2025-01-01', value: 5, note: '' }] });
      const c = renderTracker();
      const history = c.querySelector('.hyp-history');
      expect(history.textContent).toContain('1 data point');
      expect(history.textContent).not.toContain('1 data points');
    });
  });

  describe('action prompts', () => {
    test('renders action prompts section', () => {
      addTestHyp({ createdAt: '2025-01-01' });
      const c = renderTracker();
      expect(c.querySelector('#action-prompts-section')).toBeTruthy();
    });

    test('dismiss removes prompt from display', () => {
      addTestHyp({ createdAt: '2025-01-01' });
      const c = renderTracker();
      const dismissBtn = c.querySelector('.action-prompt-dismiss');
      if (dismissBtn) {
        const key = dismissBtn.dataset.key;
        dismissBtn.click();
        expect(Store.getPromptState().dismissed).toContain(key);
      }
    });

    test('done marks prompt as completed', () => {
      addTestHyp({ createdAt: '2025-01-01' });
      const c = renderTracker();
      const doneBtn = c.querySelector('.action-prompt-done-btn');
      if (doneBtn) {
        doneBtn.click();
        expect(Store.getPromptState().completed.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('addNew()', () => {
    test('full flow creates hypothesis', () => {
      global.prompt
        .mockReturnValueOnce('My new hypothesis')
        .mockReturnValueOnce('Daily signups')
        .mockReturnValueOnce('50')
        .mockReturnValueOnce('signups/day');
      Tracker.addNew();
      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('My new hypothesis');
      expect(hyps[0].metric).toBe('Daily signups');
      expect(hyps[0].target).toBe(50);
      expect(hyps[0].unit).toBe('signups/day');
    });

    test('cancelled at statement does nothing', () => {
      global.prompt.mockReturnValueOnce(null);
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('empty statement does nothing', () => {
      global.prompt.mockReturnValueOnce('   ');
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('null target becomes 0', () => {
      global.prompt
        .mockReturnValueOnce('Hypothesis')
        .mockReturnValueOnce('Metric')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('');
      Tracker.addNew();
      expect(Store.getHypotheses()[0].target).toBe(0);
    });
  });

  describe('priority badge', () => {
    test('critical hypothesis shows priority badge', () => {
      addTestHyp({ priority: 'critical' });
      const c = renderTracker();
      expect(c.querySelector('.hyp-priority')).toBeTruthy();
      expect(c.querySelector('.hyp-priority').textContent).toBe('Critical');
    });

    test('non-critical hypothesis has no priority badge', () => {
      addTestHyp({ priority: 'important' });
      const c = renderTracker();
      expect(c.querySelector('.hyp-priority')).toBeNull();
    });
  });

  describe('timeframe display', () => {
    test('shows timeframe when set', () => {
      addTestHyp({ timeframe: 'First 3 months' });
      const c = renderTracker();
      expect(c.querySelector('.hyp-timeframe').textContent).toBe('First 3 months');
    });
  });
});
