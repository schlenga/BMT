const { loadModules, resetLocalStorage } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai']);
});

beforeEach(() => {
  resetLocalStorage();
});

describe('AI', () => {
  describe('detectType()', () => {
    test('detects restaurant type', () => {
      expect(AI.detectType('I run a small cafe serving coffee and pastries')).toBe('restaurant');
    });

    test('detects retail type', () => {
      expect(AI.detectType('We sell clothing and fashion accessories in our boutique')).toBe('retail');
    });

    test('detects service type', () => {
      expect(AI.detectType('I offer freelance web design and development consulting')).toBe('service');
    });

    test('detects saas type', () => {
      expect(AI.detectType('We built a cloud analytics platform with dashboard and API')).toBe('saas');
    });

    test('detects ecommerce type', () => {
      expect(AI.detectType('Online marketplace for handmade goods, like Etsy')).toBe('ecommerce');
    });

    test('detects subscription type', () => {
      expect(AI.detectType('Monthly subscription box for coffee lovers')).toBe('subscription');
    });

    test('defaults to service for unknown description', () => {
      expect(AI.detectType('Something completely unrelated')).toBe('service');
    });

    test('is case-insensitive', () => {
      expect(AI.detectType('RESTAURANT CAFE BAKERY')).toBe('restaurant');
    });
  });

  describe('getSuggestions()', () => {
    test('returns combined common and type-specific items', () => {
      const result = AI.getSuggestions(AI.SEGMENTS, 'restaurant');
      expect(result.length).toBeGreaterThan(0);
      // Should include restaurant-specific
      expect(result).toContain('Food enthusiasts');
      // Should include common
      expect(result).toContain('Local residents');
    });

    test('deduplicates items (case-insensitive)', () => {
      const pool = {
        _common: ['Test Item', 'Another'],
        mytype: ['test item', 'Unique']
      };
      const result = AI.getSuggestions(pool, 'mytype');
      // Should only have one 'test item' (the type-specific one first)
      const lowerResults = result.map(r => r.toLowerCase());
      const testCount = lowerResults.filter(r => r === 'test item').length;
      expect(testCount).toBe(1);
    });

    test('returns common items if type has no specific pool', () => {
      const result = AI.getSuggestions(AI.SEGMENTS, 'unknown_type');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Local residents');
    });

    test('returns empty array if no pool data', () => {
      const result = AI.getSuggestions({}, 'restaurant');
      expect(result).toEqual([]);
    });
  });

  describe('parseJSON()', () => {
    test('parses plain JSON', () => {
      const result = AI.parseJSON('{"name": "test"}');
      expect(result).toEqual({ name: 'test' });
    });

    test('parses JSON from markdown code block', () => {
      const result = AI.parseJSON('Here is the result:\n```json\n{"name": "test"}\n```\nDone.');
      expect(result).toEqual({ name: 'test' });
    });

    test('parses JSON from plain code block', () => {
      const result = AI.parseJSON('```\n{"value": 42}\n```');
      expect(result).toEqual({ value: 42 });
    });

    test('returns null for invalid JSON', () => {
      expect(AI.parseJSON('not json at all')).toBeNull();
    });

    test('returns null for null/empty input', () => {
      expect(AI.parseJSON(null)).toBeNull();
      expect(AI.parseJSON('')).toBeNull();
    });
  });

  describe('isAvailable()', () => {
    test('returns true when PROXY_URL is set', () => {
      expect(AI.isAvailable()).toBe(true);
    });
  });

  describe('keywordFallbackHypotheses()', () => {
    test('generates hypotheses from segments', () => {
      const result = AI.keywordFallbackHypotheses({
        segments: ['Young professionals', 'Students']
      });
      const customerHyps = result.filter(h => h.category === 'customer');
      expect(customerHyps.length).toBeGreaterThanOrEqual(2);
      expect(customerHyps[0].statement).toContain('Young professionals');
    });

    test('generates hypotheses from proudOf', () => {
      const result = AI.keywordFallbackHypotheses({ proudOf: 'Our amazing coffee' });
      const valueHyps = result.filter(h => h.category === 'value');
      expect(valueHyps.length).toBeGreaterThanOrEqual(2);
    });

    test('always includes a paying customers hypothesis', () => {
      const result = AI.keywordFallbackHypotheses({});
      const payingHyp = result.find(h => h.statement.includes('willing to pay'));
      expect(payingHyp).toBeTruthy();
      expect(payingHyp.priority).toBe('critical');
    });

    test('generates cost hypothesis when costs provided', () => {
      const result = AI.keywordFallbackHypotheses({ costs: ['Rent', 'Staff'] });
      const costHyps = result.filter(h => h.category === 'cost');
      expect(costHyps.length).toBeGreaterThanOrEqual(1);
    });

    test('generates goal hypothesis when goal provided', () => {
      const result = AI.keywordFallbackHypotheses({ goal: 'Grow revenue' });
      const revHyps = result.filter(h => h.category === 'revenue');
      expect(revHyps.length).toBeGreaterThanOrEqual(1);
    });

    test('returns minimal hypotheses with empty data', () => {
      const result = AI.keywordFallbackHypotheses({});
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildCanvas()', () => {
    test('builds canvas from wizard data with segments', () => {
      const canvas = AI.buildCanvas({
        segments: ['Students', 'Professionals'],
        proudOf: 'Great service',
        costs: ['Rent'],
        revenueRange: '$1K - $5K',
        teamSize: '2-5'
      });
      expect(canvas.customerSegments.length).toBeGreaterThanOrEqual(2);
      expect(canvas.valueProp.length).toBeGreaterThanOrEqual(1);
      expect(canvas.valueProp[0].text).toBe('Great service');
      expect(canvas.costStructure.length).toBeGreaterThanOrEqual(1);
      expect(canvas.keyResources.length).toBeGreaterThanOrEqual(2); // founding team + team size
    });

    test('builds canvas with website data', () => {
      const canvas = AI.buildCanvas({
        segments: [],
        websiteData: {
          products: ['Widget A', 'Widget B'],
          channels: ['SEO', 'Social media']
        }
      });
      expect(canvas.revenueStreams.length).toBeGreaterThanOrEqual(2);
      expect(canvas.channels.length).toBeGreaterThanOrEqual(2);
    });

    test('builds canvas with minimal data', () => {
      const canvas = AI.buildCanvas({});
      // Should always have defaults
      expect(canvas.customerRelationships.length).toBeGreaterThanOrEqual(1);
      expect(canvas.keyActivities.length).toBeGreaterThanOrEqual(2);
      expect(canvas.keyResources.length).toBeGreaterThanOrEqual(1);
    });

    test('skips team resource when solo', () => {
      const canvas = AI.buildCanvas({ teamSize: 'Just me' });
      const teamEntries = canvas.keyResources.filter(r => r.text.includes('Team of'));
      expect(teamEntries).toHaveLength(0);
    });

    test('skips revenue target for pre-revenue', () => {
      const canvas = AI.buildCanvas({ revenueRange: 'Pre-revenue' });
      const revTargets = canvas.revenueStreams.filter(r => r.text.includes('Revenue target'));
      expect(revTargets).toHaveLength(0);
    });
  });

  describe('TYPE_LABELS', () => {
    test('has labels for all keyword types', () => {
      for (const type of Object.keys(AI.TYPE_KEYWORDS)) {
        expect(AI.TYPE_LABELS[type]).toBeTruthy();
      }
    });
  });

  describe('GOALS', () => {
    test('is a non-empty array of strings', () => {
      expect(Array.isArray(AI.GOALS)).toBe(true);
      expect(AI.GOALS.length).toBeGreaterThan(0);
      AI.GOALS.forEach(g => expect(typeof g).toBe('string'));
    });
  });
});
