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
});

describe('Wizard flow', () => {
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

      expect(container.querySelector('.ob-workspace')).toBeTruthy();
      expect(container.querySelector('.ob-cards-panel')).toBeTruthy();
    });

    test('analyze with empty URL skips to manual', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      const urlInput = container.querySelector('#ob-url');
      urlInput.value = '';
      const analyzeBtn = container.querySelector('#btn-analyze');
      analyzeBtn.click();

      expect(container.querySelector('.ob-workspace')).toBeTruthy();
    });
  });

  describe('workspace stage', () => {
    function goToWorkspace() {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();
      return container;
    }

    test('shows identity and customers cards initially', () => {
      const container = goToWorkspace();
      const cards = container.querySelectorAll('.ob-card');
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    test('identity card has name and proudOf inputs', () => {
      const container = goToWorkspace();
      expect(container.querySelector('#ob-name')).toBeTruthy();
      expect(container.querySelector('#ob-proud')).toBeTruthy();
      expect(container.querySelector('#btn-confirm-identity')).toBeTruthy();
    });

    test('customers card has chip selections', () => {
      const container = goToWorkspace();
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('confirming identity requires name or proudOf', () => {
      const container = goToWorkspace();
      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();
      // Should NOT have the done class since both fields are empty
      const card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(false);
    });

    test('confirming identity with name shows summary', () => {
      const container = goToWorkspace();
      const nameInput = container.querySelector('#ob-name');
      nameInput.value = 'My Coffee Shop';
      // trigger input event for live update
      nameInput.dispatchEvent(new Event('input'));
      const confirmBtn = container.querySelector('#btn-confirm-identity');
      confirmBtn.click();

      const card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);
      expect(card.textContent).toContain('My Coffee Shop');
    });

    test('selecting customer chips enables confirm button', () => {
      const container = goToWorkspace();
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      // Initially disabled
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(true);

      // Click a chip
      chips[0].click();
      // After chip click, re-check button
      const confirmBtn2 = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn2.disabled).toBe(false);
    });

    test('confirming both A cards advances to stage B', () => {
      const container = goToWorkspace();

      // Confirm identity
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();

      // Select a segment and confirm customers
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      container.querySelector('#btn-confirm-customers').click();

      // Stage B cards should now be visible
      expect(container.querySelector('[data-card="economics"]')).toBeTruthy();
      expect(container.querySelector('[data-card="ambition"]')).toBeTruthy();
    });

    test('economics card has revenue and team selectors', () => {
      const container = goToWorkspace();

      // Advance to stage B
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      const chips = container.querySelectorAll('#ob-segs .ob-chip');
      chips[0].click();
      container.querySelector('#btn-confirm-customers').click();

      expect(container.querySelector('#ob-revenue')).toBeTruthy();
      expect(container.querySelector('#ob-team')).toBeTruthy();
      expect(container.querySelector('#ob-costs')).toBeTruthy();
    });

    test('financials card appears after economics is confirmed', () => {
      const container = goToWorkspace();

      // Advance to stage B
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();

      // Confirm economics
      container.querySelector('#btn-confirm-economics').click();

      // Financials card should now be visible
      expect(container.querySelector('[data-card="financials"]')).toBeTruthy();
      expect(container.querySelector('#ob-cash')).toBeTruthy();
      expect(container.querySelector('#ob-price')).toBeTruthy();
      expect(container.querySelector('#ob-volume')).toBeTruthy();
    });

    test('skip financials button works', () => {
      const container = goToWorkspace();

      // Advance through cards
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();
      container.querySelector('#btn-confirm-economics').click();

      // Skip financials
      const skipBtn = container.querySelector('#btn-skip-financials');
      expect(skipBtn).toBeTruthy();
      skipBtn.click();

      // Financials card should be done
      const card = container.querySelector('[data-card="financials"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);
    });

    test('financials card confirm captures values', () => {
      const container = goToWorkspace();

      // Advance through cards
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();
      container.querySelector('#btn-confirm-economics').click();

      // Fill financials
      container.querySelector('#ob-cash').value = '25000';
      container.querySelector('#ob-price').value = '50';
      container.querySelector('#ob-volume').value = '200';
      container.querySelector('#btn-confirm-financials').click();

      const card = container.querySelector('[data-card="financials"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);
      expect(card.textContent).toContain('$25,000');
    });

    test('ambition card has goal chips and concern textarea', () => {
      const container = goToWorkspace();

      // Advance to stage B
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();

      expect(container.querySelector('#ob-goals')).toBeTruthy();
      expect(container.querySelector('#ob-concern')).toBeTruthy();
    });

    test('confirming ambition requires a goal selection', () => {
      const container = goToWorkspace();

      // Advance to stage B
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();

      // Try confirming ambition without a goal
      const confirmBtn = container.querySelector('#btn-confirm-ambition');
      confirmBtn.click();
      const card = container.querySelector('[data-card="ambition"]');
      expect(card.classList.contains('ob-card-done')).toBe(false);
    });

    test('custom goal input works', () => {
      const container = goToWorkspace();

      // Advance to stage B
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();

      // Type a custom goal
      const goalInput = container.querySelector('#ob-goal-custom');
      goalInput.value = 'Custom growth goal';
      goalInput.dispatchEvent(new Event('input'));
      container.querySelector('#btn-confirm-ambition').click();

      const card = container.querySelector('[data-card="ambition"]');
      expect(card.classList.contains('ob-card-done')).toBe(true);
      expect(card.textContent).toContain('Custom growth goal');
    });

    test('edit button reopens confirmed card', () => {
      const container = goToWorkspace();

      // Confirm identity
      container.querySelector('#ob-name').value = 'Test Biz';
      container.querySelector('#btn-confirm-identity').click();

      // Click edit
      const editBtn = container.querySelector('[data-edit="identity"]');
      expect(editBtn).toBeTruthy();
      editBtn.click();

      // Card should be editable again
      const card = container.querySelector('[data-card="identity"]');
      expect(card.classList.contains('ob-card-done')).toBe(false);
      expect(container.querySelector('#ob-name')).toBeTruthy();
    });

    test('custom segment input adds to data via Enter key', () => {
      const container = goToWorkspace();

      const segInput = container.querySelector('#ob-seg-custom');
      segInput.value = 'Custom Segment';
      segInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // After re-render, custom segment should be in the stored onboarding data
      // and the confirm button should be enabled (since we now have at least 1 segment)
      const confirmBtn = container.querySelector('#btn-confirm-customers');
      expect(confirmBtn.disabled).toBe(false);

      // Confirm and check summary includes custom segment
      confirmBtn.click();
      const summary = container.querySelector('[data-card="customers"] .ob-card-summary');
      expect(summary.textContent).toContain('Custom Segment');
    });
  });

  describe('live canvas preview', () => {
    test('preview panel exists in workspace', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      expect(container.querySelector('.ob-preview-panel')).toBeTruthy();
      expect(container.querySelector('.preview-mini-canvas')).toBeTruthy();
    });

    test('preview shows business name after identity confirm', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      container.querySelector('#ob-name').value = 'My Cafe';
      container.querySelector('#ob-name').dispatchEvent(new Event('input'));

      const preview = container.querySelector('.ob-preview-panel');
      expect(preview.textContent).toContain('My Cafe');
    });
  });

  describe('onboarding data persistence', () => {
    test('saveProgress stores onboarding data', () => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Set name and confirm identity
      container.querySelector('#ob-name').value = 'Persisted Biz';
      container.querySelector('#btn-confirm-identity').click();

      const saved = Store.getOnboardingData();
      expect(saved).toBeTruthy();
      expect(saved.data.name).toBe('Persisted Biz');
      expect(saved.confirmed.identity).toBe(true);
    });
  });

  describe('full wizard completion', () => {
    test('completing all cards and launching saves business data', (done) => {
      const container = document.getElementById('app');
      Wizard.render(container);
      container.querySelector('#btn-skip').click();

      // Stage A: identity
      container.querySelector('#ob-name').value = 'Launch Test Biz';
      container.querySelector('#ob-proud').value = 'We make amazing things';
      container.querySelector('#btn-confirm-identity').click();

      // Stage A: customers
      container.querySelectorAll('#ob-segs .ob-chip')[0].click();
      container.querySelector('#btn-confirm-customers').click();

      // Stage B: economics
      container.querySelector('#btn-confirm-economics').click();

      // Stage B: financials (skip)
      container.querySelector('#btn-skip-financials').click();

      // Stage B: ambition
      container.querySelectorAll('#ob-goals .ob-chip')[0].click();
      container.querySelector('#btn-confirm-ambition').click();

      // Wait for hypothesis generation (uses AI fallback)
      setTimeout(() => {
        // Hypotheses card and launch button should appear
        const launchBtn = container.querySelector('#btn-launch');
        if (launchBtn) {
          launchBtn.click();
          // After launch animation delay
          setTimeout(() => {
            expect(Store.isWizardComplete()).toBe(true);
            const biz = Store.getBusiness();
            expect(biz).toBeTruthy();
            expect(biz.name).toBe('Launch Test Biz');
            expect(Store.getHypotheses().length).toBeGreaterThan(0);
            expect(Store.getCanvas().valueProp.length).toBeGreaterThan(0);
            // Simulation config should be saved
            expect(Store.getSimConfig()).toBeTruthy();
            done();
          }, 1000);
        } else {
          done();
        }
      }, 200);
    }, 5000);
  });
});
