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
  global.fetch = jest.fn().mockRejectedValue(new Error('no network'));
  Wizard.reset();
});

function getContainer() {
  return document.getElementById('app');
}

function renderWizard() {
  const c = getContainer();
  Wizard.render(c);
  return c;
}

describe('Wizard', () => {
  describe('URL entry stage', () => {
    test('renders URL input', () => {
      const c = renderWizard();
      expect(c.querySelector('#ob-url')).toBeTruthy();
    });

    test('renders Analyze button', () => {
      const c = renderWizard();
      expect(c.querySelector('#btn-analyze')).toBeTruthy();
    });

    test('renders skip link', () => {
      const c = renderWizard();
      const skip = c.querySelector('#btn-skip');
      expect(skip).toBeTruthy();
      expect(skip.textContent).toContain('don\'t have a website');
    });

    test('renders BMT logo', () => {
      const c = renderWizard();
      expect(c.querySelector('.ob-logo')).toBeTruthy();
      expect(c.querySelector('.ob-logo').textContent).toBe('BMT');
    });

    test('renders headline and subline', () => {
      const c = renderWizard();
      expect(c.querySelector('.ob-headline')).toBeTruthy();
      expect(c.querySelector('.ob-subline')).toBeTruthy();
    });
  });

  describe('skip to manual', () => {
    test('skip button transitions to workspace stage', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      expect(c.querySelector('.ob-workspace')).toBeTruthy();
      expect(c.querySelector('#ob-url')).toBeNull();
    });

    test('skip sets greeting message', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      expect(c.querySelector('.ob-greeting').textContent).toContain('build your business cockpit');
    });
  });

  describe('workspace stage - identity card', () => {
    function goToWorkspace() {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      return c;
    }

    test('renders identity card with name input', () => {
      const c = goToWorkspace();
      expect(c.querySelector('#ob-name')).toBeTruthy();
    });

    test('renders identity card with proudOf textarea', () => {
      const c = goToWorkspace();
      expect(c.querySelector('#ob-proud')).toBeTruthy();
    });

    test('renders confirm button for identity', () => {
      const c = goToWorkspace();
      expect(c.querySelector('#btn-confirm-identity')).toBeTruthy();
    });

    test('confirming identity with empty data does not advance', () => {
      const c = goToWorkspace();
      c.querySelector('#btn-confirm-identity').click();
      // Should still show identity card in edit mode
      expect(c.querySelector('#ob-name')).toBeTruthy();
    });

    test('confirming identity with name advances card to done state', () => {
      const c = goToWorkspace();
      c.querySelector('#ob-name').value = 'My Cafe';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      expect(c.querySelector('.ob-card-done')).toBeTruthy();
    });

    test('confirmed identity shows summary with business name', () => {
      const c = goToWorkspace();
      c.querySelector('#ob-name').value = 'My Cafe';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      const summary = c.querySelector('.ob-card-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('My Cafe');
    });

    test('edit button on confirmed card reopens it', () => {
      const c = goToWorkspace();
      c.querySelector('#ob-name').value = 'My Cafe';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      c.querySelector('.ob-edit-btn[data-edit="identity"]').click();
      expect(c.querySelector('#ob-name')).toBeTruthy();
    });
  });

  describe('workspace stage - customers card', () => {
    function goToWorkspace() {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      return c;
    }

    test('renders customer segment chips', () => {
      const c = goToWorkspace();
      const chips = c.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('clicking chip toggles active state', () => {
      const c = goToWorkspace();
      const chip = c.querySelector('#ob-segs .ob-chip');
      expect(chip.classList.contains('active')).toBe(false);
      chip.click();
      expect(chip.classList.contains('active')).toBe(true);
      chip.click();
      expect(chip.classList.contains('active')).toBe(false);
    });

    test('confirm button disabled when no segments selected', () => {
      const c = goToWorkspace();
      const btn = c.querySelector('#btn-confirm-customers');
      expect(btn.disabled).toBe(true);
    });

    test('confirm button enabled after selecting segment', () => {
      const c = goToWorkspace();
      c.querySelector('#ob-segs .ob-chip').click();
      const btn = c.querySelector('#btn-confirm-customers');
      expect(btn.disabled).toBe(false);
    });

    test('custom segment input adds on Enter', () => {
      const c = goToWorkspace();
      const input = c.querySelector('#ob-seg-custom');
      input.value = 'Custom Segment';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      // After re-render, check confirm button is now enabled (segment was added)
      const btn = c.querySelector('#btn-confirm-customers');
      expect(btn.disabled).toBe(false);
    });
  });

  describe('stage advancement', () => {
    function confirmIdentityAndCustomers(c) {
      c.querySelector('#ob-name').value = 'Test Biz';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      c.querySelector('#ob-segs .ob-chip').click();
      c.querySelector('#btn-confirm-customers').click();
    }

    test('confirming identity + customers reveals stage B cards', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      expect(c.querySelector('#ob-revenue')).toBeTruthy();
      expect(c.querySelector('#btn-confirm-economics')).toBeTruthy();
    });

    test('economics card has revenue and team selects', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      expect(c.querySelector('#ob-revenue')).toBeTruthy();
      expect(c.querySelector('#ob-team')).toBeTruthy();
    });

    test('economics card has cost chips', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      const chips = c.querySelectorAll('#ob-costs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('confirming economics reveals financials card', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      c.querySelector('#btn-confirm-economics').click();
      expect(c.querySelector('#ob-cash')).toBeTruthy();
    });

    test('financials card has starting cash, price, and volume inputs', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      c.querySelector('#btn-confirm-economics').click();
      expect(c.querySelector('#ob-cash')).toBeTruthy();
      expect(c.querySelector('#ob-price')).toBeTruthy();
      expect(c.querySelector('#ob-volume')).toBeTruthy();
    });

    test('skip financials button confirms without entering data', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      c.querySelector('#btn-confirm-economics').click();
      const skipBtn = c.querySelector('#btn-skip-financials');
      expect(skipBtn).toBeTruthy();
      skipBtn.click();
      // Should now show ambition card
      expect(c.querySelector('#ob-goal-custom')).toBeTruthy();
    });

    test('confirming financials with values stores them', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      confirmIdentityAndCustomers(c);
      c.querySelector('#btn-confirm-economics').click();
      c.querySelector('#ob-cash').value = '50000';
      c.querySelector('#ob-price').value = '25';
      c.querySelector('#ob-volume').value = '200';
      c.querySelector('#btn-confirm-financials').click();
      // Financials should be confirmed, ambition card visible
      expect(c.querySelector('#ob-goal-custom')).toBeTruthy();
    });
  });

  describe('ambition card', () => {
    function goToAmbition(c) {
      c.querySelector('#btn-skip').click();
      c.querySelector('#ob-name').value = 'Test Biz';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      c.querySelector('#ob-segs .ob-chip').click();
      c.querySelector('#btn-confirm-customers').click();
      c.querySelector('#btn-confirm-economics').click();
      c.querySelector('#btn-skip-financials').click();
    }

    test('renders goal chips', () => {
      const c = renderWizard();
      goToAmbition(c);
      const chips = c.querySelectorAll('#ob-goals .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('clicking goal chip selects it', () => {
      const c = renderWizard();
      goToAmbition(c);
      const chip = c.querySelector('#ob-goals .ob-chip');
      chip.click();
      expect(chip.classList.contains('active')).toBe(true);
    });

    test('custom goal input overrides chip selection', () => {
      const c = renderWizard();
      goToAmbition(c);
      const input = c.querySelector('#ob-goal-custom');
      input.value = 'Custom goal';
      input.dispatchEvent(new Event('input'));
      // Chips should be deselected
      const activeChips = c.querySelectorAll('#ob-goals .ob-chip.active');
      expect(activeChips).toHaveLength(0);
    });

    test('renders concern textarea', () => {
      const c = renderWizard();
      goToAmbition(c);
      expect(c.querySelector('#ob-concern')).toBeTruthy();
    });

    test('confirm ambition without goal does not advance', () => {
      const c = renderWizard();
      goToAmbition(c);
      c.querySelector('#btn-confirm-ambition').click();
      // Still in ambition card
      expect(c.querySelector('#ob-goal-custom')).toBeTruthy();
    });

    test('confirm ambition with goal advances to stage C', () => {
      const c = renderWizard();
      goToAmbition(c);
      c.querySelector('#ob-goals .ob-chip').click();
      c.querySelector('#btn-confirm-ambition').click();
      // Loading indicator for hypotheses or hypothesis card should appear
      const loadingOrHyps = c.querySelector('.ob-card-loading') || c.querySelector('[data-card="hypotheses"]');
      expect(loadingOrHyps).toBeTruthy();
    });
  });

  describe('live canvas preview', () => {
    test('preview panel exists in workspace', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      expect(c.querySelector('#ob-preview')).toBeTruthy();
    });

    test('preview shows mini canvas cells', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      const cells = c.querySelectorAll('.preview-cell');
      expect(cells.length).toBeGreaterThanOrEqual(9);
    });

    test('preview updates when name changes', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      const input = c.querySelector('#ob-name');
      input.value = 'My Business';
      input.dispatchEvent(new Event('input'));
      const preview = c.querySelector('#ob-preview');
      expect(preview.textContent).toContain('My Business');
    });

    test('preview highlights valueProp cell when identity card is active', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      const activeCell = c.querySelector('.preview-cell.active');
      expect(activeCell).toBeTruthy();
    });
  });

  describe('reset()', () => {
    test('resets to URL stage', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      expect(c.querySelector('.ob-workspace')).toBeTruthy();
      Wizard.reset();
      Wizard.render(getContainer());
      expect(getContainer().querySelector('#ob-url')).toBeTruthy();
    });

    test('clears all confirmed states', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      c.querySelector('#ob-name').value = 'Test';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      Wizard.reset();
      resetLocalStorage();
      Wizard.render(getContainer());
      expect(getContainer().querySelector('.ob-card-done')).toBeNull();
    });
  });

  describe('resume from saved state', () => {
    test('resumes workspace stage from onboarding data', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'A',
        confirmed: { identity: false, customers: false, economics: false, financials: false, ambition: false },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null, greeting: 'Welcome!',
          name: 'Saved Biz', type: 'restaurant', description: '', proudOf: '',
          segments: [], revenueRange: '', costs: [], teamSize: '', goal: '', concern: '',
          toolPrefs: {}, aiHypotheses: [], selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: ''
        }
      });
      Wizard.reset();
      const c = getContainer();
      Wizard.render(c);
      expect(c.querySelector('.ob-workspace')).toBeTruthy();
      expect(c.querySelector('.ob-greeting').textContent).toBe('Welcome!');
    });

    test('resumes with confirmed cards', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'B',
        confirmed: { identity: true, customers: true, economics: false, financials: false, ambition: false },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null, greeting: '',
          name: 'Test Co', type: 'service', description: '', proudOf: 'Great service',
          segments: ['Professionals'], revenueRange: '', costs: [], teamSize: '', goal: '', concern: '',
          toolPrefs: {}, aiHypotheses: [], selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: ''
        }
      });
      Wizard.reset();
      const c = getContainer();
      Wizard.render(c);
      const doneCards = c.querySelectorAll('.ob-card-done');
      expect(doneCards.length).toBeGreaterThanOrEqual(2);
      // Stage B cards should be visible
      expect(c.querySelector('#ob-revenue')).toBeTruthy();
    });
  });

  describe('save progress', () => {
    test('confirming a card saves onboarding data', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      c.querySelector('#ob-name').value = 'Save Test';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      const saved = Store.getOnboardingData();
      expect(saved).toBeTruthy();
      expect(saved.confirmed.identity).toBe(true);
      expect(saved.data.name).toBe('Save Test');
    });
  });

  describe('business type detection', () => {
    test('detects restaurant type from proudOf text', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      c.querySelector('#ob-name').value = 'Pizza Palace';
      c.querySelector('#ob-name').dispatchEvent(new Event('input'));
      c.querySelector('#ob-proud').value = 'Best restaurant with amazing pizza and pasta dishes';
      c.querySelector('#ob-proud').dispatchEvent(new Event('input'));
      c.querySelector('#btn-confirm-identity').click();
      // After confirm, type should be detected
      const saved = Store.getOnboardingData();
      expect(saved.data.type).toBe('restaurant');
    });
  });

  describe('hypotheses card', () => {
    test('renders hypotheses when in stage C with generated hypotheses', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'C',
        confirmed: { identity: true, customers: true, economics: true, financials: true, ambition: true },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null, greeting: '',
          name: 'Test', type: 'service', description: '', proudOf: 'Great',
          segments: ['Pros'], revenueRange: '$1K - $5K', costs: ['Rent'], teamSize: '2-5',
          goal: 'Grow revenue', concern: 'Competition',
          toolPrefs: {}, selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: '',
          aiHypotheses: [
            { category: 'customer', statement: 'Test hyp 1', target: 10, unit: 'people', timeframe: '1 month', rationale: 'Testing' },
            { category: 'value', statement: 'Test hyp 2', target: 5, unit: 'score', timeframe: '2 months', rationale: 'Value' }
          ]
        }
      });
      Wizard.reset();
      const c = getContainer();
      Wizard.render(c);
      expect(c.querySelector('[data-card="hypotheses"]')).toBeTruthy();
      const toggles = c.querySelectorAll('.ob-hyp-toggle');
      expect(toggles).toHaveLength(2);
    });

    test('launch button exists in hypotheses card', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'C',
        confirmed: { identity: true, customers: true, economics: true, financials: true, ambition: true },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null, greeting: '',
          name: 'Test', type: 'service', description: '', proudOf: 'Great',
          segments: ['Pros'], revenueRange: '', costs: [], teamSize: '',
          goal: 'Grow', concern: '', toolPrefs: {}, selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: '',
          aiHypotheses: [
            { category: 'customer', statement: 'Test hyp', target: 10, unit: 'people', timeframe: '1 month' }
          ]
        }
      });
      Wizard.reset();
      const c = getContainer();
      Wizard.render(c);
      expect(c.querySelector('#btn-launch')).toBeTruthy();
    });

    test('hypothesis checkbox deselects hypothesis', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'C',
        confirmed: { identity: true, customers: true, economics: true, financials: true, ambition: true },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null, greeting: '',
          name: 'Test', type: 'service', description: '', proudOf: 'Great',
          segments: ['Pros'], revenueRange: '', costs: [], teamSize: '',
          goal: 'Grow', concern: '', toolPrefs: {}, selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: '',
          aiHypotheses: [
            { category: 'customer', statement: 'H1', target: 10, unit: 'p', timeframe: '1m' },
            { category: 'value', statement: 'H2', target: 5, unit: 's', timeframe: '2m' }
          ]
        }
      });
      Wizard.reset();
      const c = getContainer();
      Wizard.render(c);
      const checkboxes = c.querySelectorAll('.ob-hyp-toggle input[type="checkbox"]');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0].checked).toBe(true);
      checkboxes[0].checked = false;
      checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
      const toggle = checkboxes[0].closest('.ob-hyp-toggle');
      expect(toggle.classList.contains('deselected')).toBe(true);
    });
  });

  describe('analyzing stage', () => {
    test('shows analyzing animation when URL provided', () => {
      const c = renderWizard();
      c.querySelector('#ob-url').value = 'https://example.com';
      // Mock fetch to resolve after delay
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ ok: false }), 5000))
      );
      c.querySelector('#btn-analyze').click();
      expect(c.querySelector('.ob-analyzing')).toBeTruthy();
      expect(c.querySelector('.ob-analyzing-text').textContent).toContain('Analyzing');
    });

    test('empty URL skips to manual', () => {
      const c = renderWizard();
      c.querySelector('#ob-url').value = '';
      c.querySelector('#btn-analyze').click();
      expect(c.querySelector('.ob-workspace')).toBeTruthy();
    });
  });

  describe('preview toggle', () => {
    test('preview toggle button exists', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      expect(c.querySelector('#preview-toggle')).toBeTruthy();
    });

    test('clicking toggle adds expanded class', () => {
      const c = renderWizard();
      c.querySelector('#btn-skip').click();
      c.querySelector('#preview-toggle').click();
      const preview = c.querySelector('#ob-preview');
      expect(preview.classList.contains('expanded')).toBe(true);
    });
  });
});
