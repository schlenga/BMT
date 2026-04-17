const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);
  global.fetch = jest.fn(() => Promise.reject(new Error('no fetch')));

  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
  Wizard.reset();
});

describe('Wizard', () => {
  describe('initial render', () => {
    test('renders URL entry stage', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
      expect(container.querySelector('#ob-url')).toBeTruthy();
      expect(container.querySelector('#btn-analyze')).toBeTruthy();
      expect(container.querySelector('#btn-skip')).toBeTruthy();
    });

    test('URL input has type url', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      const input = container.querySelector('#ob-url');
      expect(input.type).toBe('url');
    });

    test('shows BMT logo', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-logo')).toBeTruthy();
      expect(container.querySelector('.ob-logo').textContent).toBe('BMT');
    });
  });

  describe('reset()', () => {
    test('returns to URL stage', () => {
      Wizard.reset();
      const container = document.getElementById('app');
      Wizard.render(container);
      expect(container.querySelector('.ob-entrance')).toBeTruthy();
    });
  });

  describe('skip to manual', () => {
    test('clicking skip goes to workspace stage', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('.ob-workspace')).toBeTruthy();
      expect(container.querySelector('.ob-greeting')).toBeTruthy();
    });

    test('workspace shows identity and customers cards', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      expect(container.querySelector('#ob-name')).toBeTruthy();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
    });

    test('greeting says "from scratch" when skipping', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      const greeting = container.querySelector('.ob-greeting');
      expect(greeting.textContent).toContain('from scratch');
    });
  });

  describe('workspace card interactions', () => {
    function goToWorkspace() {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      return container;
    }

    test('identity card has name input and proudOf textarea', () => {
      const container = goToWorkspace();
      expect(container.querySelector('#ob-name')).toBeTruthy();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
    });

    test('customers card has chip selector', () => {
      const container = goToWorkspace();
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('chip selection toggles active class', () => {
      const container = goToWorkspace();
      const chip = container.querySelector('#ob-segs .ob-chip');
      expect(chip.classList.contains('active')).toBe(false);
      chip.click();
      expect(chip.classList.contains('active')).toBe(true);
      chip.click();
      expect(chip.classList.contains('active')).toBe(false);
    });

    test('confirm identity requires name or proudOf', () => {
      const container = goToWorkspace();
      const nameInput = container.querySelector('#ob-name');
      const proudInput = container.querySelector('#ob-proud');
      nameInput.value = '';
      proudInput.value = '';

      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();

      expect(container.querySelector('#ob-name')).toBeTruthy();
    });

    test('confirm identity succeeds with name', () => {
      const container = goToWorkspace();
      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'Test Business';

      container.querySelector('#btn-confirm-identity').click();

      const summary = container.querySelector('[data-card="identity"] .ob-card-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('Test Business');
    });

    test('confirm customers disabled with no segments', () => {
      const container = goToWorkspace();
      const btn = container.querySelector('#btn-confirm-customers');
      expect(btn.disabled).toBe(true);
    });

    test('confirm customers enabled after chip selection', () => {
      const container = goToWorkspace();
      const chip = container.querySelector('#ob-segs .ob-chip');
      chip.click();
      const btn = container.querySelector('#btn-confirm-customers');
      expect(btn.disabled).toBe(false);
    });

    test('stage A to B advance after confirming identity + customers', () => {
      const container = goToWorkspace();

      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();

      const chip = container.querySelector('#ob-segs .ob-chip');
      chip.click();
      container.querySelector('#btn-confirm-customers').click();

      expect(container.querySelector('#ob-revenue')).toBeTruthy();
      expect(container.querySelector('#ob-team')).toBeTruthy();
    });

    test('economics card has revenue and team selects', () => {
      const container = goToWorkspace();

      container.querySelector('#ob-name').value = 'Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelector('#ob-segs .ob-chip').click();
      container.querySelector('#btn-confirm-customers').click();

      expect(container.querySelector('#ob-revenue')).toBeTruthy();
      expect(container.querySelector('#ob-team')).toBeTruthy();
      expect(container.querySelector('#ob-costs')).toBeTruthy();
    });

    test('confirm economics and ambition advances to stage C', () => {
      const container = goToWorkspace();

      container.querySelector('#ob-name').value = 'Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelector('#ob-segs .ob-chip').click();
      container.querySelector('#btn-confirm-customers').click();

      container.querySelector('#btn-confirm-economics').click();

      const skipFin = container.querySelector('#btn-skip-financials');
      if (skipFin) skipFin.click();

      const goalChip = container.querySelector('#ob-goals .ob-chip');
      goalChip.click();
      container.querySelector('#btn-confirm-ambition').click();

      expect(container.querySelector('[data-card="ambition"] .ob-card-summary')).toBeTruthy();
    });

    test('edit button reopens confirmed card', () => {
      const container = goToWorkspace();

      container.querySelector('#ob-name').value = 'Biz';
      container.querySelector('#btn-confirm-identity').click();

      const editBtn = container.querySelector('[data-edit="identity"]');
      editBtn.click();

      expect(container.querySelector('#ob-name')).toBeTruthy();
    });

    test('live canvas preview panel exists', () => {
      const container = goToWorkspace();
      expect(container.querySelector('.ob-preview-panel')).toBeTruthy();
      expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
    });

    test('custom segment can be added via enter key', () => {
      const container = goToWorkspace();
      const customInput = container.querySelector('#ob-seg-custom');
      customInput.value = 'Custom Segment';
      customInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);
    });
  });

  describe('resume from saved state', () => {
    test('restores saved onboarding data', () => {
      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'A',
        confirmed: { identity: false, customers: false, economics: false, financials: false, ambition: false },
        data: {
          websiteUrl: '', websiteData: null, brandColors: null,
          greeting: 'Welcome back',
          name: 'Saved Biz', type: 'service', description: '',
          proudOf: '', segments: [], revenueRange: '', costs: [],
          teamSize: '', goal: '', concern: '', toolPrefs: {},
          aiHypotheses: [], selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: ''
        }
      });

      Wizard.reset();
      const container = document.getElementById('app');
      Wizard.render(container);

      expect(container.querySelector('.ob-workspace')).toBeTruthy();
      const nameInput = container.querySelector('#ob-name');
      expect(nameInput.value).toBe('Saved Biz');
    });

    test('tryResume applies theme via applyTheme (bug fix)', () => {
      const palette = AI.generatePalette('#e74c3c');
      AI.applyTheme(palette);

      Store.saveOnboardingData({
        stage: 'workspace',
        cardStage: 'A',
        confirmed: { identity: false, customers: false, economics: false, financials: false, ambition: false },
        data: {
          websiteUrl: '', websiteData: null,
          brandColors: { primary: '#e74c3c', secondary: null },
          greeting: '', name: '', type: 'service', description: '',
          proudOf: '', segments: [], revenueRange: '', costs: [],
          teamSize: '', goal: '', concern: '', toolPrefs: {},
          aiHypotheses: [], selectedHypIds: null,
          startingCash: '', avgPrice: '', monthlyVolume: ''
        }
      });

      document.documentElement.style.removeProperty('--accent');
      Wizard.reset();
      const container = document.getElementById('app');
      Wizard.render(container);

      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#e74c3c');
    });
  });

  describe('financial details card', () => {
    function goToFinancials() {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      container.querySelector('#ob-name').value = 'Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelector('#ob-segs .ob-chip').click();
      container.querySelector('#btn-confirm-customers').click();
      container.querySelector('#btn-confirm-economics').click();
      return container;
    }

    test('financials card appears after economics confirmed', () => {
      const container = goToFinancials();
      expect(container.querySelector('#ob-cash')).toBeTruthy();
      expect(container.querySelector('#ob-price')).toBeTruthy();
      expect(container.querySelector('#ob-volume')).toBeTruthy();
    });

    test('skip financials uses defaults', () => {
      const container = goToFinancials();
      container.querySelector('#btn-skip-financials').click();

      expect(container.querySelector('[data-card="financials"] .ob-card-summary')).toBeTruthy();
    });

    test('confirm financials saves entered values', () => {
      const container = goToFinancials();
      container.querySelector('#ob-cash').value = '25000';
      container.querySelector('#ob-price').value = '50';
      container.querySelector('#ob-volume').value = '200';
      container.querySelector('#btn-confirm-financials').click();

      const summary = container.querySelector('[data-card="financials"] .ob-card-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('$25,000');
    });
  });
});
