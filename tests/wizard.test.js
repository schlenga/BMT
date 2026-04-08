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
  Wizard.reset();
  // jsdom doesn't implement scrollIntoView
  Element.prototype.scrollIntoView = jest.fn();
});

// Wizard uses document.getElementById internally, so the container must be in the DOM
function getContainer() {
  const container = document.createElement('div');
  container.id = 'wizard-test';
  document.body.appendChild(container);
  return container;
}

describe('Wizard', () => {
  describe('render()', () => {
    test('renders URL entry stage initially', () => {
      const container = getContainer();
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
      expect(container.querySelector('#ob-url')).toBeTruthy();
      expect(container.querySelector('#btn-analyze')).toBeTruthy();
      expect(container.querySelector('#btn-skip')).toBeTruthy();
    });

    test('URL input has autofocus', () => {
      const container = getContainer();
      Wizard.render(container);
      const input = container.querySelector('#ob-url');
      expect(input.getAttribute('autofocus')).not.toBeNull();
    });
  });

  describe('skip to manual', () => {
    test('clicking skip shows workspace stage', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('.ob-workspace')).toBeTruthy();
      expect(container.querySelector('.ob-greeting')).toBeTruthy();
    });

    test('skip sets manual greeting', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      const greeting = container.querySelector('.ob-greeting');
      expect(greeting.textContent).toContain('from scratch');
    });
  });

  describe('workspace stage — card flow', () => {
    function goToWorkspace(container) {
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
    }

    test('shows identity and customers cards (Stage A)', () => {
      const container = getContainer();
      goToWorkspace(container);
      expect(container.querySelector('[data-card="identity"]')).toBeTruthy();
      expect(container.querySelector('[data-card="customers"]')).toBeTruthy();
      expect(container.querySelector('[data-card="economics"]')).toBeNull();
    });

    test('identity card has name and proudOf inputs', () => {
      const container = getContainer();
      goToWorkspace(container);
      expect(container.querySelector('#ob-name')).toBeTruthy();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
      expect(container.querySelector('#btn-confirm-identity')).toBeTruthy();
    });

    test('customers card has segment chips', () => {
      const container = getContainer();
      goToWorkspace(container);
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('confirm identity requires name or proudOf', () => {
      const container = getContainer();
      goToWorkspace(container);
      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();
      // Card should NOT be confirmed (still editable)
      expect(container.querySelector('#ob-name')).toBeTruthy();
    });

    test('confirm identity with name marks card done', () => {
      const container = getContainer();
      goToWorkspace(container);
      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Test Business';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();
      const identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.classList.contains('ob-card-done')).toBe(true);
    });

    test('customers confirm button disabled when no segments selected', () => {
      const container = getContainer();
      goToWorkspace(container);
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(true);
    });

    test('selecting a segment chip enables confirm button', () => {
      const container = getContainer();
      goToWorkspace(container);
      const chip = container.querySelector('#ob-segs .ob-chip');
      chip.click();
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);
    });

    test('confirming both Stage A cards reveals Stage B', () => {
      const container = getContainer();
      goToWorkspace(container);

      // Fill identity
      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'My Biz';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      // Select a segment and confirm customers
      const chip = container.querySelector('#ob-segs .ob-chip');
      chip.click();
      container.querySelector('#btn-confirm-customers').click();

      // Stage B cards should now be visible
      expect(container.querySelector('[data-card="economics"]')).toBeTruthy();
      expect(container.querySelector('[data-card="ambition"]')).toBeTruthy();
    });

    test('custom segment input adds segment and enables confirm', () => {
      const container = getContainer();
      goToWorkspace(container);
      // Confirm button should be disabled initially (no segments)
      expect(container.querySelector('#btn-confirm-customers').disabled).toBe(true);

      const segInput = container.querySelector('#ob-seg-custom');
      segInput.value = 'Custom Segment';
      segInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // After adding custom segment, confirm button should be enabled
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);

      // Confirming should include the custom segment
      confirmBtn.click();
      const saved = Store.getOnboardingData();
      expect(saved.data.segments).toContain('Custom Segment');
    });

    test('edit button reopens confirmed card', () => {
      const container = getContainer();
      goToWorkspace(container);

      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Test';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      const editBtn = container.querySelector('[data-edit="identity"]');
      editBtn.click();

      expect(container.querySelector('#ob-name')).toBeTruthy();
    });
  });

  describe('Stage B cards', () => {
    function goToStageB(container) {
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Stage B Biz';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      container.querySelector('#ob-segs .ob-chip').click();
      container.querySelector('#btn-confirm-customers').click();
    }

    test('economics card has revenue and team selectors', () => {
      const container = getContainer();
      goToStageB(container);
      expect(container.querySelector('#ob-revenue')).toBeTruthy();
      expect(container.querySelector('#ob-team')).toBeTruthy();
      expect(container.querySelector('#ob-costs')).toBeTruthy();
    });

    test('confirming economics enables financials card', () => {
      const container = getContainer();
      goToStageB(container);
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('[data-card="financials"]')).toBeTruthy();
    });

    test('financials card has cash, price, volume inputs', () => {
      const container = getContainer();
      goToStageB(container);
      container.querySelector('#btn-confirm-economics').click();
      expect(container.querySelector('#ob-cash')).toBeTruthy();
      expect(container.querySelector('#ob-price')).toBeTruthy();
      expect(container.querySelector('#ob-volume')).toBeTruthy();
    });

    test('skip financials button confirms without input', () => {
      const container = getContainer();
      goToStageB(container);
      container.querySelector('#btn-confirm-economics').click();
      container.querySelector('#btn-skip-financials').click();
      const financialsCard = container.querySelector('[data-card="financials"]');
      expect(financialsCard.classList.contains('ob-card-done')).toBe(true);
    });

    test('ambition card has goal chips and concern textarea', () => {
      const container = getContainer();
      goToStageB(container);
      expect(container.querySelector('#ob-goals')).toBeTruthy();
      expect(container.querySelector('#ob-concern')).toBeTruthy();
    });

    test('goal chip selection sets goal', () => {
      const container = getContainer();
      goToStageB(container);
      const goalChip = container.querySelector('#ob-goals .ob-chip');
      goalChip.click();
      expect(goalChip.classList.contains('active')).toBe(true);
    });

    test('confirming all Stage B cards with goal triggers hypothesis generation', async () => {
      const container = getContainer();
      goToStageB(container);

      container.querySelector('#btn-confirm-economics').click();
      container.querySelector('#btn-skip-financials').click();

      container.querySelector('#ob-goals .ob-chip').click();
      container.querySelector('#btn-confirm-ambition').click();

      // Wait for async hypothesis generation (falls back to keyword)
      await new Promise(r => setTimeout(r, 100));

      const hasHyps = container.querySelector('[data-card="hypotheses"]');
      const hasLoading = container.querySelector('.ob-card-loading');
      expect(hasHyps || hasLoading).toBeTruthy();
    });
  });

  describe('live canvas preview', () => {
    test('preview panel is rendered in workspace', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('#ob-preview')).toBeTruthy();
      expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
    });

    test('preview updates when name is typed', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Preview Biz';
      nameInput.dispatchEvent(new Event('input'));
      const preview = container.querySelector('#ob-preview');
      expect(preview.textContent).toContain('Preview Biz');
    });
  });

  describe('reset()', () => {
    test('reset returns to URL stage', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('.ob-workspace')).toBeTruthy();

      Wizard.reset();
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
    });
  });

  describe('progress persistence', () => {
    test('onboarding data is saved to store after confirm', () => {
      const container = getContainer();
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Saved Biz';
      nameInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-identity').click();

      const saved = Store.getOnboardingData();
      expect(saved).toBeTruthy();
      expect(saved.data.name).toBe('Saved Biz');
      expect(saved.confirmed.identity).toBe(true);
    });

    test('wizard resumes from saved progress', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'A',
        confirmed: { identity: true, customers: false, economics: false, financials: false, ambition: false },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null,
          greeting: 'Welcome back', name: 'Resumed Biz', type: 'service',
          description: '', proudOf: 'Great stuff', segments: [],
          revenueRange: '', costs: [], teamSize: '', goal: '', concern: '',
          toolPrefs: {}, aiHypotheses: [], selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: ''
        }
      });

      const container = getContainer();
      Wizard.render(container);

      expect(container.querySelector('.ob-workspace')).toBeTruthy();
      const identityCard = container.querySelector('[data-card="identity"]');
      expect(identityCard.classList.contains('ob-card-done')).toBe(true);
    });
  });
});
