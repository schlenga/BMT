const { loadModules, resetLocalStorage } = require('./setup');

beforeAll(() => {
  loadModules(['store']);
});

beforeEach(() => {
  resetLocalStorage();
});

describe('Store simulation data', () => {
  test('getSimConfig returns null when nothing saved', () => {
    expect(Store.getSimConfig()).toBeNull();
  });

  test('getSimResults returns null when nothing saved', () => {
    expect(Store.getSimResults()).toBeNull();
  });

  test('overwriting sim config replaces previous', () => {
    Store.saveSimConfig({ startingCash: 1000 });
    Store.saveSimConfig({ startingCash: 2000 });
    expect(Store.getSimConfig().startingCash).toBe(2000);
  });

  test('sim config survives round-trip through JSON', () => {
    const config = {
      businessType: 'saas',
      projectionMonths: 36,
      startingCash: 50000,
      revenueStreams: [{ id: 'rs1', name: 'Subs', type: 'recurring', unitPrice: 29 }],
      staff: [{ role: 'Dev', count: 2, monthlyCost: 7000 }]
    };
    Store.saveSimConfig(config);
    const loaded = Store.getSimConfig();
    expect(loaded).toEqual(config);
  });

  test('sim results survive round-trip', () => {
    const results = {
      months: [{ month: 1, revenue: 5000, cashBalance: 45000 }],
      years: [{ year: 1, revenue: 60000 }],
      summary: { breakEvenMonth: 4 }
    };
    Store.saveSimResults(results);
    expect(Store.getSimResults()).toEqual(results);
  });
});

describe('Store exportAll includes simResults', () => {
  test('export includes simResults field', () => {
    Store.saveSimResults({ months: [{ month: 1 }] });
    const exported = JSON.parse(Store.exportAll());
    expect(exported).toHaveProperty('simResults');
    expect(exported.simResults.months).toHaveLength(1);
  });

  test('export with no simResults includes null', () => {
    const exported = JSON.parse(Store.exportAll());
    expect(exported.simResults).toBeNull();
  });
});

describe('Store importAll handles simResults', () => {
  test('import restores simResults', () => {
    const data = {
      simResults: { months: [{ month: 1, revenue: 999 }] }
    };
    Store.importAll(JSON.stringify(data));
    expect(Store.getSimResults().months[0].revenue).toBe(999);
  });

  test('import without simResults does not crash', () => {
    const data = { business: { name: 'Test' } };
    expect(Store.importAll(JSON.stringify(data))).toBe(true);
    expect(Store.getSimResults()).toBeNull();
  });

  test('full export/import round-trip preserves simResults', () => {
    Store.saveSimConfig({ businessType: 'test' });
    Store.saveSimResults({ months: [{ month: 1, revenue: 500 }], summary: { breakEvenMonth: 3 } });

    const exported = Store.exportAll();
    Store.resetAll();

    expect(Store.getSimResults()).toBeNull();
    Store.importAll(exported);

    expect(Store.getSimConfig().businessType).toBe('test');
    expect(Store.getSimResults().months[0].revenue).toBe(500);
    expect(Store.getSimResults().summary.breakEvenMonth).toBe(3);
  });
});

describe('Store edge cases', () => {
  test('importAll with invalid JSON returns false', () => {
    expect(Store.importAll('not json')).toBe(false);
  });

  test('importAll with empty object returns true', () => {
    expect(Store.importAll('{}')).toBe(true);
  });

  test('resetAll clears sim data', () => {
    Store.saveSimConfig({ test: true });
    Store.saveSimResults({ test: true });
    Store.resetAll();
    expect(Store.getSimConfig()).toBeNull();
    expect(Store.getSimResults()).toBeNull();
  });

  test('onboarding data round-trip', () => {
    const data = { stage: 'workspace', cardStage: 'B', confirmed: { identity: true } };
    Store.saveOnboardingData(data);
    expect(Store.getOnboardingData()).toEqual(data);
    Store.clearOnboardingData();
    expect(Store.getOnboardingData()).toBeNull();
  });

  test('promptState defaults to empty arrays', () => {
    const state = Store.getPromptState();
    expect(state.completed).toEqual([]);
    expect(state.dismissed).toEqual([]);
  });

  test('completePrompt appends to completed', () => {
    Store.completePrompt('test-key', 'hyp-1');
    const state = Store.getPromptState();
    expect(state.completed).toHaveLength(1);
    expect(state.completed[0].key).toBe('test-key');
    expect(state.completed[0].hypId).toBe('hyp-1');
  });

  test('dismissPrompt deduplicates', () => {
    Store.dismissPrompt('key-1');
    Store.dismissPrompt('key-1');
    const state = Store.getPromptState();
    expect(state.dismissed).toHaveLength(1);
  });

  test('uid generates unique ids', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(Store.uid());
    }
    expect(ids.size).toBe(100);
  });
});
