const { loadModules, resetLocalStorage } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'prompts']);
});

beforeEach(() => {
  resetLocalStorage();
});

describe('Prompts', () => {
  describe('TOOL_CONNECTORS', () => {
    test('has expected tools', () => {
      expect(Prompts.TOOL_CONNECTORS.buffer).toBeTruthy();
      expect(Prompts.TOOL_CONNECTORS.instagram).toBeTruthy();
      expect(Prompts.TOOL_CONNECTORS.stripe).toBeTruthy();
      expect(Prompts.TOOL_CONNECTORS.hubspot).toBeTruthy();
    });

    test('each tool has name, icon, and categories', () => {
      for (const [id, tool] of Object.entries(Prompts.TOOL_CONNECTORS)) {
        expect(tool.name).toBeTruthy();
        expect(tool.icon).toBeTruthy();
        expect(Array.isArray(tool.categories)).toBe(true);
        expect(tool.categories.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TOOL_CATEGORIES', () => {
    test('has expected categories', () => {
      const ids = Prompts.TOOL_CATEGORIES.map(c => c.id);
      expect(ids).toContain('social');
      expect(ids).toContain('email');
      expect(ids).toContain('payments');
      expect(ids).toContain('crm');
    });

    test('all tool IDs reference valid connectors', () => {
      Prompts.TOOL_CATEGORIES.forEach(cat => {
        cat.tools.forEach(tid => {
          expect(Prompts.TOOL_CONNECTORS[tid]).toBeTruthy();
        });
      });
    });
  });

  describe('generateSync()', () => {
    test('returns empty array with no hypotheses', () => {
      const result = Prompts.generateSync([], null, {}, { completed: [], dismissed: [] });
      // Should still have business-level prompts
      expect(Array.isArray(result)).toBe(true);
    });

    test('generates stale reminders for old hypotheses', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'customer',
        statement: 'Customers will come',
        createdAt: oldDate.toISOString().slice(0, 10),
        actuals: [],
        target: 10,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const stalePrompt = result.find(p => p.key.startsWith('stale-'));
      expect(stalePrompt).toBeTruthy();
      expect(stalePrompt.urgency).toBe('high');
    });

    test('generates customer talk prompts for new customer hypotheses', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'customer',
        statement: 'Young professionals will be interested in our offering',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 10,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const talkPrompt = result.find(p => p.key.startsWith('customer-talk-'));
      expect(talkPrompt).toBeTruthy();
      expect(talkPrompt.title).toContain('Talk to 5');
    });

    test('generates value prompts for restaurant type', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'value',
        statement: 'People love our food',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 10,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation', type: 'restaurant' }, {}, { completed: [], dismissed: [] });
      const valuePrompt = result.find(p => p.key.startsWith('value-sample-'));
      expect(valuePrompt).toBeTruthy();
      expect(valuePrompt.title).toContain('free sample');
    });

    test('generates value prompts for saas type', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'value',
        statement: 'Users want this feature',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 5,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation', type: 'saas' }, {}, { completed: [], dismissed: [] });
      const valuePrompt = result.find(p => p.key.startsWith('value-mockup-'));
      expect(valuePrompt).toBeTruthy();
    });

    test('generates revenue presell for new revenue hypotheses', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'revenue',
        statement: 'Customers will pay $50/month',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 1000,
        unit: '$/month',
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const revPrompt = result.find(p => p.key.startsWith('revenue-presell-'));
      expect(revPrompt).toBeTruthy();
    });

    test('generates pivot prompt for invalidated hypotheses', () => {
      const hyps = [{
        id: 'h1',
        status: 'invalidated',
        category: 'customer',
        statement: 'Wrong assumption',
        createdAt: '2025-01-01',
        actuals: [{ date: '2025-01-15', value: 1 }],
        target: 50,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const pivotPrompt = result.find(p => p.key.startsWith('pivot-'));
      expect(pivotPrompt).toBeTruthy();
      expect(pivotPrompt.title).toContain('pivot');
    });

    test('generates double-down prompt for validated hypotheses', () => {
      const hyps = [{
        id: 'h1',
        status: 'validated',
        category: 'value',
        statement: 'People love us',
        createdAt: '2025-01-01',
        actuals: [{ date: '2025-01-15', value: 100 }],
        target: 50,
        priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const ddPrompt = result.find(p => p.key.startsWith('double-down-'));
      expect(ddPrompt).toBeTruthy();
    });

    test('filters out completed prompts', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'customer',
        statement: 'Test',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 10,
        priority: 'critical'
      }];

      const promptState = {
        completed: [{ key: 'customer-talk-h1', at: '2025-01-01' }],
        dismissed: []
      };

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, promptState);
      const talkPrompt = result.find(p => p.key === 'customer-talk-h1');
      expect(talkPrompt).toBeUndefined();
    });

    test('filters out dismissed prompts', () => {
      const promptState = {
        completed: [],
        dismissed: ['biz-pitch', 'biz-competitors']
      };

      const result = Prompts.generateSync([], { stage: 'idea' }, {}, promptState);
      const pitchPrompt = result.find(p => p.key === 'biz-pitch');
      expect(pitchPrompt).toBeUndefined();
    });

    test('sorts by urgency (high first)', () => {
      const hyps = [
        {
          id: 'h1', status: 'validated', category: 'value', statement: 'Test',
          createdAt: '2025-01-01', actuals: [{ date: '2025-01-15', value: 100 }], target: 50, priority: 'critical'
        },
        {
          id: 'h2', status: 'testing', category: 'customer', statement: 'Young professionals will be interested',
          createdAt: new Date().toISOString().slice(0, 10), actuals: [], target: 10, priority: 'critical'
        }
      ];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      if (result.length >= 2) {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        for (let i = 0; i < result.length - 1; i++) {
          expect(urgencyOrder[result[i].urgency]).toBeLessThanOrEqual(urgencyOrder[result[i + 1].urgency]);
        }
      }
    });

    test('limits to 8 prompts maximum', () => {
      const hyps = [];
      for (let i = 0; i < 20; i++) {
        hyps.push({
          id: 'h' + i, status: 'testing', category: 'customer',
          statement: 'Segment ' + i + ' will be interested',
          createdAt: '2025-01-01', actuals: [], target: 10, priority: 'critical'
        });
      }

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      expect(result.length).toBeLessThanOrEqual(8);
    });

    test('includes tool connector when user has tool', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'revenue',
        statement: 'People will pay',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 1000,
        priority: 'critical'
      }];

      const toolPrefs = { payments: ['stripe'] };
      const result = Prompts.generateSync(hyps, { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const revPrompt = result.find(p => p.key.startsWith('revenue-presell-'));
      expect(revPrompt).toBeTruthy();
      expect(revPrompt.tool).toBeTruthy();
      expect(revPrompt.tool.name).toBe('Stripe');
    });

    test('includes social media prompts for growth hypothesis with social keywords', () => {
      const hyps = [{
        id: 'h1',
        status: 'testing',
        category: 'growth',
        statement: 'Instagram will drive 50 signups',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [],
        target: 50,
        priority: 'important'
      }];

      const toolPrefs = { social: ['instagram'] };
      const result = Prompts.generateSync(hyps, { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const socialPrompt = result.find(p => p.key.startsWith('growth-social-'));
      expect(socialPrompt).toBeTruthy();
      expect(socialPrompt.tool).toBeTruthy();
    });

    test('business-level prompts for growth stage include scale prompt', () => {
      const result = Prompts.generateSync([], { stage: 'growth' }, {}, { completed: [], dismissed: [] });
      const scalePrompt = result.find(p => p.key === 'biz-scale');
      expect(scalePrompt).toBeTruthy();
    });
  });

  describe('generate() (async)', () => {
    test('returns prompts as a Promise', async () => {
      // Mock fetch to fail so it falls back to sync generation
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

      const result = await Prompts.generate([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      expect(Array.isArray(result)).toBe(true);

      global.fetch = originalFetch;
    });
  });
});
