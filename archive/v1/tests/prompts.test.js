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
    test('returns array with no hypotheses', () => {
      const result = Prompts.generateSync([], null, {}, { completed: [], dismissed: [] });
      expect(Array.isArray(result)).toBe(true);
    });

    test('generates stale reminders for old hypotheses', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const hyps = [{
        id: 'h1', status: 'testing', category: 'customer',
        statement: 'Customers will come',
        createdAt: oldDate.toISOString().slice(0, 10),
        actuals: [], target: 10, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const stalePrompt = result.find(p => p.key.startsWith('stale-'));
      expect(stalePrompt).toBeTruthy();
      expect(stalePrompt.urgency).toBe('high');
    });

    test('generates customer talk prompts for new customer hypotheses', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'customer',
        statement: 'Young professionals will be interested in our offering',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 10, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const talkPrompt = result.find(p => p.key.startsWith('customer-talk-'));
      expect(talkPrompt).toBeTruthy();
      expect(talkPrompt.title).toContain('Talk to 5');
    });

    test('generates customer survey when progress < 50%', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'customer',
        statement: 'Young professionals interested',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [{ date: new Date().toISOString().slice(0, 10), value: 3 }],
        target: 10, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const surveyPrompt = result.find(p => p.key.startsWith('customer-survey-'));
      expect(surveyPrompt).toBeTruthy();
    });

    test('generates value prompts for restaurant type', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'value',
        statement: 'People love our food',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 10, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation', type: 'restaurant' }, {}, { completed: [], dismissed: [] });
      const valuePrompt = result.find(p => p.key.startsWith('value-sample-'));
      expect(valuePrompt).toBeTruthy();
      expect(valuePrompt.title).toContain('free sample');
    });

    test('generates value prompts for saas type', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'value',
        statement: 'Users want this feature',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 5, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation', type: 'saas' }, {}, { completed: [], dismissed: [] });
      const valuePrompt = result.find(p => p.key.startsWith('value-mockup-'));
      expect(valuePrompt).toBeTruthy();
    });

    test('generates landing page prompt for service type value hypothesis', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'value',
        statement: 'Clients need consulting',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 5, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation', type: 'service' }, {}, { completed: [], dismissed: [] });
      const landingPrompt = result.find(p => p.key.startsWith('value-landing-'));
      expect(landingPrompt).toBeTruthy();
    });

    test('generates revenue presell for new revenue hypotheses', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'revenue',
        statement: 'Customers will pay $50/month',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 1000, unit: '$/month', priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const revPrompt = result.find(p => p.key.startsWith('revenue-presell-'));
      expect(revPrompt).toBeTruthy();
    });

    test('generates pricing test when revenue progress < 30%', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'revenue',
        statement: 'Revenue will reach $5000',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [{ date: new Date().toISOString().slice(0, 10), value: 1000 }],
        target: 5000, unit: '$/month', priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const pricingPrompt = result.find(p => p.key.startsWith('revenue-pricing-'));
      expect(pricingPrompt).toBeTruthy();
    });

    test('generates social prompt for growth hypothesis with social keywords', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'growth',
        statement: 'Instagram will drive 50 signups',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 50, priority: 'important'
      }];

      const toolPrefs = { social: ['instagram'] };
      const result = Prompts.generateSync(hyps, { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const socialPrompt = result.find(p => p.key.startsWith('growth-social-'));
      expect(socialPrompt).toBeTruthy();
      expect(socialPrompt.tool).toBeTruthy();
    });

    test('generates google prompt for growth hypothesis with SEO keywords', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'growth',
        statement: 'Google search will drive traffic',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 100, priority: 'important'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const googlePrompt = result.find(p => p.key.startsWith('growth-google-'));
      expect(googlePrompt).toBeTruthy();
    });

    test('generates email prompt for growth hypothesis with email keywords', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'growth',
        statement: 'Email newsletter will convert',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 50, priority: 'important'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const emailPrompt = result.find(p => p.key.startsWith('growth-email-'));
      expect(emailPrompt).toBeTruthy();
    });

    test('generates ad experiment for generic growth hypothesis', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'growth',
        statement: 'We can reach 100 new people via paid channels',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 100, priority: 'important'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const adPrompt = result.find(p => p.key.startsWith('growth-test-'));
      expect(adPrompt).toBeTruthy();
    });

    test('generates cost review for stale cost hypothesis', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const hyps = [{
        id: 'h1', status: 'testing', category: 'cost',
        statement: 'Monthly costs stay under budget',
        createdAt: oldDate.toISOString().slice(0, 10),
        actuals: [], target: 5000, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const costPrompt = result.find(p => p.key.startsWith('cost-review-'));
      expect(costPrompt).toBeTruthy();
    });

    test('generates pivot prompt for invalidated hypotheses', () => {
      const hyps = [{
        id: 'h1', status: 'invalidated', category: 'customer',
        statement: 'Wrong assumption',
        createdAt: '2025-01-01',
        actuals: [{ date: '2025-01-15', value: 1 }], target: 50, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const pivotPrompt = result.find(p => p.key.startsWith('pivot-'));
      expect(pivotPrompt).toBeTruthy();
      expect(pivotPrompt.title).toContain('pivot');
    });

    test('generates double-down prompt for validated hypotheses', () => {
      const hyps = [{
        id: 'h1', status: 'validated', category: 'value',
        statement: 'People love us',
        createdAt: '2025-01-01',
        actuals: [{ date: '2025-01-15', value: 100 }], target: 50, priority: 'critical'
      }];

      const result = Prompts.generateSync(hyps, { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const ddPrompt = result.find(p => p.key.startsWith('double-down-'));
      expect(ddPrompt).toBeTruthy();
    });

    test('filters out completed prompts', () => {
      const hyps = [{
        id: 'h1', status: 'testing', category: 'customer',
        statement: 'Test',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 10, priority: 'critical'
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
        id: 'h1', status: 'testing', category: 'revenue',
        statement: 'People will pay',
        createdAt: new Date().toISOString().slice(0, 10),
        actuals: [], target: 1000, priority: 'critical'
      }];

      const toolPrefs = { payments: ['stripe'] };
      const result = Prompts.generateSync(hyps, { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const revPrompt = result.find(p => p.key.startsWith('revenue-presell-'));
      expect(revPrompt).toBeTruthy();
      expect(revPrompt.tool).toBeTruthy();
      expect(revPrompt.tool.name).toBe('Stripe');
    });

    test('business-level prompts for idea stage include pitch', () => {
      const result = Prompts.generateSync([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const pitchPrompt = result.find(p => p.key === 'biz-pitch');
      expect(pitchPrompt).toBeTruthy();
    });

    test('business-level prompts for validation stage include follow-up', () => {
      const result = Prompts.generateSync([], { stage: 'validation' }, {}, { completed: [], dismissed: [] });
      const followup = result.find(p => p.key === 'biz-followup');
      expect(followup).toBeTruthy();
    });

    test('business-level prompts for growth stage include scale prompt', () => {
      const result = Prompts.generateSync([], { stage: 'growth' }, {}, { completed: [], dismissed: [] });
      const scalePrompt = result.find(p => p.key === 'biz-scale');
      expect(scalePrompt).toBeTruthy();
    });

    test('includes social scheduling prompt when scheduling tool configured', () => {
      const toolPrefs = { scheduling: ['buffer'] };
      const result = Prompts.generateSync([], { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const socialPost = result.find(p => p.key === 'biz-social-post');
      expect(socialPost).toBeTruthy();
      expect(socialPost.tool.name).toBe('Buffer');
    });

    test('includes email campaign prompt when email tool configured', () => {
      const toolPrefs = { email: ['mailchimp'] };
      const result = Prompts.generateSync([], { stage: 'validation' }, toolPrefs, { completed: [], dismissed: [] });
      const emailPrompt = result.find(p => p.key === 'biz-email-campaign');
      expect(emailPrompt).toBeTruthy();
      expect(emailPrompt.tool.name).toBe('Mailchimp');
    });

    test('competitor check is always included', () => {
      const result = Prompts.generateSync([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const compPrompt = result.find(p => p.key === 'biz-competitors');
      expect(compPrompt).toBeTruthy();
    });
  });

  describe('generate() (async)', () => {
    test('returns prompts as a Promise', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

      const result = await Prompts.generate([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      expect(Array.isArray(result)).toBe(true);

      global.fetch = originalFetch;
    });

    test('falls back to sync prompts on AI failure', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

      const syncResult = Prompts.generateSync([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });
      const asyncResult = await Prompts.generate([], { stage: 'idea' }, {}, { completed: [], dismissed: [] });

      // Should have same prompts (both fallback)
      expect(asyncResult.length).toBe(syncResult.length);

      global.fetch = originalFetch;
    });
  });
});
