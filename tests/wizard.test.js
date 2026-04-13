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
  describe('initial state', () => {
    test('renders URL entry screen on first load', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
      expect(container.querySelector('#ob-url')).toBeTruthy();
    });

    test('shows analyze button', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('#btn-analyze')).toBeTruthy();
    });

    test('shows skip button for manual setup', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      var skipBtn = container.querySelector('#btn-skip');
      expect(skipBtn).toBeTruthy();
      expect(skipBtn.textContent).toContain('don\'t have a website');
    });
  });

  describe('skip to manual', () => {
    test('clicking skip goes to workspace stage', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      var skipBtn = container.querySelector('#btn-skip');
      skipBtn.click();
      expect(container.querySelector('.ob-workspace')).toBeTruthy();
    });

    test('workspace shows identity and customers cards', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('[data-card="identity"]')).toBeTruthy();
      expect(container.querySelector('[data-card="customers"]')).toBeTruthy();
    });

    test('workspace shows greeting', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      var greeting = container.querySelector('.ob-greeting');
      expect(greeting).toBeTruthy();
      expect(greeting.textContent).toContain('cockpit');
    });

    test('workspace shows live canvas preview', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('.ob-preview-panel')).toBeTruthy();
      expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
    });
  });

  describe('identity card', () => {
    function skipToWorkspace() {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      return container;
    }

    test('has business name input', () => {
      var container = skipToWorkspace();
      expect(container.querySelector('#ob-name')).toBeTruthy();
    });

    test('has proudOf textarea', () => {
      var container = skipToWorkspace();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
    });

    test('has confirm button', () => {
      var container = skipToWorkspace();
      expect(container.querySelector('#btn-confirm-identity')).toBeTruthy();
    });

    test('confirm requires name or proudOf', () => {
      var container = skipToWorkspace();
      var confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();
      // Card should not be confirmed (no data entered)
      expect(container.querySelector('[data-card="identity"]').classList.contains('ob-card-done')).toBe(false);
    });

    test('confirm with name marks card as done', () => {
      var container = skipToWorkspace();
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'My Coffee Shop';
      // Trigger input event to update data
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();
      var card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);
    });

    test('confirmed card shows edit button', () => {
      var container = skipToWorkspace();
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'My Cafe';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();
      var editBtns = container.querySelectorAll('.ob-edit-btn[data-edit="identity"]');
      expect(editBtns.length).toBe(1);
    });
  });

  describe('customers card', () => {
    function skipToWorkspace() {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      return container;
    }

    test('renders customer segment chips', () => {
      var container = skipToWorkspace();
      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('clicking a chip selects it', () => {
      var container = skipToWorkspace();
      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      var firstChip = chips[0];
      expect(firstChip.classList.contains('active')).toBe(false);
      firstChip.click();
      expect(firstChip.classList.contains('active')).toBe(true);
    });

    test('confirm button is disabled with no segments selected', () => {
      var container = skipToWorkspace();
      var confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(true);
    });

    test('confirm button enables after selecting a segment', () => {
      var container = skipToWorkspace();
      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      var confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);
    });

    test('has custom segment input', () => {
      var container = skipToWorkspace();
      var customInput = container.querySelector('#ob-seg-custom');
      expect(customInput).toBeTruthy();
      expect(customInput.placeholder).toContain('add your own');
    });
  });

  describe('card stage progression', () => {
    function advanceThroughStageA() {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Fill identity
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Test Business';
      nameInput.dispatchEvent(new Event('input'));
      var proudInput = container.querySelector('#ob-proud');
      proudInput.value = 'We make great software';
      proudInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      // Select customers and confirm
      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      container.querySelector('#btn-confirm-customers').click();

      return container;
    }

    test('stage B cards appear after confirming identity and customers', () => {
      var container = advanceThroughStageA();
      expect(container.querySelector('[data-card="economics"]')).toBeTruthy();
    });

    test('economics card has revenue selector', () => {
      var container = advanceThroughStageA();
      expect(container.querySelector('#ob-revenue')).toBeTruthy();
    });

    test('economics card has team size selector', () => {
      var container = advanceThroughStageA();
      expect(container.querySelector('#ob-team')).toBeTruthy();
    });

    test('economics card has cost chips', () => {
      var container = advanceThroughStageA();
      var costChips = container.querySelectorAll('#ob-costs .ob-chip');
      expect(costChips.length).toBeGreaterThan(0);
    });

    test('ambition card has goal chips', () => {
      var container = advanceThroughStageA();
      expect(container.querySelector('#ob-goals')).toBeTruthy();
      var goalChips = container.querySelectorAll('#ob-goals .ob-chip');
      expect(goalChips.length).toBeGreaterThan(0);
    });

    test('ambition card has concern textarea', () => {
      var container = advanceThroughStageA();
      expect(container.querySelector('#ob-concern')).toBeTruthy();
    });

    test('financials card appears after economics is confirmed', () => {
      var container = advanceThroughStageA();
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('[data-card="financials"]')).toBeTruthy();
    });

    test('financials card has starting cash input', () => {
      var container = advanceThroughStageA();
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('#ob-cash')).toBeTruthy();
    });

    test('financials card has average price input', () => {
      var container = advanceThroughStageA();
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('#ob-price')).toBeTruthy();
    });

    test('financials card has monthly volume input', () => {
      var container = advanceThroughStageA();
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('#ob-volume')).toBeTruthy();
    });

    test('financials card has skip-to-defaults option', () => {
      var container = advanceThroughStageA();
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('#btn-skip-financials')).toBeTruthy();
    });
  });

  describe('finish flow', () => {
    function completeWizard(container) {
      // Skip to workspace
      container.querySelector('#btn-skip').click();

      // Identity
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Finish Test Biz';
      nameInput.dispatchEvent(new Event('input'));
      var proudInput = container.querySelector('#ob-proud');
      proudInput.value = 'Best service ever';
      proudInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      // Customers
      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      chips[1].click();
      container.querySelector('#btn-confirm-customers').click();

      // Economics
      container.querySelector('#btn-confirm-economics').click();

      // Financials - skip to defaults
      container.querySelector('#btn-skip-financials').click();

      // Ambition
      var goalChips = container.querySelectorAll('#ob-goals .ob-chip');
      goalChips[0].click();
      container.querySelector('#btn-confirm-ambition').click();

      return container;
    }

    test('completing all stage B cards triggers hypothesis generation', () => {
      var container = document.getElementById('app');
      Wizard.render(container);

      // Mock AI.generateHypotheses to return immediately
      var originalGen = AI.generateHypotheses;
      AI.generateHypotheses = jest.fn().mockResolvedValue({
        ok: true,
        source: 'fallback',
        hypotheses: [
          { category: 'customer', statement: 'Test hyp', metric: 'Users', target: 10, unit: 'people', timeframe: '1 month', priority: 'critical' }
        ]
      });

      completeWizard(container);

      expect(AI.generateHypotheses).toHaveBeenCalled();
      AI.generateHypotheses = originalGen;
    });
  });

  describe('reset()', () => {
    test('reset brings wizard back to URL stage', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('.ob-workspace')).toBeTruthy();

      Wizard.reset();
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
    });
  });

  describe('onboarding data persistence', () => {
    test('wizard saves onboarding progress to store', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Fill and confirm identity
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Persistence Test';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      var saved = Store.getOnboardingData();
      expect(saved).toBeTruthy();
      expect(saved.confirmed.identity).toBe(true);
      expect(saved.data.name).toBe('Persistence Test');
    });
  });

  describe('adaptive terminology in wizard', () => {
    test('uses default terminology on initial load', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Default type is 'service', so terminology should reflect that
      var identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.textContent).toContain('Your Edge');
    });
  });

  describe('live canvas preview', () => {
    test('preview updates as segments are selected', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      var chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();

      var preview = container.querySelector('.ob-preview-panel');
      expect(preview).toBeTruthy();
      // The preview should show the selected segment
      var previewItems = preview.querySelectorAll('.preview-cell-item');
      var itemTexts = Array.from(previewItems).map(function(i) { return i.textContent; });
      expect(itemTexts.some(function(t) { return t === chips[0].dataset.val; })).toBe(true);
    });

    test('preview highlights active canvas section', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Before confirming identity, valueProp section should be highlighted
      var activeCells = container.querySelectorAll('.preview-cell.active');
      expect(activeCells.length).toBeGreaterThan(0);
    });
  });

  describe('business type detection', () => {
    test('auto-detects type from proudOf during identity confirmation', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Cafe Roma';
      nameInput.dispatchEvent(new Event('input'));

      var proudInput = container.querySelector('#ob-proud');
      proudInput.value = 'We serve the best artisanal coffee and pastries in a cozy cafe atmosphere';
      proudInput.dispatchEvent(new Event('input'));

      container.querySelector('#btn-confirm-identity').click();

      // After confirming, the type should be detected. Check by looking at
      // terminology - restaurant type should use different labels
      var saved = Store.getOnboardingData();
      expect(saved.data.type).toBe('restaurant');
    });
  });

  describe('edit functionality', () => {
    test('clicking edit on confirmed card reopens it', () => {
      var container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Confirm identity
      var nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Edit Test';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      // Card should be done
      var card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);

      // Click edit
      var editBtn = container.querySelector('.ob-edit-btn[data-edit="identity"]');
      editBtn.click();

      // Card should be editable again
      card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(false);
      expect(container.querySelector('#ob-name')).toBeTruthy();
    });
  });
});
