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
  Store.saveBusiness({ name: 'Tracker Test', type: 'service', stage: 'validation' });
  Store.setWizardComplete();
});

describe('Tracker', () => {
  describe('addNew()', () => {
    test('adds hypothesis when user fills all prompts', () => {
      global.prompt
        .mockReturnValueOnce('Test assumption')  // statement
        .mockReturnValueOnce('Daily users')       // metric
        .mockReturnValueOnce('100')               // target
        .mockReturnValueOnce('users/day');         // unit

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('Test assumption');
      expect(hyps[0].metric).toBe('Daily users');
      expect(hyps[0].target).toBe(100);
      expect(hyps[0].unit).toBe('users/day');
      expect(hyps[0].category).toBe('value');
      expect(hyps[0].canvasElement).toBe('valueProp');
    });

    test('does nothing when statement is cancelled', () => {
      global.prompt.mockReturnValueOnce(null);
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('does nothing when statement is empty', () => {
      global.prompt.mockReturnValueOnce('   ');
      Tracker.addNew();
      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('handles null metric gracefully', () => {
      global.prompt
        .mockReturnValueOnce('Test assumption')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('50')
        .mockReturnValueOnce('');

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].metric).toBe('Metric');
    });

    test('handles null target gracefully', () => {
      global.prompt
        .mockReturnValueOnce('Test assumption')
        .mockReturnValueOnce('Metric')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('');

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].target).toBe(0);
    });

    test('re-renders app after adding hypothesis', () => {
      global.prompt
        .mockReturnValueOnce('New hyp')
        .mockReturnValueOnce('Count')
        .mockReturnValueOnce('10')
        .mockReturnValueOnce('items');

      // Setup app in tracker view
      window.location.hash = '#tracker';
      App.render();

      Tracker.addNew();

      // App should have re-rendered with the new hypothesis
      const app = document.getElementById('app');
      expect(app.querySelector('.hyp-card')).toBeTruthy();
    });
  });

  describe('filter buttons', () => {
    test('filter buttons render for all categories', () => {
      const container = document.createElement('div');
      Tracker.render(container);

      const filters = container.querySelectorAll('.filter-btn');
      const filterNames = Array.from(filters).map(f => f.dataset.filter);
      expect(filterNames).toContain('all');
      expect(filterNames).toContain('critical');
      expect(filterNames).toContain('customer');
      expect(filterNames).toContain('value');
      expect(filterNames).toContain('revenue');
    });

    test('clicking filter re-renders with filtered hypotheses', () => {
      Store.addHypothesis({ statement: 'Customer hyp', category: 'customer', status: 'testing' });
      Store.addHypothesis({ statement: 'Value hyp', category: 'value', status: 'testing' });

      const container = document.createElement('div');
      Tracker.render(container);

      // All hypotheses visible
      expect(container.querySelectorAll('.hyp-card').length).toBe(2);

      // Click customer filter
      const customerFilter = container.querySelector('[data-filter="customer"]');
      customerFilter.click();

      // Should only show customer hypothesis
      expect(container.querySelectorAll('.hyp-card').length).toBe(1);
    });
  });

  describe('hypothesis status change', () => {
    test('changing status via select updates store', () => {
      const hyp = Store.addHypothesis({ statement: 'Test', category: 'value', status: 'testing' });

      const container = document.createElement('div');
      Tracker.render(container);

      // Reset filter to 'all' in case prior test changed it
      const allFilter = container.querySelector('[data-filter="all"]');
      if (allFilter) allFilter.click();

      const select = container.querySelector('.hyp-status-select');
      select.value = 'validated';
      select.dispatchEvent(new Event('change'));

      const updated = Store.getHypotheses()[0];
      expect(updated.status).toBe('validated');
    });
  });

  describe('data logging', () => {
    test('log data button shows form', () => {
      Store.addHypothesis({ statement: 'Test', category: 'value', status: 'testing', target: 10 });

      const container = document.createElement('div');
      Tracker.render(container);

      // Reset filter to 'all' in case prior test changed it
      const allFilter = container.querySelector('[data-filter="all"]');
      if (allFilter) allFilter.click();

      const logBtn = container.querySelector('.btn-log');
      logBtn.click();

      expect(container.querySelector('.hyp-log-form')).toBeTruthy();
      expect(container.querySelector('.log-date')).toBeTruthy();
      expect(container.querySelector('.log-value')).toBeTruthy();
      expect(container.querySelector('.log-note')).toBeTruthy();
    });
  });

  describe('delete hypothesis', () => {
    test('delete button removes hypothesis after confirm', () => {
      global.confirm.mockReturnValueOnce(true);
      Store.addHypothesis({ statement: 'To delete', category: 'value', status: 'testing' });

      const container = document.createElement('div');
      Tracker.render(container);

      // Reset filter to 'all'
      const allFilter = container.querySelector('[data-filter="all"]');
      if (allFilter) allFilter.click();

      const deleteBtn = container.querySelector('.btn-delete-hyp');
      deleteBtn.click();

      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('delete button does not remove when user declines confirm', () => {
      global.confirm.mockReturnValueOnce(false);
      Store.addHypothesis({ statement: 'Keep me', category: 'value', status: 'testing' });

      const container = document.createElement('div');
      Tracker.render(container);

      // Reset filter to 'all'
      const allFilter = container.querySelector('[data-filter="all"]');
      if (allFilter) allFilter.click();

      const deleteBtn = container.querySelector('.btn-delete-hyp');
      deleteBtn.click();

      expect(Store.getHypotheses()).toHaveLength(1);
    });
  });

  describe('summary counts', () => {
    test('displays correct counts for all statuses', () => {
      Store.addHypothesis({ statement: 'H1', status: 'testing' });
      Store.addHypothesis({ statement: 'H2', status: 'testing' });
      Store.addHypothesis({ statement: 'H3', status: 'validated' });
      Store.addHypothesis({ statement: 'H4', status: 'invalidated' });

      const container = document.createElement('div');
      Tracker.render(container);

      const counts = container.querySelectorAll('.summary-count');
      const countValues = Array.from(counts).map(c => c.textContent);
      expect(countValues).toContain('4'); // total
      expect(countValues).toContain('2'); // testing
      expect(countValues).toContain('1'); // validated
    });
  });

  describe('action prompts', () => {
    test('renders action prompts section', () => {
      Store.addHypothesis({
        statement: 'Test hyp', category: 'customer', status: 'testing',
        createdAt: '2020-01-01', // stale
        actuals: [], target: 10, priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      expect(container.querySelector('.action-prompts')).toBeTruthy();
      expect(container.querySelector('.action-prompt-card')).toBeTruthy();
    });

    test('done button marks prompt as completed', () => {
      Store.addHypothesis({
        statement: 'Test', category: 'customer', status: 'testing',
        createdAt: '2020-01-01', actuals: [], target: 10, priority: 'critical'
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

    test('dismiss button marks prompt as dismissed', () => {
      Store.addHypothesis({
        statement: 'Test', category: 'customer', status: 'testing',
        createdAt: '2020-01-01', actuals: [], target: 10, priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      const dismissBtn = container.querySelector('.action-prompt-dismiss');
      if (dismissBtn) {
        dismissBtn.click();
        const state = Store.getPromptState();
        expect(state.dismissed.length).toBeGreaterThan(0);
      }
    });
  });

  describe('lean tip', () => {
    test('shows go to canvas tip when no hypotheses', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('Canvas');
    });

    test('shows start testing tip when testing but none validated', () => {
      Store.addHypothesis({ statement: 'H', status: 'testing' });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('critical assumptions');
    });

    test('shows good progress tip when more validated than invalidated', () => {
      Store.addHypothesis({ statement: 'H1', status: 'validated' });
      Store.addHypothesis({ statement: 'H2', status: 'validated' });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('Good progress');
    });
  });
});
