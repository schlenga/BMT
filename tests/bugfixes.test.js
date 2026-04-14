/**
 * Tests for identified bugs and merge issues.
 */
const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

describe('Bug Fix: AI.parseJSON export', () => {
  test('AI.parseJSON is a function', () => {
    expect(typeof AI.parseJSON).toBe('function');
  });

  test('parseJSON extracts JSON from markdown code block', () => {
    const text = '```json\n{"key": "value"}\n```';
    const result = AI.parseJSON(text);
    expect(result).toEqual({ key: 'value' });
  });

  test('parseJSON extracts JSON from code block without lang hint', () => {
    const text = '```\n{"items": [1, 2, 3]}\n```';
    const result = AI.parseJSON(text);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  test('parseJSON parses raw JSON text', () => {
    const text = '{"name": "test", "count": 5}';
    const result = AI.parseJSON(text);
    expect(result).toEqual({ name: 'test', count: 5 });
  });

  test('parseJSON returns null for invalid JSON', () => {
    expect(AI.parseJSON('not json at all')).toBeNull();
  });

  test('parseJSON returns null for empty input', () => {
    expect(AI.parseJSON('')).toBeNull();
    expect(AI.parseJSON(null)).toBeNull();
    expect(AI.parseJSON(undefined)).toBeNull();
  });

  test('parseJSON handles surrounding text with code block', () => {
    const text = 'Here is the result:\n```json\n{"status": "ok"}\n```\nHope that helps!';
    const result = AI.parseJSON(text);
    expect(result).toEqual({ status: 'ok' });
  });

  test('Prompts.generate can use AI.parseJSON without error', () => {
    // This previously would crash because AI.parseJSON was not exported
    expect(() => {
      AI.parseJSON('{"test": true}');
    }).not.toThrow();
  });
});

describe('Bug Fix: calcKPIs break-even sustainability', () => {
  test('break-even is null when only last month is profitable', () => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const isLast = i === 5;
      months.push({
        month: i + 1,
        revenue: 1000,
        cogs: 0,
        grossProfit: 1000,
        grossMargin: 100,
        staffCost: isLast ? 500 : 2000,
        opex: 0,
        capex: 0,
        totalFixedCosts: isLast ? 500 : 2000,
        ebitda: isLast ? 500 : -1000,
        netIncome: isLast ? 500 : -1000,
        cashBalance: isLast ? -4500 : -1000 * (i + 1),
        headcount: 1,
        revenuePerHead: 1000,
        burnRate: isLast ? 0 : 1000,
        runway: 0,
        revenueByStream: []
      });
    }
    const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
    // Only 1 profitable month at the end — not sustained
    expect(kpis.breakEvenMonth).toBeNull();
  });

  test('break-even detected when profitable for 3 consecutive months mid-projection', () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const profitable = i >= 6;
      months.push({
        month: i + 1,
        revenue: 5000,
        cogs: 1000,
        grossProfit: 4000,
        grossMargin: 80,
        staffCost: profitable ? 2000 : 5000,
        opex: 500,
        capex: 0,
        totalFixedCosts: profitable ? 2500 : 5500,
        ebitda: profitable ? 1500 : -1500,
        netIncome: profitable ? 1500 : -1500,
        cashBalance: 0,
        headcount: 1,
        revenuePerHead: 5000,
        burnRate: profitable ? 0 : 1500,
        runway: 0,
        revenueByStream: []
      });
    }
    const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
    // Month 7 (index 6) is first profitable, months 8-9 confirm
    expect(kpis.breakEvenMonth).toBe(7);
  });

  test('break-even not detected when profitability is intermittent', () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      // Alternating profit/loss
      const profitable = i % 2 === 0;
      months.push({
        month: i + 1,
        revenue: 3000,
        cogs: 500,
        grossProfit: 2500,
        grossMargin: 83,
        staffCost: profitable ? 1000 : 3000,
        opex: 500,
        capex: 0,
        totalFixedCosts: profitable ? 1500 : 3500,
        ebitda: profitable ? 1000 : -1000,
        netIncome: profitable ? 1000 : -1000,
        cashBalance: 0,
        headcount: 1,
        revenuePerHead: 3000,
        burnRate: profitable ? 0 : 1000,
        runway: 0,
        revenueByStream: []
      });
    }
    const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
    expect(kpis.breakEvenMonth).toBeNull();
  });

  test('break-even detected when last 3+ months are profitable', () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      // Last 3 months profitable (indices 9, 10, 11)
      const profitable = i >= 9;
      months.push({
        month: i + 1,
        revenue: 3000,
        cogs: 500,
        grossProfit: 2500,
        grossMargin: 83,
        staffCost: profitable ? 1000 : 4000,
        opex: 500,
        capex: 0,
        totalFixedCosts: profitable ? 1500 : 4500,
        ebitda: profitable ? 1000 : -2000,
        netIncome: profitable ? 1000 : -2000,
        cashBalance: 0,
        headcount: 1,
        revenuePerHead: 3000,
        burnRate: profitable ? 0 : 2000,
        runway: 0,
        revenueByStream: []
      });
    }
    const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
    // Month 10 (index 9) profitable, months 11-12 confirm sustainability
    expect(kpis.breakEvenMonth).toBe(10);
  });

  test('break-even is null when only last 2 months are profitable (cannot confirm)', () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      // Only last 2 months profitable (indices 10, 11)
      const profitable = i >= 10;
      months.push({
        month: i + 1,
        revenue: 3000,
        cogs: 500,
        grossProfit: 2500,
        grossMargin: 83,
        staffCost: profitable ? 1000 : 4000,
        opex: 500,
        capex: 0,
        totalFixedCosts: profitable ? 1500 : 4500,
        ebitda: profitable ? 1000 : -2000,
        netIncome: profitable ? 1000 : -2000,
        cashBalance: 0,
        headcount: 1,
        revenuePerHead: 3000,
        burnRate: profitable ? 0 : 2000,
        runway: 0,
        revenueByStream: []
      });
    }
    const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
    // Index 10 has only 1 confirming month (index 11), not enough
    expect(kpis.breakEvenMonth).toBeNull();
  });
});
