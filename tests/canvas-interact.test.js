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

function renderCanvas() {
  Store.saveBusiness({ name: 'Test Biz', type: 'service' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  Canvas.render(container);
  return container;
}

describe('Canvas interactions', () => {
  describe('click to edit', () => {
    test('clicking an item enters edit mode', () => {
      Store.addCanvasItem('valueProp', 'Great service');
      const container = renderCanvas();

      const item = container.querySelector('.bmc-item');
      expect(item).toBeTruthy();
      item.click();

      // After click, should re-render with edit input
      const editInput = container.querySelector('.bmc-edit-input');
      expect(editInput).toBeTruthy();
      expect(editInput.value).toBe('Great service');
    });

    test('edit mode shows save and delete buttons', () => {
      Store.addCanvasItem('valueProp', 'Great service');
      const container = renderCanvas();

      container.querySelector('.bmc-item').click();

      expect(container.querySelector('.bmc-save')).toBeTruthy();
      expect(container.querySelector('.bmc-delete')).toBeTruthy();
    });
  });

  describe('save edit', () => {
    test('save button updates item text', () => {
      Store.addCanvasItem('valueProp', 'Old text');
      const container = renderCanvas();

      // Enter edit mode
      container.querySelector('.bmc-item').click();

      // Change text
      const input = container.querySelector('.bmc-edit-input');
      input.value = 'New text';

      // Click save
      container.querySelector('.bmc-save').click();

      // Verify in store
      const canvas = Store.getCanvas();
      expect(canvas.valueProp[0].text).toBe('New text');

      // Verify in rendered output
      const items = container.querySelectorAll('.bmc-item');
      expect(items[0].textContent).toContain('New text');
    });

    test('save with empty text keeps old text', () => {
      const item = Store.addCanvasItem('valueProp', 'Keep this');
      const container = renderCanvas();

      container.querySelector('.bmc-item').click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = '   ';

      container.querySelector('.bmc-save').click();

      const canvas = Store.getCanvas();
      expect(canvas.valueProp[0].text).toBe('Keep this');
    });
  });

  describe('keyboard shortcuts in edit mode', () => {
    test('Enter key saves the edit', () => {
      Store.addCanvasItem('channels', 'Social media');
      const container = renderCanvas();

      container.querySelector('.bmc-item').click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = 'Instagram';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      const canvas = Store.getCanvas();
      expect(canvas.channels[0].text).toBe('Instagram');
    });

    test('Escape key cancels the edit', () => {
      Store.addCanvasItem('channels', 'Original');
      const container = renderCanvas();

      container.querySelector('.bmc-item').click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = 'Changed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Text should still be 'Original'
      const canvas = Store.getCanvas();
      expect(canvas.channels[0].text).toBe('Original');

      // Should exit edit mode
      expect(container.querySelector('.bmc-edit-input')).toBeFalsy();
    });

    test('Enter with empty text does not update', () => {
      Store.addCanvasItem('channels', 'Keep me');
      const container = renderCanvas();

      container.querySelector('.bmc-item').click();

      const input = container.querySelector('.bmc-edit-input');
      input.value = '';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      const canvas = Store.getCanvas();
      expect(canvas.channels[0].text).toBe('Keep me');
    });
  });

  describe('delete item', () => {
    test('delete button removes item from store', () => {
      Store.addCanvasItem('costStructure', 'Rent');
      Store.addCanvasItem('costStructure', 'Staff');
      const container = renderCanvas();

      // Click on first item to enter edit mode
      const items = container.querySelectorAll('.bmc-item');
      items[0].click();

      // Click delete
      container.querySelector('.bmc-delete').click();

      const canvas = Store.getCanvas();
      expect(canvas.costStructure).toHaveLength(1);
      expect(canvas.costStructure[0].text).toBe('Staff');
    });
  });

  describe('add new item', () => {
    test('add button triggers prompt and adds item', () => {
      const container = renderCanvas();

      global.prompt.mockReturnValueOnce('New partner');

      const addBtns = container.querySelectorAll('.bmc-add');
      let partnerBtn = null;
      addBtns.forEach(btn => {
        if (btn.dataset.element === 'keyPartners') partnerBtn = btn;
      });
      partnerBtn.click();

      const canvas = Store.getCanvas();
      expect(canvas.keyPartners).toHaveLength(1);
      expect(canvas.keyPartners[0].text).toBe('New partner');
    });

    test('add with cancelled prompt does nothing', () => {
      const container = renderCanvas();

      global.prompt.mockReturnValueOnce(null);

      const addBtns = container.querySelectorAll('.bmc-add');
      addBtns[0].click();

      // Should have no items in that element
      const canvas = Store.getCanvas();
      const key = addBtns[0].dataset.element;
      expect(canvas[key]).toHaveLength(0);
    });

    test('add with whitespace-only prompt does nothing', () => {
      const container = renderCanvas();

      global.prompt.mockReturnValueOnce('   ');

      const addBtns = container.querySelectorAll('.bmc-add');
      addBtns[0].click();

      const canvas = Store.getCanvas();
      const key = addBtns[0].dataset.element;
      expect(canvas[key]).toHaveLength(0);
    });
  });

  describe('hypothesis status indicators', () => {
    test('validated status shows status-validated class', () => {
      Store.addCanvasItem('valueProp', 'Proven value');
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Test',
        status: 'validated',
        actuals: []
      });
      const container = renderCanvas();
      const validatedItems = container.querySelectorAll('.status-validated');
      expect(validatedItems.length).toBeGreaterThanOrEqual(1);
    });

    test('mixed statuses show testing class when some are testing', () => {
      Store.addCanvasItem('valueProp', 'Mixed status');
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Validated',
        status: 'validated',
        actuals: []
      });
      Store.addHypothesis({
        canvasElement: 'valueProp',
        category: 'value',
        statement: 'Testing',
        status: 'testing',
        actuals: []
      });
      const container = renderCanvas();
      const testingItems = container.querySelectorAll('.status-testing');
      expect(testingItems.length).toBeGreaterThanOrEqual(1);
    });

    test('no hypotheses means no status class', () => {
      Store.addCanvasItem('keyPartners', 'Some partner');
      const container = renderCanvas();
      const items = container.querySelectorAll('.bmc-item');
      const partnerItem = Array.from(items).find(i => i.textContent.includes('Some partner'));
      expect(partnerItem.classList.contains('status-testing')).toBe(false);
      expect(partnerItem.classList.contains('status-validated')).toBe(false);
      expect(partnerItem.classList.contains('status-risk')).toBe(false);
    });
  });

  describe('adaptive terminology', () => {
    test('restaurant type shows restaurant-specific labels', () => {
      Store.saveBusiness({ name: 'My Cafe', type: 'restaurant' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      Canvas.render(container);

      const labels = container.querySelectorAll('.bmc-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Your Guests');
      expect(labelTexts).toContain('Why They Come Back');
      expect(labelTexts).toContain('Running Costs');
    });

    test('ecommerce type shows ecommerce-specific labels', () => {
      Store.saveBusiness({ name: 'My Shop', type: 'ecommerce' });
      const container = document.createElement('div');
      document.body.appendChild(container);
      Canvas.render(container);

      const labels = container.querySelectorAll('.bmc-label');
      const labelTexts = Array.from(labels).map(l => l.textContent);
      expect(labelTexts).toContain('Your Buyers');
      expect(labelTexts).toContain('Supply & Logistics');
    });
  });
});
