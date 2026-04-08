const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.prompt = jest.fn(() => null);
  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
  Store.saveBusiness({ name: 'Test Biz', type: 'service' });
});

describe('Canvas editing interactions', () => {
  test('clicking an item enters edit mode with input', () => {
    Store.addCanvasItem('valueProp', 'Test item');
    const container = document.createElement('div');
    Canvas.render(container);

    const item = container.querySelector('.bmc-item');
    item.click();

    // Should re-render with input
    const input = container.querySelector('.bmc-edit-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('Test item');
  });

  test('clicking save button updates item text', () => {
    Store.addCanvasItem('channels', 'Old channel');
    const container = document.createElement('div');
    Canvas.render(container);

    // Enter edit mode
    container.querySelector('.bmc-item').click();

    // Change text and save
    const input = container.querySelector('.bmc-edit-input');
    input.value = 'New channel';
    container.querySelector('.bmc-save').click();

    const canvas = Store.getCanvas();
    expect(canvas.channels[0].text).toBe('New channel');
  });

  test('pressing Enter in edit input saves item', () => {
    Store.addCanvasItem('costStructure', 'Original cost');
    const container = document.createElement('div');
    Canvas.render(container);

    container.querySelector('.bmc-item').click();
    const input = container.querySelector('.bmc-edit-input');
    input.value = 'Updated cost';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    const canvas = Store.getCanvas();
    expect(canvas.costStructure[0].text).toBe('Updated cost');
  });

  test('pressing Escape in edit input cancels edit', () => {
    Store.addCanvasItem('keyActivities', 'My activity');
    const container = document.createElement('div');
    Canvas.render(container);

    container.querySelector('.bmc-item').click();
    const input = container.querySelector('.bmc-edit-input');
    input.value = 'Changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Should exit edit mode without saving
    const canvas = Store.getCanvas();
    expect(canvas.keyActivities[0].text).toBe('My activity');
    expect(container.querySelector('.bmc-edit-input')).toBeNull();
  });

  test('clicking delete button removes item', () => {
    Store.addCanvasItem('keyPartners', 'Partner A');
    Store.addCanvasItem('keyPartners', 'Partner B');
    const container = document.createElement('div');
    Canvas.render(container);

    // Enter edit mode on first item
    container.querySelector('.bmc-item').click();
    container.querySelector('.bmc-delete').click();

    const canvas = Store.getCanvas();
    expect(canvas.keyPartners).toHaveLength(1);
    expect(canvas.keyPartners[0].text).toBe('Partner B');
  });

  test('add button calls prompt and adds new item', () => {
    global.prompt.mockReturnValueOnce('New resource');
    const container = document.createElement('div');
    Canvas.render(container);

    const addBtns = container.querySelectorAll('.bmc-add');
    let resourceBtn = null;
    addBtns.forEach(btn => {
      if (btn.dataset.element === 'keyResources') resourceBtn = btn;
    });
    resourceBtn.click();

    const canvas = Store.getCanvas();
    expect(canvas.keyResources).toHaveLength(1);
    expect(canvas.keyResources[0].text).toBe('New resource');
  });

  test('add button does nothing when prompt is cancelled', () => {
    global.prompt.mockReturnValueOnce(null);
    const container = document.createElement('div');
    Canvas.render(container);

    const addBtn = container.querySelector('.bmc-add');
    addBtn.click();

    const canvas = Store.getCanvas();
    // All arrays should be empty
    const totalItems = Object.values(canvas).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    expect(totalItems).toBe(0);
  });

  test('add button trims whitespace from input', () => {
    global.prompt.mockReturnValueOnce('  Trimmed item  ');
    const container = document.createElement('div');
    Canvas.render(container);

    const addBtn = container.querySelector('.bmc-add[data-element="valueProp"]');
    addBtn.click();

    const canvas = Store.getCanvas();
    expect(canvas.valueProp[0].text).toBe('Trimmed item');
  });

  test('renders hypothesis badge for elements with hypotheses', () => {
    Store.addCanvasItem('customerSegments', 'Young pros');
    Store.addHypothesis({
      canvasElement: 'customerSegments', category: 'customer',
      statement: 'Young pros want this', status: 'testing'
    });
    Store.addHypothesis({
      canvasElement: 'customerSegments', category: 'customer',
      statement: 'Another hyp', status: 'validated'
    });

    const container = document.createElement('div');
    Canvas.render(container);

    const badges = container.querySelectorAll('.bmc-hyp-badge');
    expect(badges.length).toBeGreaterThan(0);
    // Find badge for customerSegments - it should say "2"
    const segCell = container.querySelector('.bmc-segments');
    const badge = segCell.querySelector('.bmc-hyp-badge');
    expect(badge.textContent).toBe('2');
  });

  test('item status-validated class when all hypotheses validated', () => {
    Store.addCanvasItem('valueProp', 'Great value');
    Store.addHypothesis({
      canvasElement: 'valueProp', category: 'value',
      statement: 'People love it', status: 'validated'
    });

    const container = document.createElement('div');
    Canvas.render(container);

    const items = container.querySelectorAll('.status-validated');
    expect(items.length).toBeGreaterThan(0);
  });

  test('ELEMENTS constant has 9 elements', () => {
    expect(Canvas.ELEMENTS).toHaveLength(9);
  });

  test('adaptive terminology updates cell labels', () => {
    Store.saveBusiness({ name: 'Ristorante', type: 'restaurant' });
    const container = document.createElement('div');
    Canvas.render(container);

    const labels = container.querySelectorAll('.bmc-label');
    const labelTexts = Array.from(labels).map(l => l.textContent);
    expect(labelTexts).toContain('Your Guests');
    expect(labelTexts).toContain('Why They Come Back');
  });
});
