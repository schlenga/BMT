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
  Wizard.reset();
});

describe('Wizard', () => {

  describe('URL entry stage', () => {
    test('renders URL input and buttons', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('#ob-url')).toBeTruthy();
      expect(container.querySelector('#btn-analyze')).toBeTruthy();
      expect(container.querySelector('#btn-skip')).toBeTruthy();
    });

    test('skip button transitions to workspace stage', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      const skipBtn = container.querySelector('#btn-skip');
      skipBtn.click();

      // After skip, should show workspace with cards panel
      expect(container.querySelector('.ob-workspace') || container.querySelector('.ob-cards-panel')).toBeTruthy();
    });

    test('analyze button with empty URL skips to manual', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      const urlInput = container.querySelector('#ob-url');
      urlInput.value = '';
      const analyzeBtn = container.querySelector('#btn-analyze');
      analyzeBtn.click();

      // Should still transition since empty URL triggers skipToManual
      expect(container.querySelector('.ob-workspace') || container.querySelector('.ob-cards-panel')).toBeTruthy();
    });
  });

  describe('workspace stage (manual entry)', () => {
    function goToWorkspace(container) {
      Wizard.render(container);
      const skipBtn = container.querySelector('#btn-skip');
      skipBtn.click();
    }

    test('shows identity and customer cards initially', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);
      expect(container.querySelector('[data-card="identity"]')).toBeTruthy();
      expect(container.querySelector('[data-card="customers"]')).toBeTruthy();
    });

    test('shows greeting message', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);
      const greeting = container.querySelector('.ob-greeting');
      expect(greeting).toBeTruthy();
      expect(greeting.textContent.length).toBeGreaterThan(0);
    });

    test('identity card has name and proud-of fields', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);
      expect(container.querySelector('#ob-name')).toBeTruthy();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
      expect(container.querySelector('#btn-confirm-identity')).toBeTruthy();
    });

    test('customer card has segment chips', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('confirm identity card with data progresses', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);

      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'My Test Biz';
      nameInput.dispatchEvent(new Event('input'));

      const proudInput = container.querySelector('#ob-proud');
      proudInput.value = 'Amazing products';
      proudInput.dispatchEvent(new Event('input'));

      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();

      // Identity card should now show as confirmed (has check mark)
      const identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.classList.contains('ob-card-done')).toBe(true);
    });

    test('identity confirm with empty fields does nothing', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);

      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();

      const identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.classList.contains('ob-card-done')).toBe(false);
    });

    test('customer confirm disabled when no segments selected', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);

      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(true);
    });

    test('selecting a segment chip enables confirm', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);

      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();

      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);
    });

    test('custom segment can be added via input', () => {
      const container = document.getElementById('app');
      goToWorkspace(container);

      const input = container.querySelector('#ob-seg-custom');
      input.value = 'Custom segment';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // Custom segment is added to data and the confirm button should be enabled
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);

      // Confirm and verify the custom segment appears in summary
      confirmBtn.click();
      const summary = container.querySelector('[data-card="customers"] .ob-card-summary');
      expect(summary.textContent).toContain('Custom segment');
    });
  });

  describe('stage progression', () => {
    function setupStageA(container) {
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Fill identity
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#ob-name').dispatchEvent(new Event('input'));
      container.querySelector('#ob-proud').value = 'Great stuff';
      container.querySelector('#ob-proud').dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      // Select a segment and confirm
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      container.querySelector('#btn-confirm-customers').click();
    }

    test('confirming both Stage A cards reveals Stage B cards', () => {
      const container = document.getElementById('app');
      setupStageA(container);

      // Economics card should now be visible
      expect(container.querySelector('[data-card="economics"]')).toBeTruthy();
      expect(container.querySelector('[data-card="ambition"]')).toBeTruthy();
    });

    test('economics card has revenue and team selects', () => {
      const container = document.getElementById('app');
      setupStageA(container);

      expect(container.querySelector('#ob-revenue')).toBeTruthy();
      expect(container.querySelector('#ob-team')).toBeTruthy();
      expect(container.querySelector('#ob-costs')).toBeTruthy();
    });

    test('edit button on confirmed card reopens it', () => {
      const container = document.getElementById('app');
      setupStageA(container);

      // Find identity card edit button
      const editBtns = container.querySelectorAll('.ob-edit-btn[data-edit="identity"]');
      expect(editBtns.length).toBeGreaterThan(0);
      editBtns[0].click();

      // Identity card should no longer be done
      const identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.classList.contains('ob-card-done')).toBe(false);
    });
  });

  describe('live canvas preview', () => {
    test('preview panel is rendered in workspace stage', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      expect(container.querySelector('.ob-preview-panel') || container.querySelector('#ob-preview')).toBeTruthy();
    });

    test('preview shows mini canvas with cells', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      const cells = container.querySelectorAll('.preview-cell');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('reset()', () => {
    test('resets all wizard state', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      Wizard.reset();
      Wizard.render(container);

      expect(container.querySelector('.ob-entrance')).toBeTruthy();
      expect(container.querySelector('#ob-url')).toBeTruthy();
    });
  });

  describe('save and resume progress', () => {
    test('progress is saved to store after confirming a card', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      container.querySelector('#ob-name').value = 'Saved Biz';
      container.querySelector('#ob-name').dispatchEvent(new Event('input'));
      container.querySelector('#ob-proud').value = 'Cool stuff';
      container.querySelector('#ob-proud').dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      const saved = Store.getOnboardingData();
      expect(saved).toBeTruthy();
      expect(saved.data.name).toBe('Saved Biz');
      expect(saved.confirmed.identity).toBe(true);
    });
  });
});
