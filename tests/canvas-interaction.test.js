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

describe('Canvas — interaction flows', () => {

  describe('item editing', () => {
    test('clicking an item enters edit mode', () => {
      Store.addCanvasItem('customerSegments', 'Young professionals');
      const container = document.createElement('div');
      Canvas.render(container);

      const item = container.querySelector('.bmc-item');
      item.click();

      // After click, re-render should show edit input
      const editInput = container.querySelector('.bmc-edit-input');
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Young professionals');
    });

    test('save button updates item text', () => {
      const item = Store.addCanvasItem('valueProp', 'Old text');
      const container = document.createElement('div');
      Canvas.render(container);

      // Enter edit mode
      const bmcItem = container.querySelector('.bmc-item');
      bmcItem.click();

      // Change text and save
      const input = container.querySelector('.bmc-edit-input');
      input.value = 'New text';
      const saveBtn = container.querySelector('.bmc-save');
      saveBtn.click();

      // Verify store updated
      const canvas = Store.getCanvas();
      expect(canvas.valueProp[0].text).toBe('New text');
    });

    test('delete button removes item', () => {
      Store.addCanvasItem('channels', 'Social media');
      Store.addCanvasItem('channels', 'Email');
      const container = document.createElement('div');
      Canvas.render(container);

      // Enter edit mode on first item
      const items = container.querySelectorAll('.bmc-item');
      items[0].click();

      // Click delete
      const deleteBtn = container.querySelector('.bmc-delete');
      deleteBtn.click();

      const canvas = Store.getCanvas();
      expect(canvas.channels).toHaveLength(1);
      expect(canvas.channels[0].text).toBe('Email');
    });

    test('Enter key saves edit', () => {
      Store.addCanvasItem('keyActivities', 'Original task');
      const container = document.createElement('div');
      Canvas.render(container);

      const item = container.querySelector('.bmc-item');
      item.click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = 'Updated task';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      const canvas = Store.getCanvas();
      expect(canvas.keyActivities[0].text).toBe('Updated task');
    });

    test('Escape key cancels edit', () => {
      Store.addCanvasItem('keyResources', 'My resource');
      const container = document.createElement('div');
      Canvas.render(container);

      const item = container.querySelector('.bmc-item');
      item.click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = 'Changed text';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Text should remain unchanged
      const canvas = Store.getCanvas();
      expect(canvas.keyResources[0].text).toBe('My resource');
    });
  });

  describe('add item flow', () => {
    test('add button prompts for text and adds to correct element', () => {
      global.prompt.mockReturnValueOnce('New partner');
      const container = document.createElement('div');
      Canvas.render(container);

      const addBtns = container.querySelectorAll('.bmc-add');
      let partnerAdd = null;
      addBtns.forEach(btn => {
        if (btn.dataset.element === 'keyPartners') partnerAdd = btn;
      });
      partnerAdd.click();

      const canvas = Store.getCanvas();
      expect(canvas.keyPartners).toHaveLength(1);
      expect(canvas.keyPartners[0].text).toBe('New partner');
    });

    test('add with empty text does nothing', () => {
      global.prompt.mockReturnValueOnce('   ');
      const container = document.createElement('div');
      Canvas.render(container);

      const addBtns = container.querySelectorAll('.bmc-add');
      let segAdd = null;
      addBtns.forEach(btn => {
        if (btn.dataset.element === 'customerSegments') segAdd = btn;
      });
      segAdd.click();

      const canvas = Store.getCanvas();
      expect(canvas.customerSegments).toHaveLength(0);
    });

    test('add with cancelled prompt does nothing', () => {
      global.prompt.mockReturnValueOnce(null);
      const container = document.createElement('div');
      Canvas.render(container);

      const addBtns = container.querySelectorAll('.bmc-add');
      addBtns[0].click();

      // No items added to any canvas element
      const canvas = Store.getCanvas();
      const allItems = Object.values(canvas).reduce((sum, arr) => sum + arr.length, 0);
      expect(allItems).toBe(0);
    });
  });

  describe('hypothesis status indicators', () => {
    test('validated status shows status-validated class', () => {
      Store.addCanvasItem('valueProp', 'Proven value');
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Customers love it',
        status: 'validated',
        actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);

      const validated = container.querySelectorAll('.status-validated');
      expect(validated.length).toBeGreaterThanOrEqual(1);
    });

    test('mixed statuses show highest-priority status', () => {
      Store.addCanvasItem('channels', 'Instagram');
      Store.addHypothesis({
        canvasElement: 'channels', category: 'growth',
        statement: 'Good channel', status: 'validated', actuals: []
      });
      Store.addHypothesis({
        canvasElement: 'channels', category: 'growth',
        statement: 'Bad channel', status: 'invalidated', actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);

      // Invalidated takes precedence → status-risk
      const risk = container.querySelectorAll('.status-risk');
      expect(risk.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('adaptive terminology', () => {
    test('ecommerce type uses buyer terminology', () => {
      Store.saveBusiness({ name: 'E-Shop', type: 'ecommerce' });
      const container = document.createElement('div');
      Canvas.render(container);

      const labels = container.querySelectorAll('.bmc-label');
      const texts = Array.from(labels).map(l => l.textContent);
      expect(texts).toContain('Your Buyers');
    });

    test('subscription type uses member terminology', () => {
      Store.saveBusiness({ name: 'Sub Box', type: 'subscription' });
      const container = document.createElement('div');
      Canvas.render(container);

      const labels = container.querySelectorAll('.bmc-label');
      const texts = Array.from(labels).map(l => l.textContent);
      expect(texts).toContain('Your Members');
    });
  });
});

describe('Tracker — interaction flows', () => {

  describe('filter buttons', () => {
    test('clicking filter updates displayed hypotheses', () => {
      Store.addHypothesis({
        statement: 'Customer hyp', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'critical'
      });
      Store.addHypothesis({
        statement: 'Revenue hyp', category: 'revenue',
        canvasElement: 'revenueStreams', status: 'testing',
        target: 1000, actuals: [], priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      // All hypotheses visible initially
      let cards = container.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(2);

      // Click customer filter
      const filterBtns = container.querySelectorAll('.filter-btn');
      let customerFilter = null;
      filterBtns.forEach(btn => {
        if (btn.dataset.filter === 'customer') customerFilter = btn;
      });
      customerFilter.click();

      // Now only customer hypothesis visible
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
        statement: 'Important one', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      const filterBtns = container.querySelectorAll('.filter-btn');
      let critFilter = null;
      filterBtns.forEach(btn => {
        if (btn.dataset.filter === 'critical') critFilter = btn;
      });
      critFilter.click();

      const cards = container.querySelectorAll('.hyp-card');
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain('Critical one');
    });
  });

  describe('status change', () => {
    test('changing status via select updates store', () => {
      const hyp = Store.addHypothesis({
        statement: 'Test hyp', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      const select = container.querySelector('.hyp-status-select');
      expect(select).toBeTruthy();
      select.value = 'validated';
      select.dispatchEvent(new Event('change'));

      const updated = Store.getHypotheses()[0];
      expect(updated.status).toBe('validated');
    });
  });

  describe('delete hypothesis', () => {
    test('delete button removes hypothesis after confirm', () => {
      Store.addHypothesis({
        statement: 'To be deleted', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });

      const container = document.createElement('div');
      // Click 'all' filter to reset any leftover filter state
      Tracker.render(container);
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      const deleteBtn = container.querySelector('.btn-delete-hyp');
      expect(deleteBtn).toBeTruthy();
      deleteBtn.click();

      expect(Store.getHypotheses()).toHaveLength(0);
    });

    test('delete cancelled does not remove hypothesis', () => {
      Store.addHypothesis({
        statement: 'Not deleted', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'important'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      global.confirm.mockReturnValueOnce(false);
      const deleteBtn = container.querySelector('.btn-delete-hyp');
      expect(deleteBtn).toBeTruthy();
      deleteBtn.click();

      expect(Store.getHypotheses()).toHaveLength(1);
    });
  });

  describe('log data flow', () => {
    test('log button reveals log form', () => {
      Store.addHypothesis({
        statement: 'Test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      const logBtn = container.querySelector('.btn-log');
      logBtn.click();

      expect(container.querySelector('.hyp-log-form')).toBeTruthy();
    });

    test('saving log data adds actual to hypothesis', () => {
      const hyp = Store.addHypothesis({
        statement: 'Log test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 100, actuals: [], priority: 'critical'
      });

      // Must use a container attached to the document so getElementById works
      const container = document.getElementById('app');
      Tracker.render(container);
      // Reset filter to 'all'
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      // Open log form
      const logBtn = container.querySelector('.btn-log');
      expect(logBtn).toBeTruthy();
      logBtn.click();

      // Fill in value — use getElementById since tracker uses it internally
      const valueInput = document.getElementById('log-value-' + hyp.id);
      expect(valueInput).toBeTruthy();
      valueInput.value = '42';
      const noteInput = document.getElementById('log-note-' + hyp.id);
      noteInput.value = 'First reading';

      // Save
      const saveBtn = container.querySelector('.btn-log-save');
      saveBtn.click();

      const updated = Store.getHypotheses()[0];
      expect(updated.actuals).toHaveLength(1);
      expect(updated.actuals[0].value).toBe(42);
      expect(updated.actuals[0].note).toBe('First reading');
    });

    test('cancel button hides log form', () => {
      const hyp = Store.addHypothesis({
        statement: 'Cancel test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);
      const allFilter = container.querySelector('.filter-btn[data-filter="all"]');
      if (allFilter) allFilter.click();

      container.querySelector('.btn-log').click();
      expect(container.querySelector('.hyp-log-form')).toBeTruthy();

      container.querySelector('.btn-log-cancel').click();
      expect(container.querySelector('.hyp-log-form')).toBeFalsy();
    });
  });

  describe('action prompts', () => {
    test('action prompts section renders for hypotheses', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      Store.addHypothesis({
        statement: 'Prompt test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        createdAt: oldDate.toISOString().slice(0, 10),
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      const prompts = container.querySelectorAll('.action-prompt-card');
      expect(prompts.length).toBeGreaterThan(0);
    });

    test('dismiss button removes prompt', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      Store.addHypothesis({
        id: 'test-dismiss',
        statement: 'Dismiss test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        createdAt: oldDate.toISOString().slice(0, 10),
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      const dismissBtns = container.querySelectorAll('.action-prompt-dismiss');
      if (dismissBtns.length > 0) {
        const key = dismissBtns[0].dataset.key;
        dismissBtns[0].click();
        const state = Store.getPromptState();
        expect(state.dismissed).toContain(key);
      }
    });

    test('done button marks prompt as completed', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      Store.addHypothesis({
        id: 'test-done',
        statement: 'Done test', category: 'customer',
        canvasElement: 'customerSegments', status: 'testing',
        createdAt: oldDate.toISOString().slice(0, 10),
        target: 10, actuals: [], priority: 'critical'
      });

      const container = document.createElement('div');
      Tracker.render(container);

      const doneBtns = container.querySelectorAll('.action-prompt-done-btn');
      if (doneBtns.length > 0) {
        const key = doneBtns[0].dataset.key;
        doneBtns[0].click();
        const state = Store.getPromptState();
        expect(state.completed.some(c => c.key === key)).toBe(true);
      }
    });
  });

  describe('addNew()', () => {
    test('adds hypothesis through prompt dialog flow', () => {
      const container = document.createElement('div');
      document.getElementById('app').appendChild(container);

      global.prompt
        .mockReturnValueOnce('My new hypothesis')    // statement
        .mockReturnValueOnce('Revenue per month')     // metric
        .mockReturnValueOnce('5000')                  // target
        .mockReturnValueOnce('$/month');              // unit

      Tracker.addNew();

      const hyps = Store.getHypotheses();
      expect(hyps).toHaveLength(1);
      expect(hyps[0].statement).toBe('My new hypothesis');
      expect(hyps[0].metric).toBe('Revenue per month');
      expect(hyps[0].target).toBe(5000);
      expect(hyps[0].unit).toBe('$/month');
    });
  });

  describe('lean tips', () => {
    test('shows canvas link when no hypotheses', () => {
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('Canvas');
    });

    test('shows testing tip when only testing hypotheses exist', () => {
      Store.addHypothesis({
        statement: 'Testing only', category: 'value',
        canvasElement: 'valueProp', status: 'testing',
        target: 10, actuals: [], priority: 'critical'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('critical assumptions');
    });

    test('shows validation tip when more validated than invalidated', () => {
      Store.addHypothesis({
        statement: 'Good one', category: 'value',
        canvasElement: 'valueProp', status: 'validated',
        target: 10, actuals: [], priority: 'critical'
      });
      const container = document.createElement('div');
      Tracker.render(container);
      const tip = container.querySelector('.lean-tip');
      expect(tip.textContent).toContain('validation');
    });
  });
});
