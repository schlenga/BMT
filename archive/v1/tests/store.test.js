const { loadModules, resetLocalStorage } = require('./setup');

beforeAll(() => {
  loadModules(['store']);
});

beforeEach(() => {
  resetLocalStorage();
});

describe('Store', () => {
  describe('uid()', () => {
    test('generates unique IDs', () => {
      const id1 = Store.uid();
      const id2 = Store.uid();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    test('returns a string', () => {
      expect(typeof Store.uid()).toBe('string');
    });

    test('has expected format (base36 + random suffix)', () => {
      const id = Store.uid();
      expect(id.length).toBeGreaterThan(5);
      expect(/^[a-z0-9]+$/.test(id)).toBe(true);
    });
  });

  describe('Business', () => {
    test('getBusiness returns null when empty', () => {
      expect(Store.getBusiness()).toBeNull();
    });

    test('saveBusiness and getBusiness roundtrip', () => {
      const biz = { name: 'Test Biz', type: 'saas', description: 'A test', createdAt: '2025-01-01', stage: 'idea' };
      Store.saveBusiness(biz);
      const result = Store.getBusiness();
      expect(result.name).toBe('Test Biz');
      expect(result.type).toBe('saas');
      expect(result.stage).toBe('idea');
    });

    test('saveBusiness overwrites previous', () => {
      Store.saveBusiness({ name: 'First' });
      Store.saveBusiness({ name: 'Second' });
      expect(Store.getBusiness().name).toBe('Second');
    });
  });

  describe('Canvas', () => {
    test('getCanvas returns default canvas when empty', () => {
      const canvas = Store.getCanvas();
      expect(canvas).toHaveProperty('customerSegments');
      expect(canvas).toHaveProperty('valueProp');
      expect(canvas).toHaveProperty('channels');
      expect(canvas).toHaveProperty('customerRelationships');
      expect(canvas).toHaveProperty('revenueStreams');
      expect(canvas).toHaveProperty('keyResources');
      expect(canvas).toHaveProperty('keyActivities');
      expect(canvas).toHaveProperty('keyPartners');
      expect(canvas).toHaveProperty('costStructure');
      expect(canvas.customerSegments).toEqual([]);
    });

    test('addCanvasItem adds to correct element', () => {
      const item = Store.addCanvasItem('customerSegments', 'Young professionals');
      expect(item.id).toBeTruthy();
      expect(item.text).toBe('Young professionals');
      expect(item.notes).toBe('');

      const canvas = Store.getCanvas();
      expect(canvas.customerSegments).toHaveLength(1);
      expect(canvas.customerSegments[0].text).toBe('Young professionals');
    });

    test('addCanvasItem creates element array if missing', () => {
      Store.saveCanvas({});
      const item = Store.addCanvasItem('valueProp', 'Great coffee');
      expect(item.text).toBe('Great coffee');
      const canvas = Store.getCanvas();
      expect(canvas.valueProp).toHaveLength(1);
    });

    test('addCanvasItem to multiple elements sequentially', () => {
      Store.addCanvasItem('customerSegments', 'Seg 1');
      Store.addCanvasItem('valueProp', 'VP 1');
      Store.addCanvasItem('customerSegments', 'Seg 2');
      const canvas = Store.getCanvas();
      expect(canvas.customerSegments).toHaveLength(2);
      expect(canvas.valueProp).toHaveLength(1);
    });

    test('updateCanvasItem updates text', () => {
      const item = Store.addCanvasItem('channels', 'Social media');
      Store.updateCanvasItem('channels', item.id, 'Instagram');
      const canvas = Store.getCanvas();
      expect(canvas.channels[0].text).toBe('Instagram');
    });

    test('updateCanvasItem with non-existent element does nothing', () => {
      Store.updateCanvasItem('nonExistent', 'fake-id', 'text');
      // Should not throw
    });

    test('removeCanvasItem removes by id', () => {
      const item1 = Store.addCanvasItem('costStructure', 'Rent');
      const item2 = Store.addCanvasItem('costStructure', 'Staff');
      Store.removeCanvasItem('costStructure', item1.id);
      const canvas = Store.getCanvas();
      expect(canvas.costStructure).toHaveLength(1);
      expect(canvas.costStructure[0].text).toBe('Staff');
    });

    test('removeCanvasItem with non-existent element does nothing', () => {
      Store.removeCanvasItem('nonExistent', 'fake-id');
      // Should not throw
    });
  });

  describe('Hypotheses', () => {
    test('getHypotheses returns empty array when none', () => {
      expect(Store.getHypotheses()).toEqual([]);
    });

    test('addHypothesis adds with auto-generated fields', () => {
      const hyp = Store.addHypothesis({
        statement: 'Customers will pay $10/month',
        category: 'revenue',
        canvasElement: 'revenueStreams'
      });
      expect(hyp.id).toBeTruthy();
      expect(hyp.createdAt).toBeTruthy();
      expect(hyp.status).toBe('testing');
      expect(hyp.actuals).toEqual([]);
      expect(Store.getHypotheses()).toHaveLength(1);
    });

    test('addHypothesis preserves provided id and status', () => {
      const hyp = Store.addHypothesis({
        id: 'custom-id',
        status: 'validated',
        statement: 'Test'
      });
      expect(hyp.id).toBe('custom-id');
      expect(hyp.status).toBe('validated');
    });

    test('updateHypothesis updates specific fields', () => {
      const hyp = Store.addHypothesis({ statement: 'Original', category: 'value' });
      Store.updateHypothesis(hyp.id, { status: 'validated', statement: 'Updated' });
      const updated = Store.getHypotheses()[0];
      expect(updated.status).toBe('validated');
      expect(updated.statement).toBe('Updated');
      expect(updated.category).toBe('value');
    });

    test('updateHypothesis with non-existent id does nothing', () => {
      Store.addHypothesis({ statement: 'Test' });
      Store.updateHypothesis('non-existent', { status: 'validated' });
      expect(Store.getHypotheses()[0].status).toBe('testing');
    });

    test('removeHypothesis removes by id', () => {
      const h1 = Store.addHypothesis({ statement: 'First' });
      const h2 = Store.addHypothesis({ statement: 'Second' });
      Store.removeHypothesis(h1.id);
      const remaining = Store.getHypotheses();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].statement).toBe('Second');
    });

    test('addActual adds data point to hypothesis', () => {
      const hyp = Store.addHypothesis({ statement: 'Test' });
      Store.addActual(hyp.id, { value: 42, note: 'First measurement' });
      const updated = Store.getHypotheses()[0];
      expect(updated.actuals).toHaveLength(1);
      expect(updated.actuals[0].value).toBe(42);
      expect(updated.actuals[0].note).toBe('First measurement');
      expect(updated.actuals[0].date).toBeTruthy();
    });

    test('addActual preserves existing actuals', () => {
      const hyp = Store.addHypothesis({ statement: 'Test' });
      Store.addActual(hyp.id, { value: 10, note: 'First' });
      Store.addActual(hyp.id, { value: 20, note: 'Second' });
      const updated = Store.getHypotheses()[0];
      expect(updated.actuals).toHaveLength(2);
      expect(updated.actuals[0].value).toBe(10);
      expect(updated.actuals[1].value).toBe(20);
    });

    test('addActual with non-existent id does nothing', () => {
      Store.addActual('non-existent', { value: 1 });
      // Should not throw
    });
  });

  describe('Wizard', () => {
    test('isWizardComplete returns false initially', () => {
      expect(Store.isWizardComplete()).toBe(false);
    });

    test('setWizardComplete sets flag', () => {
      Store.setWizardComplete();
      expect(Store.isWizardComplete()).toBe(true);
    });
  });

  describe('Theme', () => {
    test('getTheme returns null when empty', () => {
      expect(Store.getTheme()).toBeNull();
    });

    test('saveTheme and getTheme roundtrip', () => {
      const theme = { accent: '#ff6600', bg: '#fafafa' };
      Store.saveTheme(theme);
      expect(Store.getTheme()).toEqual(theme);
    });
  });

  describe('Terminology', () => {
    test('getTerminology returns null when empty', () => {
      expect(Store.getTerminology()).toBeNull();
    });

    test('saveTerminology and getTerminology roundtrip', () => {
      const terms = { labels: { customerSegments: 'Guests' } };
      Store.saveTerminology(terms);
      expect(Store.getTerminology()).toEqual(terms);
    });
  });

  describe('Tool Preferences', () => {
    test('getToolPrefs returns empty object initially', () => {
      expect(Store.getToolPrefs()).toEqual({});
    });

    test('saveToolPrefs and getToolPrefs roundtrip', () => {
      const prefs = { social: ['instagram', 'tiktok'], email: ['mailchimp'] };
      Store.saveToolPrefs(prefs);
      expect(Store.getToolPrefs()).toEqual(prefs);
    });
  });

  describe('Prompt State', () => {
    test('getPromptState returns defaults', () => {
      const state = Store.getPromptState();
      expect(state.completed).toEqual([]);
      expect(state.dismissed).toEqual([]);
    });

    test('completePrompt adds to completed list', () => {
      Store.completePrompt('test-key', 'hyp-123');
      const state = Store.getPromptState();
      expect(state.completed).toHaveLength(1);
      expect(state.completed[0].key).toBe('test-key');
      expect(state.completed[0].hypId).toBe('hyp-123');
      expect(state.completed[0].at).toBeTruthy();
    });

    test('dismissPrompt adds to dismissed list', () => {
      Store.dismissPrompt('some-key');
      expect(Store.getPromptState().dismissed).toContain('some-key');
    });

    test('dismissPrompt does not duplicate', () => {
      Store.dismissPrompt('dup-key');
      Store.dismissPrompt('dup-key');
      expect(Store.getPromptState().dismissed.filter(d => d === 'dup-key')).toHaveLength(1);
    });
  });

  describe('Onboarding Data', () => {
    test('getOnboardingData returns null initially', () => {
      expect(Store.getOnboardingData()).toBeNull();
    });

    test('save and get onboarding data roundtrip', () => {
      const data = { step: 3, data: { name: 'Test' }, messages: [] };
      Store.saveOnboardingData(data);
      expect(Store.getOnboardingData()).toEqual(data);
    });

    test('clearOnboardingData removes data', () => {
      Store.saveOnboardingData({ step: 1 });
      Store.clearOnboardingData();
      expect(Store.getOnboardingData()).toBeNull();
    });
  });

  describe('Export / Import', () => {
    test('exportAll returns valid JSON with all fields', () => {
      Store.saveBusiness({ name: 'Export Test' });
      Store.addCanvasItem('valueProp', 'Great value');
      Store.addHypothesis({ statement: 'Test hyp' });
      Store.setWizardComplete();

      const json = Store.exportAll();
      const data = JSON.parse(json);
      expect(data.business.name).toBe('Export Test');
      expect(data.canvas.valueProp).toHaveLength(1);
      expect(data.hypotheses).toHaveLength(1);
      expect(data.wizardComplete).toBe(true);
      expect(data.exportedAt).toBeTruthy();
    });

    test('importAll restores data', () => {
      const importData = {
        business: { name: 'Imported Biz' },
        canvas: { customerSegments: [{ id: '1', text: 'Seg 1', notes: '' }], valueProp: [], channels: [], customerRelationships: [], revenueStreams: [], keyResources: [], keyActivities: [], keyPartners: [], costStructure: [] },
        hypotheses: [{ id: 'h1', statement: 'Imported hyp', status: 'testing', actuals: [] }],
        wizardComplete: true,
        toolPrefs: { social: ['instagram'] },
        promptState: { completed: [], dismissed: ['key1'] }
      };

      const result = Store.importAll(JSON.stringify(importData));
      expect(result).toBe(true);
      expect(Store.getBusiness().name).toBe('Imported Biz');
      expect(Store.getCanvas().customerSegments).toHaveLength(1);
      expect(Store.getHypotheses()).toHaveLength(1);
      expect(Store.isWizardComplete()).toBe(true);
      expect(Store.getToolPrefs()).toEqual({ social: ['instagram'] });
      expect(Store.getPromptState().dismissed).toContain('key1');
    });

    test('importAll returns false on invalid JSON', () => {
      expect(Store.importAll('not valid json')).toBe(false);
    });

    test('importAll handles partial data', () => {
      const result = Store.importAll(JSON.stringify({ business: { name: 'Partial' } }));
      expect(result).toBe(true);
      expect(Store.getBusiness().name).toBe('Partial');
    });

    test('importAll with empty object succeeds', () => {
      const result = Store.importAll(JSON.stringify({}));
      expect(result).toBe(true);
    });
  });

  describe('resetAll', () => {
    test('clears all stored data', () => {
      Store.saveBusiness({ name: 'Test' });
      Store.addHypothesis({ statement: 'Hyp' });
      Store.setWizardComplete();
      Store.saveToolPrefs({ social: ['ig'] });
      Store.saveTheme({ accent: '#ff0000' });
      Store.saveTerminology({ labels: { customerSegments: 'Guests' } });

      Store.resetAll();

      expect(Store.getBusiness()).toBeNull();
      expect(Store.getHypotheses()).toEqual([]);
      expect(Store.isWizardComplete()).toBe(false);
      expect(Store.getToolPrefs()).toEqual({});
      expect(Store.getTheme()).toBeNull();
      expect(Store.getTerminology()).toBeNull();
    });
  });

  describe('Error handling', () => {
    test('get returns null for corrupted JSON in localStorage', () => {
      localStorage.setItem('bmt_business', '{invalid json}}}');
      expect(Store.getBusiness()).toBeNull();
    });
  });
});
