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

function renderCanvas(bizType) {
  Store.saveBusiness({ name: 'Test Biz', type: bizType || 'service' });
  const container = document.createElement('div');
  document.body.appendChild(container);
  Canvas.render(container);
  return container;
}

describe('Canvas', () => {
  describe('getElements with terminology', () => {
    test('restaurant type shows "Your Guests" for customer segments', () => {
      const c = renderCanvas('restaurant');
      const labels = Array.from(c.querySelectorAll('.bmc-label')).map(l => l.textContent);
      expect(labels).toContain('Your Guests');
    });

    test('saas type shows "Your Users" for customer segments', () => {
      const c = renderCanvas('saas');
      const labels = Array.from(c.querySelectorAll('.bmc-label')).map(l => l.textContent);
      expect(labels).toContain('Your Users');
    });

    test('saas type shows "Burn Rate" for cost structure', () => {
      const c = renderCanvas('saas');
      const labels = Array.from(c.querySelectorAll('.bmc-label')).map(l => l.textContent);
      expect(labels).toContain('Burn Rate');
    });

    test('ecommerce type shows "Your Buyers"', () => {
      const c = renderCanvas('ecommerce');
      const labels = Array.from(c.querySelectorAll('.bmc-label')).map(l => l.textContent);
      expect(labels).toContain('Your Buyers');
    });

    test('subscription type shows "Your Members"', () => {
      const c = renderCanvas('subscription');
      const labels = Array.from(c.querySelectorAll('.bmc-label')).map(l => l.textContent);
      expect(labels).toContain('Your Members');
    });
  });

  describe('empty canvas', () => {
    test('renders grid with no items', () => {
      const c = renderCanvas();
      expect(c.querySelector('.bmc-grid')).toBeTruthy();
      const items = c.querySelectorAll('.bmc-item');
      expect(items).toHaveLength(0);
    });

    test('shows add buttons for all 9 sections', () => {
      const c = renderCanvas();
      const addBtns = c.querySelectorAll('.bmc-add');
      expect(addBtns).toHaveLength(9);
    });
  });

  describe('item display', () => {
    test('renders items in correct canvas sections', () => {
      Store.addCanvasItem('customerSegments', 'Students');
      Store.addCanvasItem('valueProp', 'Great service');
      Store.addCanvasItem('costStructure', 'Rent');
      const c = renderCanvas();
      const items = c.querySelectorAll('.bmc-item');
      expect(items).toHaveLength(3);
    });

    test('displays item text', () => {
      Store.addCanvasItem('valueProp', 'Best coffee in town');
      const c = renderCanvas();
      const text = c.querySelector('.bmc-item-text');
      expect(text.textContent).toBe('Best coffee in town');
    });

    test('multiple items in same section render separately', () => {
      Store.addCanvasItem('customerSegments', 'Students');
      Store.addCanvasItem('customerSegments', 'Professionals');
      Store.addCanvasItem('customerSegments', 'Tourists');
      const c = renderCanvas();
      const texts = Array.from(c.querySelectorAll('.bmc-item-text')).map(t => t.textContent);
      expect(texts).toContain('Students');
      expect(texts).toContain('Professionals');
      expect(texts).toContain('Tourists');
    });
  });

  describe('add item flow', () => {
    test('clicking add with text adds item to store', () => {
      const c = renderCanvas();
      global.prompt.mockReturnValueOnce('New segment');
      const addBtn = c.querySelector('.bmc-add[data-element="customerSegments"]');
      addBtn.click();
      const canvas = Store.getCanvas();
      expect(canvas.customerSegments).toHaveLength(1);
      expect(canvas.customerSegments[0].text).toBe('New segment');
    });

    test('clicking add with empty text does nothing', () => {
      const c = renderCanvas();
      global.prompt.mockReturnValueOnce('');
      c.querySelector('.bmc-add[data-element="customerSegments"]').click();
      expect(Store.getCanvas().customerSegments).toHaveLength(0);
    });

    test('clicking add with null (cancel) does nothing', () => {
      const c = renderCanvas();
      global.prompt.mockReturnValueOnce(null);
      c.querySelector('.bmc-add[data-element="customerSegments"]').click();
      expect(Store.getCanvas().customerSegments).toHaveLength(0);
    });

    test('adding item re-renders to show new item', () => {
      const c = renderCanvas();
      global.prompt.mockReturnValueOnce('Fresh item');
      c.querySelector('.bmc-add[data-element="valueProp"]').click();
      const texts = Array.from(c.querySelectorAll('.bmc-item-text')).map(t => t.textContent);
      expect(texts).toContain('Fresh item');
    });

    test('whitespace-only text is trimmed and not added', () => {
      const c = renderCanvas();
      global.prompt.mockReturnValueOnce('   ');
      c.querySelector('.bmc-add[data-element="channels"]').click();
      expect(Store.getCanvas().channels).toHaveLength(0);
    });
  });

  describe('item editing', () => {
    test('clicking item shows edit input', () => {
      Store.addCanvasItem('valueProp', 'Old text');
      const c = renderCanvas();
      const item = c.querySelector('.bmc-item');
      item.click();
      expect(c.querySelector('.bmc-edit-input')).toBeTruthy();
    });

    test('edit input has current text value', () => {
      Store.addCanvasItem('valueProp', 'Current text');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      const input = c.querySelector('.bmc-edit-input');
      expect(input.value).toBe('Current text');
    });

    test('save button updates item text in store', () => {
      const item = Store.addCanvasItem('channels', 'Old channel');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      const input = c.querySelector('.bmc-edit-input');
      input.value = 'New channel';
      c.querySelector('.bmc-save').click();
      expect(Store.getCanvas().channels[0].text).toBe('New channel');
    });

    test('enter key saves edit', () => {
      Store.addCanvasItem('channels', 'Original');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      const input = c.querySelector('.bmc-edit-input');
      input.value = 'Updated';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(Store.getCanvas().channels[0].text).toBe('Updated');
    });

    test('escape key cancels edit without saving', () => {
      Store.addCanvasItem('channels', 'Original');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      const input = c.querySelector('.bmc-edit-input');
      input.value = 'Changed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(Store.getCanvas().channels[0].text).toBe('Original');
    });
  });

  describe('item deletion', () => {
    test('delete button removes item from store', () => {
      Store.addCanvasItem('costStructure', 'Rent');
      Store.addCanvasItem('costStructure', 'Staff');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      c.querySelector('.bmc-delete').click();
      expect(Store.getCanvas().costStructure).toHaveLength(1);
      expect(Store.getCanvas().costStructure[0].text).toBe('Staff');
    });

    test('delete re-renders without deleted item', () => {
      Store.addCanvasItem('valueProp', 'To delete');
      const c = renderCanvas();
      c.querySelector('.bmc-item').click();
      c.querySelector('.bmc-delete').click();
      expect(c.querySelectorAll('.bmc-item')).toHaveLength(0);
    });
  });

  describe('hypothesis status styling', () => {
    test('testing hypothesis adds status-testing class', () => {
      Store.addCanvasItem('valueProp', 'Test item');
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'Test', status: 'testing', actuals: [] });
      const c = renderCanvas();
      expect(c.querySelector('.status-testing')).toBeTruthy();
    });

    test('validated hypothesis adds status-validated class', () => {
      Store.addCanvasItem('valueProp', 'Valid item');
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'Valid', status: 'validated', actuals: [] });
      const c = renderCanvas();
      expect(c.querySelector('.status-validated')).toBeTruthy();
    });

    test('invalidated hypothesis adds status-risk class', () => {
      Store.addCanvasItem('valueProp', 'Risk item');
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'Invalid', status: 'invalidated', actuals: [] });
      const c = renderCanvas();
      expect(c.querySelector('.status-risk')).toBeTruthy();
    });

    test('invalidated overrides testing when both present', () => {
      Store.addCanvasItem('valueProp', 'Mixed item');
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'Testing', status: 'testing', actuals: [] });
      Store.addHypothesis({ canvasElement: 'valueProp', category: 'value', statement: 'Invalid', status: 'invalidated', actuals: [] });
      const c = renderCanvas();
      expect(c.querySelector('.status-risk')).toBeTruthy();
    });

    test('no hypothesis means no status class', () => {
      Store.addCanvasItem('valueProp', 'Plain item');
      const c = renderCanvas();
      const item = c.querySelector('.bmc-item');
      expect(item.classList.contains('status-testing')).toBe(false);
      expect(item.classList.contains('status-risk')).toBe(false);
      expect(item.classList.contains('status-validated')).toBe(false);
    });
  });

  describe('hypothesis badge', () => {
    test('shows badge with hypothesis count', () => {
      Store.addHypothesis({ canvasElement: 'customerSegments', category: 'customer', statement: 'H1', status: 'testing', actuals: [] });
      Store.addHypothesis({ canvasElement: 'customerSegments', category: 'customer', statement: 'H2', status: 'testing', actuals: [] });
      const c = renderCanvas();
      const badges = c.querySelectorAll('.bmc-hyp-badge');
      const csBadge = Array.from(badges).find(b => b.textContent === '2');
      expect(csBadge).toBeTruthy();
    });

    test('no badge when no hypotheses for element', () => {
      const c = renderCanvas();
      const badges = c.querySelectorAll('.bmc-hyp-badge');
      expect(badges).toHaveLength(0);
    });
  });
});
