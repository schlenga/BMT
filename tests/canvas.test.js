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

describe('Canvas', () => {
  describe('ELEMENTS', () => {
    test('has 9 business model canvas elements', () => {
      expect(Canvas.ELEMENTS).toHaveLength(9);
    });

    test('each element has key, label, icon, hint', () => {
      Canvas.ELEMENTS.forEach(el => {
        expect(el.key).toBeTruthy();
        expect(el.label).toBeTruthy();
        expect(el.icon).toBeTruthy();
        expect(el.hint).toBeTruthy();
      });
    });

    test('element keys match store canvas keys', () => {
      const canvas = Store.getCanvas();
      Canvas.ELEMENTS.forEach(el => {
        expect(canvas).toHaveProperty(el.key);
      });
    });

    test('contains all expected BMC element keys', () => {
      const keys = Canvas.ELEMENTS.map(e => e.key);
      expect(keys).toContain('customerSegments');
      expect(keys).toContain('valueProp');
      expect(keys).toContain('channels');
      expect(keys).toContain('customerRelationships');
      expect(keys).toContain('revenueStreams');
      expect(keys).toContain('keyResources');
      expect(keys).toContain('keyActivities');
      expect(keys).toContain('keyPartners');
      expect(keys).toContain('costStructure');
    });
  });

  describe('render()', () => {
    test('renders canvas grid into container', () => {
      Store.saveBusiness({ name: 'Test Biz' });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelector('.bmc-grid')).toBeTruthy();
      expect(container.querySelector('.canvas-header')).toBeTruthy();
    });

    test('renders business name as title', () => {
      Store.saveBusiness({ name: 'My Coffee Shop' });
      const container = document.createElement('div');
      Canvas.render(container);
      const title = container.querySelector('.page-title');
      expect(title.textContent).toContain('My Coffee Shop');
    });

    test('renders default title when no business', () => {
      const container = document.createElement('div');
      Canvas.render(container);
      const title = container.querySelector('.page-title');
      expect(title.textContent).toContain('Business Model Canvas');
    });

    test('renders canvas items', () => {
      Store.addCanvasItem('customerSegments', 'Young professionals');
      Store.addCanvasItem('customerSegments', 'Students');
      const container = document.createElement('div');
      Canvas.render(container);
      const items = container.querySelectorAll('.bmc-item');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    test('renders add buttons for each element', () => {
      const container = document.createElement('div');
      Canvas.render(container);
      const addBtns = container.querySelectorAll('.bmc-add');
      expect(addBtns).toHaveLength(9);
    });

    test('renders hypothesis badge count', () => {
      Store.addHypothesis({
        canvasElement: 'customerSegments',
        category: 'customer',
        statement: 'Test',
        status: 'testing',
        actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      const badges = container.querySelectorAll('.bmc-hyp-badge');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      expect(badges[0].textContent).toBe('1');
    });

    test('badge shows correct count for multiple hypotheses', () => {
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'H1', status: 'testing', actuals: [] });
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'H2', status: 'validated', actuals: [] });
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'H3', status: 'invalidated', actuals: [] });
      const container = document.createElement('div');
      Canvas.render(container);
      const badges = container.querySelectorAll('.bmc-hyp-badge');
      const valueBadge = Array.from(badges).find(b => b.textContent === '3');
      expect(valueBadge).toBeTruthy();
    });

    test('add button calls prompt and adds to store', () => {
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

    test('add button does nothing when prompt cancelled', () => {
      const container = document.createElement('div');
      Canvas.render(container);

      global.prompt.mockReturnValueOnce(null);
      const addBtns = container.querySelectorAll('.bmc-add');
      addBtns[0].click();

      const canvas = Store.getCanvas();
      const allItems = Object.values(canvas).flat();
      expect(allItems).toHaveLength(0);
    });

    test('add button does nothing on empty/whitespace input', () => {
      const container = document.createElement('div');
      Canvas.render(container);

      global.prompt.mockReturnValueOnce('   ');
      const addBtns = container.querySelectorAll('.bmc-add');
      addBtns[0].click();

      const canvas = Store.getCanvas();
      const allItems = Object.values(canvas).flat();
      expect(allItems).toHaveLength(0);
    });

    test('clicking item enters edit mode', () => {
      Store.addCanvasItem('customerSegments', 'Young professionals');
      const container = document.createElement('div');
      Canvas.render(container);

      const item = container.querySelector('.bmc-item');
      item.click();

      const editInput = container.querySelector('.bmc-edit-input');
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Young professionals');
    });

    test('save edit updates store', () => {
      const added = Store.addCanvasItem('channels', 'Social media');
      const container = document.createElement('div');
      Canvas.render(container);

      const item = container.querySelector('.bmc-item');
      item.click();

      const editInput = container.querySelector('.bmc-edit-input');
      editInput.value = 'Instagram';
      const saveBtn = container.querySelector('.bmc-save');
      saveBtn.click();

      const canvas = Store.getCanvas();
      expect(canvas.channels[0].text).toBe('Instagram');
    });

    test('enter key in edit input saves', () => {
      Store.addCanvasItem('valueProp', 'Original value');
      const container = document.createElement('div');
      Canvas.render(container);

      container.querySelector('.bmc-item').click();
      const editInput = container.querySelector('.bmc-edit-input');
      editInput.value = 'Updated value';
      editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      const canvas = Store.getCanvas();
      expect(canvas.valueProp[0].text).toBe('Updated value');
    });

    test('escape key in edit input cancels', () => {
      Store.addCanvasItem('valueProp', 'Original');
      const container = document.createElement('div');
      Canvas.render(container);

      container.querySelector('.bmc-item').click();
      const editInput = container.querySelector('.bmc-edit-input');
      editInput.value = 'Changed';
      editInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      const canvas = Store.getCanvas();
      expect(canvas.valueProp[0].text).toBe('Original');
      expect(container.querySelector('.bmc-edit-input')).toBeNull();
    });

    test('delete button removes item', () => {
      Store.addCanvasItem('costStructure', 'Rent');
      Store.addCanvasItem('costStructure', 'Staff');
      const container = document.createElement('div');
      Canvas.render(container);

      const items = container.querySelectorAll('.bmc-item');
      items[0].click();

      const deleteBtn = container.querySelector('.bmc-delete');
      deleteBtn.click();

      const canvas = Store.getCanvas();
      expect(canvas.costStructure).toHaveLength(1);
      expect(canvas.costStructure[0].text).toBe('Staff');
    });

    test('uses adaptive terminology for restaurant type', () => {
      Store.saveBusiness({ name: 'Test Cafe', type: 'restaurant' });
      const container = document.createElement('div');
      Canvas.render(container);
      const labels = container.querySelectorAll('.bmc-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Your Guests');
      expect(labelTexts).toContain('Why They Come Back');
    });

    test('uses adaptive terminology for saas type', () => {
      Store.saveBusiness({ name: 'SaaS Co', type: 'saas' });
      const container = document.createElement('div');
      Canvas.render(container);
      const labels = container.querySelectorAll('.bmc-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Your Users');
      expect(labelTexts).toContain('Burn Rate');
    });

    test('renders status-testing class for testing hypotheses', () => {
      Store.addCanvasItem('valueProp', 'Great coffee');
      Store.addHypothesis({
        canvasElement: 'valueProp', category: 'value',
        statement: 'People love it', status: 'testing', actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelectorAll('.status-testing').length).toBeGreaterThanOrEqual(1);
    });

    test('renders status-risk class for invalidated hypotheses', () => {
      Store.addCanvasItem('valueProp', 'Fast delivery');
      Store.addHypothesis({
        canvasElement: 'valueProp', category: 'value',
        statement: 'Customers want fast delivery', status: 'invalidated', actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelectorAll('.status-risk').length).toBeGreaterThanOrEqual(1);
    });

    test('renders status-validated class when all validated', () => {
      Store.addCanvasItem('channels', 'Word of mouth');
      Store.addHypothesis({
        canvasElement: 'channels', category: 'growth',
        statement: 'WOM works', status: 'validated', actuals: []
      });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelectorAll('.status-validated').length).toBeGreaterThanOrEqual(1);
    });

    test('empty canvas renders without errors', () => {
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.querySelector('.bmc-grid')).toBeTruthy();
      const items = container.querySelectorAll('.bmc-item');
      expect(items).toHaveLength(0);
    });

    test('multiple items in same element', () => {
      Store.addCanvasItem('keyActivities', 'Activity 1');
      Store.addCanvasItem('keyActivities', 'Activity 2');
      Store.addCanvasItem('keyActivities', 'Activity 3');
      const container = document.createElement('div');
      Canvas.render(container);
      const texts = Array.from(container.querySelectorAll('.bmc-item-text')).map(t => t.textContent);
      expect(texts).toContain('Activity 1');
      expect(texts).toContain('Activity 2');
      expect(texts).toContain('Activity 3');
    });

    test('escapes HTML in item text', () => {
      Store.addCanvasItem('valueProp', '<script>alert("xss")</script>');
      const container = document.createElement('div');
      Canvas.render(container);
      const text = container.querySelector('.bmc-item-text');
      expect(text.textContent).toContain('<script>');
      expect(container.innerHTML).not.toContain('<script>alert');
    });

    test('escapes HTML in business name', () => {
      Store.saveBusiness({ name: '<b>Evil</b>' });
      const container = document.createElement('div');
      Canvas.render(container);
      expect(container.innerHTML).not.toContain('<b>Evil</b>');
    });
  });
});
