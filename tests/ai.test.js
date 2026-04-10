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

    test('handles empty string', () => {
      expect(AI.detectType('')).toBe('service');
    });
  });

  describe('getSuggestions()', () => {
    test('returns combined common and type-specific items', () => {
      const result = AI.getSuggestions(AI.SEGMENTS, 'restaurant');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Food enthusiasts');
      expect(result).toContain('Local residents');
    });

    test('deduplicates items (case-insensitive)', () => {
      const pool = {
        _common: ['Test Item', 'Another'],
        mytype: ['test item', 'Unique']
      };
      const result = AI.getSuggestions(pool, 'mytype');
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

    test('type-specific items come first', () => {
      const result = AI.getSuggestions(AI.SEGMENTS, 'restaurant');
      // 'Food enthusiasts' is restaurant-specific, should appear before common items
      const foodIdx = result.indexOf('Food enthusiasts');
      const localIdx = result.indexOf('Local residents');
      expect(foodIdx).toBeLessThan(localIdx);
    });
  });

  describe('isAvailable()', () => {
    test('returns true when PROXY_URL is set', () => {
      expect(AI.isAvailable()).toBe(true);
    });
  });

  describe('getTerminology()', () => {
    test('returns restaurant-specific labels for restaurant type', () => {
      const terms = AI.getTerminology('restaurant');
      expect(terms.customerSegments).toBe('Your Guests');
      expect(terms.customers).toBe('guests');
      expect(terms.valueProp).toBe('Why They Come Back');
    });

    test('returns default labels for unknown type', () => {
      const terms = AI.getTerminology('unknown_type');
      expect(terms.customerSegments).toBe('Customer Segments');
      expect(terms.valueProp).toBe('Value Proposition');
    });

    test('returns saas-specific labels', () => {
      const terms = AI.getTerminology('saas');
      expect(terms.customerSegments).toBe('Your Users');
      expect(terms.costStructure).toBe('Burn Rate');
    });

    test('merges stored custom terminology', () => {
      Store.saveTerminology({ labels: { customerSegments: 'My Custom Label' } });
      const terms = AI.getTerminology('restaurant');
      expect(terms.customerSegments).toBe('My Custom Label');
    });
  });

  describe('getTerm()', () => {
    test('returns specific term for known type and key', () => {
      expect(AI.getTerm('restaurant', 'customers')).toBe('guests');
    });

    test('returns default for unknown type', () => {
      expect(AI.getTerm('unknown', 'customers')).toBe('customers');
    });
  });

  describe('TERMINOLOGY', () => {
    test('has entries for all main business types', () => {
      expect(AI.TERMINOLOGY.restaurant).toBeTruthy();
      expect(AI.TERMINOLOGY.retail).toBeTruthy();
      expect(AI.TERMINOLOGY.service).toBeTruthy();
      expect(AI.TERMINOLOGY.saas).toBeTruthy();
      expect(AI.TERMINOLOGY.ecommerce).toBeTruthy();
      expect(AI.TERMINOLOGY.subscription).toBeTruthy();
    });
  });

  describe('DEFAULT_TERMINOLOGY', () => {
    test('has all expected keys', () => {
      expect(AI.DEFAULT_TERMINOLOGY.customerSegments).toBeTruthy();
      expect(AI.DEFAULT_TERMINOLOGY.valueProp).toBeTruthy();
      expect(AI.DEFAULT_TERMINOLOGY.channels).toBeTruthy();
      expect(AI.DEFAULT_TERMINOLOGY.customers).toBeTruthy();
      expect(AI.DEFAULT_TERMINOLOGY.proudPrompt).toBeTruthy();
    });
  });

  describe('extractColorsFromHTML()', () => {
    test('extracts theme-color meta tag', () => {
      const html = '<html><head><meta name="theme-color" content="#ff6600"></head><body></body></html>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors).toContain('#ff6600');
    });

    test('extracts CSS brand variables', () => {
      const html = '<style>:root { --brand-color: #3498db; --primary: #e74c3c; }</style>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors).toContain('#3498db');
      expect(colors).toContain('#e74c3c');
    });

    test('extracts background-color values', () => {
      const html = '<style>.header { background-color: #2ecc71; }</style>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors).toContain('#2ecc71');
    });

    test('skips black, white, and gray colors', () => {
      const html = '<style>body { color: #000000; background: #ffffff; border-color: #333; }</style>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors).not.toContain('#000000');
      expect(colors).not.toContain('#ffffff');
      expect(colors).not.toContain('#333');
    });

    test('deduplicates colors', () => {
      const html = '<style>.a { color: #ff6600; } .b { background-color: #ff6600; }</style>';
      const colors = AI.extractColorsFromHTML(html);
      const count = colors.filter(c => c.toLowerCase() === '#ff6600').length;
      expect(count).toBe(1);
    });

    test('returns at most 6 colors', () => {
      let html = '<style>';
      for (let i = 0; i < 10; i++) {
        html += `.c${i} { background-color: #${i}${i}${i}a${i}${i}; }`;
      }
      html += '</style>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors.length).toBeLessThanOrEqual(6);
    });

    test('returns empty array for no-color HTML', () => {
      const html = '<html><body><p>No colors here</p></body></html>';
      const colors = AI.extractColorsFromHTML(html);
      expect(colors).toEqual([]);
    });
  });

  describe('hexToHSL()', () => {
    test('converts pure red', () => {
      const hsl = AI.hexToHSL('#ff0000');
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    test('converts pure green', () => {
      const hsl = AI.hexToHSL('#00ff00');
      expect(hsl.h).toBe(120);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    test('converts pure blue', () => {
      const hsl = AI.hexToHSL('#0000ff');
      expect(hsl.h).toBe(240);
      expect(hsl.s).toBe(100);
      expect(hsl.l).toBe(50);
    });

    test('converts white', () => {
      const hsl = AI.hexToHSL('#ffffff');
      expect(hsl.l).toBe(100);
      expect(hsl.s).toBe(0);
    });

    test('converts black', () => {
      const hsl = AI.hexToHSL('#000000');
      expect(hsl.l).toBe(0);
    });

    test('handles 3-digit hex', () => {
      const hsl = AI.hexToHSL('#f00');
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(100);
    });
  });

  describe('hslToHex()', () => {
    test('converts red HSL back to hex', () => {
      const hex = AI.hslToHex(0, 100, 50);
      expect(hex.toLowerCase()).toBe('#ff0000');
    });

    test('converts green HSL back to hex', () => {
      const hex = AI.hslToHex(120, 100, 50);
      expect(hex.toLowerCase()).toBe('#00ff00');
    });

    test('converts gray (0 saturation)', () => {
      const hex = AI.hslToHex(0, 0, 50);
      expect(hex.toLowerCase()).toBe('#808080');
    });
  });

  describe('generatePalette()', () => {
    test('creates full palette from primary color', () => {
      const palette = AI.generatePalette('#3498db');
      expect(palette).toBeTruthy();
      expect(palette.accent).toBe('#3498db');
      expect(palette.bg).toBeTruthy();
      expect(palette.text).toBeTruthy();
      expect(palette.surface).toBe('#ffffff');
      expect(palette.border).toBeTruthy();
    });

    test('returns null for null primary', () => {
      expect(AI.generatePalette(null)).toBeNull();
    });

    test('uses secondary color if sufficiently different hue', () => {
      const palette = AI.generatePalette('#3498db', '#e74c3c');
      expect(palette.accent2).toBe('#e74c3c');
    });

    test('ignores secondary if hue too similar', () => {
      const palette = AI.generatePalette('#3498db', '#2980b9');
      // Hues are close, so accent2 should be derived from primary, not secondary
      expect(palette.accent2).not.toBe('#2980b9');
    });
  });

  describe('applyTheme()', () => {
    test('sets CSS custom properties on documentElement', () => {
      const palette = {
        accent: '#ff6600',
        accent2: '#cc5200',
        accentLight: '#fff0e6',
        bg: '#fafafa',
        bg2: '#f0f0f0',
        surface: '#ffffff',
        surface2: '#fefefe',
        text: '#1a1a1a',
        text2: '#444444',
        text3: '#777777',
        border: '#dddddd',
        border2: '#cccccc',
        shadow: 'rgba(10,10,10,0.06)',
        shadow2: 'rgba(10,10,10,0.12)'
      };
      AI.applyTheme(palette);
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff6600');
      expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#fafafa');
    });

    test('does nothing for null palette', () => {
      AI.applyTheme(null);
      // Should not throw
    });
  });

  describe('restoreTheme()', () => {
    test('restores saved theme from store', () => {
      Store.saveTheme({
        accent: '#ff6600',
        accent2: '#cc5200',
        accentLight: '#fff0e6',
        bg: '#fafafa',
        bg2: '#f0f0f0',
        surface: '#ffffff',
        surface2: '#fefefe',
        text: '#1a1a1a',
        text2: '#444444',
        text3: '#777777',
        border: '#dddddd',
        border2: '#cccccc',
        shadow: 'rgba(10,10,10,0.06)',
        shadow2: 'rgba(10,10,10,0.12)'
      });
      AI.restoreTheme();
      expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff6600');
    });

    test('does nothing when no saved theme', () => {
      AI.restoreTheme();
      // Should not throw
    });
  });

  describe('callClaude()', () => {
    // callClaude uses the fetch captured at module load time.
    // To test it, we reload the AI module with a mocked fetch.
    function loadAIWithFetch(mockFetch) {
      const fs = require('fs');
      const path = require('path');
      const code = fs.readFileSync(path.join(__dirname, '..', 'ai.js'), 'utf8');
      const fn = new Function(
        'window', 'document', 'localStorage', 'fetch', 'AbortController',
        'setTimeout', 'clearTimeout', 'Store',
        code + '\nreturn AI;'
      );
      return fn(
        global.window || global,
        global.document,
        global.localStorage,
        mockFetch,
        global.AbortController,
        global.setTimeout,
        global.clearTimeout,
        global.Store
      );
    }

    test('returns parsed response on success', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Hello from Claude' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });
      const testAI = loadAIWithFetch(mockFetch);

      const result = await testAI.callClaude([{ role: 'user', content: 'Test' }]);
      expect(result.ok).toBe(true);
      expect(result.text).toBe('Hello from Claude');
      expect(result.usage).toBeTruthy();
    });

    test('returns error on non-ok response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Rate limited' } })
      });
      const testAI = loadAIWithFetch(mockFetch);

      const result = await testAI.callClaude([{ role: 'user', content: 'Test' }]);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Rate limited');
    });

    test('returns error on network failure', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const testAI = loadAIWithFetch(mockFetch);

      const result = await testAI.callClaude([{ role: 'user', content: 'Test' }]);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network error');
    });

    test('returns timeout error on abort', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockFetch = jest.fn().mockRejectedValue(abortError);
      const testAI = loadAIWithFetch(mockFetch);

      const result = await testAI.callClaude([{ role: 'user', content: 'Test' }]);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Request timed out');
    });
  });

  describe('generateHypotheses()', () => {
    test('returns fallback hypotheses when fetch fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await AI.generateHypotheses({
        segments: ['Students'],
        proudOf: 'Great service',
        goal: 'Grow revenue'
      });
      expect(result.ok).toBe(true);
      expect(result.source).toBe('fallback');
      expect(result.hypotheses.length).toBeGreaterThan(0);

      delete global.fetch;
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

    test('limits segment hypotheses to first 2', () => {
      const result = AI.keywordFallbackHypotheses({
        segments: ['Seg 1', 'Seg 2', 'Seg 3', 'Seg 4']
      });
      const customerHyps = result.filter(h => h.category === 'customer');
      expect(customerHyps).toHaveLength(2);
    });
  });

  describe('parseJSON()', () => {
    test('parses valid JSON string', () => {
      const result = AI.parseJSON('{"name":"test","value":42}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('extracts JSON from markdown code block', () => {
      const result = AI.parseJSON('Here is the response:\n```json\n{"hypotheses":[{"statement":"test"}]}\n```\nEnd');
      expect(result).toEqual({ hypotheses: [{ statement: 'test' }] });
    });

    test('extracts JSON from code block without json tag', () => {
      const result = AI.parseJSON('```\n{"key":"value"}\n```');
      expect(result).toEqual({ key: 'value' });
    });

    test('returns null for invalid JSON', () => {
      expect(AI.parseJSON('not json at all')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(AI.parseJSON(null)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(AI.parseJSON('')).toBeNull();
    });

    test('handles JSON with whitespace around it', () => {
      const result = AI.parseJSON('  \n  {"key": "value"}  \n  ');
      expect(result).toEqual({ key: 'value' });
    });

    test('handles JSON array', () => {
      const result = AI.parseJSON('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
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
      expect(canvas.keyResources.length).toBeGreaterThanOrEqual(2);
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
