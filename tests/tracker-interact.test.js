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

function addTestHypotheses() {
  Store.addHypothesis({
    id: 'cust-1', statement: 'Customers will come', category: 'customer',
    canvasElement: 'customerSegments', status: 'testing',
    target: 50, unit: 'people', actuals: [], priority: 'critical',
    createdAt: new Date().toISOString().slice(0, 10)
  });
  Store.addHypothesis({
    id: 'val-1', statement: 'Value prop works', category: 'value',
    canvasElement: 'valueProp', status: 'validated',
    target: 10, unit: 'score', actuals: [{ date: '2025-01-15', value: 9, note: 'Good' }],
    priority: 'important', createdAt: '2025-01-01'
  });
  Store.addHypothesis({
    id: 'rev-1', statement: 'Revenue will grow', category: 'revenue',
    canvasElement: 'revenueStreams', status: 'invalidated',
    target: 5000, unit: '$/mo', actuals: [{ date: '2025-01-15', value: 500, note: 'Low' }],
    priority: 'critical', createdAt: '2025-01-01'
  });
}

function renderTracker() {
  Store.saveBusiness({ name: 'Test Biz', type: 'service', stage: 'validation' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  Tracker.render(container);
  return container;
}

// Helper: ensure filter is reset to 'all' by clicking the All button
function resetFilter(container) {
  const allBtn = container.querySelector('.filter-btn[data-filter="all"]');
  if (allBtn) allBtn.click();
}

describe('Tracker interactions', () => {
  describe('log data', () => {
    test('clicking Log Data shows log form', () => {
      Store.addHypothesis({
        id: 'log-show', statement: 'Test log show', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      const logBtn = container.querySelector('.btn-log');
      expect(logBtn).toBeTruthy();
      logBtn.click();

      expect(container.querySelector('.hyp-log-form')).toBeTruthy();
      expect(container.querySelector('.log-value')).toBeTruthy();
      expect(container.querySelector('.log-date')).toBeTruthy();
      expect(container.querySelector('.log-note')).toBeTruthy();
    });

    test('clicking Log Data again hides form (toggle)', () => {
      Store.addHypothesis({
        id: 'log-toggle', statement: 'Test toggle', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      container.querySelector('.btn-log').click();
      expect(container.querySelector('.hyp-log-form')).toBeTruthy();

      // Click same button again to toggle off
      container.querySelector('.btn-log').click();
      expect(container.querySelector('.hyp-log-form')).toBeFalsy();
    });

    test('saving log data adds actual to hypothesis', () => {
      Store.addHypothesis({
        id: 'log-test', statement: 'Test log', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      container.querySelector('.btn-log').click();

      const valueInput = container.querySelector('#log-value-log-test');
      expect(valueInput).toBeTruthy();
      valueInput.value = '25';

      container.querySelector('.btn-log-save').click();

      const hyps = Store.getHypotheses();
      expect(hyps[0].actuals).toHaveLength(1);
      expect(hyps[0].actuals[0].value).toBe(25);
    });

    test('cancel button hides log form', () => {
      Store.addHypothesis({
        id: 'cancel-test', statement: 'Test cancel', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      container.querySelector('.btn-log').click();
      expect(container.querySelector('.hyp-log-form')).toBeTruthy();

      container.querySelector('.btn-log-cancel').click();
      expect(container.querySelector('.hyp-log-form')).toBeFalsy();
    });

    test('saving without value does nothing', () => {
      Store.addHypothesis({
        id: 'noval-test', statement: 'No value', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, unit: 'score', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      container.querySelector('.btn-log').click();
      container.querySelector('.btn-log-save').click();

      const hyps = Store.getHypotheses();
      expect(hyps[0].actuals).toHaveLength(0);
    });
  });

  describe('status change', () => {
    test('changing status select updates hypothesis', () => {
      Store.addHypothesis({
        id: 'status-test', statement: 'Status change', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, unit: 'score', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      const select = container.querySelector('.hyp-status-select');
      expect(select).toBeTruthy();
      select.value = 'validated';
      select.dispatchEvent(new Event('change'));

      const hyps = Store.getHypotheses();
      expect(hyps[0].status).toBe('validated');
    });
  });

  describe('delete hypothesis', () => {
    test('delete button removes hypothesis after confirm', () => {
      Store.addHypothesis({
        id: 'del-1', statement: 'Delete me', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, unit: 'score', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      Store.addHypothesis({
        id: 'del-2', statement: 'Keep me', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, unit: 'score', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      const deleteBtns = container.querySelectorAll('.btn-delete-hyp');
      expect(deleteBtns.length).toBe(2);

      global.confirm.mockReturnValueOnce(true);
      deleteBtns[0].click();

      const hyps = Store.getHypotheses();
      expect(hyps.length).toBe(1);
    });

    test('cancelling delete keeps hypothesis', () => {
      Store.addHypothesis({
        id: 'nodelete', statement: 'Keep me', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      resetFilter(container);

      global.confirm.mockReturnValueOnce(false);
      container.querySelector('.btn-delete-hyp').click();

      const hyps = Store.getHypotheses();
      expect(hyps.length).toBe(1);
    });
  });

  describe('filter buttons', () => {
    test('clicking Critical filter shows only critical hypotheses', () => {
      addTestHypotheses();
      const container = renderTracker();
      resetFilter(container);

      const criticalBtn = container.querySelector('.filter-btn[data-filter="critical"]');
      criticalBtn.click();

      const cards = container.querySelectorAll('.hyp-card');
      expect(cards.length).toBe(2); // cust-1 and rev-1 are critical
    });

    test('clicking customer filter shows only customer hypotheses', () => {
      addTestHypotheses();
      const container = renderTracker();
      resetFilter(container);

      const custBtn = container.querySelector('.filter-btn[data-filter="customer"]');
      custBtn.click();

      const cards = container.querySelectorAll('.hyp-card');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('Customers will come');
    });

    test('clicking All filter shows all hypotheses', () => {
      addTestHypotheses();
      const container = renderTracker();

      // Set filter to customer first
      container.querySelector('.filter-btn[data-filter="customer"]').click();
      expect(container.querySelectorAll('.hyp-card').length).toBe(1);

      // Switch back to all
      container.querySelector('.filter-btn[data-filter="all"]').click();
      expect(container.querySelectorAll('.hyp-card').length).toBe(3);
    });

    test('empty filter shows empty state message', () => {
      addTestHypotheses();
      const container = renderTracker();
      resetFilter(container);

      container.querySelector('.filter-btn[data-filter="growth"]').click();
      expect(container.querySelector('.tracker-empty')).toBeTruthy();
    });
  });

  describe('addNew()', () => {
    test('addNew creates hypothesis with user inputs', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Test', type: 'service', stage: 'validation' });
      window.location.hash = '#tracker';
      App.render();

      global.prompt
        .mockReturnValueOnce('My new hypothesis')
        .mockReturnValueOnce('Revenue per month')
        .mockReturnValueOnce('1000')
        .mockReturnValueOnce('$/month');

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('My new hypothesis');
      expect(hyps[0].metric).toBe('Revenue per month');
      expect(hyps[0].target).toBe(1000);
      expect(hyps[0].unit).toBe('$/month');
    });

    test('addNew with cancelled statement does nothing', () => {
      Store.saveBusiness({ name: 'Test', type: 'service' });

      global.prompt.mockReturnValueOnce(null);
      Tracker.addNew();

      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('addNew calls App.render to preserve nav', () => {
      Store.setWizardComplete();
      Store.saveBusiness({ name: 'Nav Test', type: 'service', stage: 'validation' });
      window.location.hash = '#tracker';
      App.render();

      global.prompt
        .mockReturnValueOnce('Test')
        .mockReturnValueOnce('Metric')
        .mockReturnValueOnce('10')
        .mockReturnValueOnce('units');

      Tracker.addNew();

      const app = document.getElementById('app');
      expect(app.querySelector('.main-nav')).toBeTruthy();
    });
  });

  describe('action prompts', () => {
    test('action prompts section renders for testing hypotheses', () => {
      Store.addHypothesis({
        id: 'prompt-test', statement: 'Test prompt', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();

      const prompts = container.querySelector('.action-prompts');
      expect(prompts).toBeTruthy();
    });

    test('done button on action prompt completes it', () => {
      Store.addHypothesis({
        id: 'done-test', statement: 'Customers will come', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();

      const doneBtn = container.querySelector('.action-prompt-done-btn');
      if (doneBtn) {
        const key = doneBtn.dataset.key;
        doneBtn.click();

        const state = Store.getPromptState();
        expect(state.completed.some(c => c.key === key)).toBe(true);
      }
    });

    test('dismiss button on action prompt dismisses it', () => {
      Store.addHypothesis({
        id: 'dismiss-test', statement: 'Test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 50, unit: 'people', actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();

      const dismissBtn = container.querySelector('.action-prompt-dismiss');
      if (dismissBtn) {
        const key = dismissBtn.dataset.key;
        dismissBtn.click();

        const state = Store.getPromptState();
        expect(state.dismissed).toContain(key);
      }
    });
  });

  describe('summary counts', () => {
    test('summary counts reflect correct totals', () => {
      addTestHypotheses();
      const container = renderTracker();

      const counts = container.querySelectorAll('.summary-count');
      expect(counts[0].textContent).toBe('3');  // total
      expect(counts[1].textContent).toBe('1');  // testing (cust-1)
      expect(counts[2].textContent).toBe('1');  // validated (val-1)
      expect(counts[3].textContent).toBe('1');  // invalidated (rev-1)
    });
  });

  describe('lean tips', () => {
    test('no hypotheses tip points to canvas', () => {
      const container = renderTracker();
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('Canvas');
    });

    test('testing-only tip encourages measurement', () => {
      Store.addHypothesis({
        id: 't1', statement: 'Test', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('critical assumptions');
    });

    test('invalidated tip suggests learning', () => {
      Store.addHypothesis({
        id: 'inv', statement: 'Wrong', category: 'value',
        canvasElement: 'valueProp', status: 'invalidated',
        target: 10, actuals: [], priority: 'critical',
        createdAt: new Date().toISOString().slice(0, 10)
      });
      const container = renderTracker();
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('wrong');
    });
  });
});
