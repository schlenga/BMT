const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation']);
});

beforeEach(() => {
  resetLocalStorage();
});

function makeConfig(overrides) {
  return Object.assign({
    projectionMonths: 12,
    startingCash: 0,
    revenueStreams: [],
    staff: [],
    opex: [],
    capex: [],
    scenario: 'base',
    scenarioMultipliers: {
      pessimistic: { revenueMult: 0.7, costMult: 1.1 },
      base: { revenueMult: 1.0, costMult: 1.0 },
      optimistic: { revenueMult: 1.3, costMult: 0.95 }
    }
  }, overrides);
}

function makeStream(overrides) {
  return Object.assign({
    id: 'rs1', name: 'Test', type: 'unit',
    unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
    cogsPerUnit: 0, cogsPct: 0, churnRate: 0, seasonality: null
  }, overrides);
}

// ── projectMonth internals ──

describe('SimEngine.projectMonth()', () => {
  test('returns all expected fields', () => {
    const config = makeConfig({ revenueStreams: [makeStream()] });
    const m = SimEngine.projectMonth(config, 0, 0);
    const fields = ['month', 'label', 'revenue', 'revenueByStream', 'cogs',
      'grossProfit', 'grossMargin', 'staffCost', 'opex', 'totalFixedCosts',
      'capex', 'ebitda', 'netIncome', 'cashBalance', 'headcount',
      'revenuePerHead', 'burnRate', 'runway'];
    fields.forEach(f => expect(m).toHaveProperty(f));
  });

  test('month number is 1-based', () => {
    const config = makeConfig();
    expect(SimEngine.projectMonth(config, 0, 0).month).toBe(1);
    expect(SimEngine.projectMonth(config, 5, 0).month).toBe(6);
  });

  test('cashBalance accumulates from prevCash', () => {
    const config = makeConfig({ revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10 })] });
    const m0 = SimEngine.projectMonth(config, 0, 1000);
    expect(m0.cashBalance).toBe(1000 + m0.netIncome);
    const m1 = SimEngine.projectMonth(config, 1, m0.cashBalance);
    expect(m1.cashBalance).toBe(m0.cashBalance + m1.netIncome);
  });

  test('burnRate is absolute value of net income when negative', () => {
    const config = makeConfig({
      staff: [{ role: 'Dev', count: 1, monthlyCost: 50000 }]
    });
    const m = SimEngine.projectMonth(config, 0, 100000);
    expect(m.netIncome).toBeLessThan(0);
    expect(m.burnRate).toBe(Math.abs(m.netIncome));
  });

  test('burnRate is 0 when profitable', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 1000, unitsPerMonth: 100 })]
    });
    const m = SimEngine.projectMonth(config, 0, 0);
    expect(m.netIncome).toBeGreaterThan(0);
    expect(m.burnRate).toBe(0);
  });

  test('runway is cash / burnRate when burning', () => {
    const config = makeConfig({
      staff: [{ role: 'Dev', count: 1, monthlyCost: 5000 }]
    });
    const m = SimEngine.projectMonth(config, 0, 20000);
    expect(m.burnRate).toBe(5000);
    expect(m.runway).toBe(Math.round((20000 - 5000) / 5000 * 10) / 10);
  });

  test('runway is 999 when profitable and cash positive', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 1000, unitsPerMonth: 100 })]
    });
    const m = SimEngine.projectMonth(config, 0, 10000);
    expect(m.runway).toBe(999);
  });

  test('runway is 0 when no cash and no profit', () => {
    const config = makeConfig({
      staff: [{ role: 'Dev', count: 1, monthlyCost: 5000 }]
    });
    const m = SimEngine.projectMonth(config, 0, 0);
    expect(m.runway).toBe(0);
  });

  test('revenuePerHead is 0 when no staff', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10 })]
    });
    const m = SimEngine.projectMonth(config, 0, 0);
    expect(m.headcount).toBe(0);
    expect(m.revenuePerHead).toBe(0);
  });

  test('grossMargin is 0 when no revenue', () => {
    const config = makeConfig();
    const m = SimEngine.projectMonth(config, 0, 0);
    expect(m.grossMargin).toBe(0);
  });
});

// ── Revenue stream calculations ──

describe('Revenue stream calculations', () => {
  test('recurring stream with growth and churn', () => {
    const stream = makeStream({
      type: 'recurring', unitsPerMonth: 100,
      growthRate: 10, churnRate: 5, unitPrice: 50
    });
    const config = makeConfig({ revenueStreams: [stream], projectionMonths: 6 });
    const result = SimEngine.run(config);

    // Net growth = 10% - 5% = 5% monthly
    // Month 0: 100 units, Month 1: 105, etc.
    expect(result.months[0].revenueByStream[0].units).toBe(100);
    expect(result.months[1].revenueByStream[0].units).toBeGreaterThan(100);
  });

  test('recurring stream with churn exceeding growth shrinks', () => {
    const stream = makeStream({
      type: 'recurring', unitsPerMonth: 100,
      growthRate: 2, churnRate: 10, unitPrice: 50
    });
    const config = makeConfig({ revenueStreams: [stream], projectionMonths: 12 });
    const result = SimEngine.run(config);

    expect(result.months[11].revenueByStream[0].units).toBeLessThan(100);
  });

  test('units are always non-negative', () => {
    const stream = makeStream({
      type: 'recurring', unitsPerMonth: 10,
      growthRate: 0, churnRate: 50, unitPrice: 50
    });
    const config = makeConfig({ revenueStreams: [stream], projectionMonths: 24 });
    const result = SimEngine.run(config);

    result.months.forEach(m => {
      expect(m.revenueByStream[0].units).toBeGreaterThanOrEqual(0);
    });
  });

  test('COGS combines per-unit and percentage', () => {
    const stream = makeStream({
      unitPrice: 100, unitsPerMonth: 10,
      cogsPerUnit: 10, cogsPct: 20
    });
    const config = makeConfig({ revenueStreams: [stream], projectionMonths: 1 });
    const result = SimEngine.run(config);
    const m = result.months[0];

    // 10 units * $10 per-unit = $100 + 20% of $1000 = $200 = $300 total
    expect(m.cogs).toBe(300);
  });

  test('seasonality wraps around for multi-year projections', () => {
    const seasonality = [0.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    const stream = makeStream({ seasonality, growthRate: 0 });
    const config = makeConfig({ revenueStreams: [stream], projectionMonths: 24 });
    const result = SimEngine.run(config);

    // Month 0 (Jan) and month 12 (Jan next year) should both have 0.5x seasonality
    const m0units = result.months[0].revenueByStream[0].units;
    const m12units = result.months[12].revenueByStream[0].units;
    expect(m0units).toBe(m12units); // Same seasonality, no growth
  });

  test('multiple revenue streams accumulate', () => {
    const config = makeConfig({
      revenueStreams: [
        makeStream({ id: 'rs1', unitPrice: 100, unitsPerMonth: 10 }),
        makeStream({ id: 'rs2', unitPrice: 50, unitsPerMonth: 20 })
      ],
      projectionMonths: 1
    });
    const result = SimEngine.run(config);

    expect(result.months[0].revenue).toBe(2000); // 1000 + 1000
    expect(result.months[0].revenueByStream).toHaveLength(2);
  });

  test('stream with zero price produces zero revenue', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 0, unitsPerMonth: 100 })],
      projectionMonths: 1
    });
    const result = SimEngine.run(config);
    expect(result.months[0].revenue).toBe(0);
  });
});

// ── Staff cost calculations ──

describe('Staff cost calculations', () => {
  test('hireEveryMonths adds headcount over time', () => {
    const config = makeConfig({
      staff: [{ role: 'Dev', count: 2, monthlyCost: 5000, hireEveryMonths: 3 }],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);

    expect(result.months[0].headcount).toBe(2); // Initial
    expect(result.months[3].headcount).toBe(3); // +1 at month 3
    expect(result.months[6].headcount).toBe(4); // +2 at month 6
  });

  test('multiple staff roles accumulate costs', () => {
    const config = makeConfig({
      staff: [
        { role: 'Dev', count: 2, monthlyCost: 7000 },
        { role: 'Support', count: 1, monthlyCost: 3000 }
      ],
      projectionMonths: 1
    });
    const result = SimEngine.run(config);

    expect(result.months[0].staffCost).toBe(17000); // 14000 + 3000
    expect(result.months[0].headcount).toBe(3);
  });

  test('staff with zero count contributes nothing', () => {
    const config = makeConfig({
      staff: [{ role: 'Dev', count: 0, monthlyCost: 5000 }],
      projectionMonths: 1
    });
    const result = SimEngine.run(config);
    expect(result.months[0].staffCost).toBe(0);
    expect(result.months[0].headcount).toBe(0);
  });
});

// ── Opex calculations ──

describe('Opex calculations', () => {
  test('compound growth rate over 12 months', () => {
    const config = makeConfig({
      opex: [{ name: 'Marketing', monthly: 1000, growthRate: 10 }],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);

    // Month 0: 1000, Month 11: 1000 * (1.1)^11
    const expected = Math.round(1000 * Math.pow(1.1, 11) * 100) / 100;
    expect(result.months[11].opex).toBe(expected);
  });

  test('multiple opex items sum correctly', () => {
    const config = makeConfig({
      opex: [
        { name: 'Rent', monthly: 2000, growthRate: 0 },
        { name: 'Utils', monthly: 500, growthRate: 0 }
      ],
      projectionMonths: 1
    });
    const result = SimEngine.run(config);
    expect(result.months[0].opex).toBe(2500);
  });

  test('opex with zero growth stays constant', () => {
    const config = makeConfig({
      opex: [{ name: 'Rent', monthly: 3000, growthRate: 0 }],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);
    expect(result.months[0].opex).toBe(3000);
    expect(result.months[11].opex).toBe(3000);
  });
});

// ── Capex calculations ──

describe('Capex calculations', () => {
  test('multiple capex items in same month', () => {
    const config = makeConfig({
      capex: [
        { name: 'A', amount: 5000, month: 0 },
        { name: 'B', amount: 3000, month: 0 }
      ],
      projectionMonths: 6
    });
    const result = SimEngine.run(config);
    expect(result.months[0].capex).toBe(8000);
    expect(result.months[1].capex).toBe(0);
  });

  test('capex scheduled beyond projection window is ignored', () => {
    const config = makeConfig({
      capex: [{ name: 'Future', amount: 50000, month: 99 }],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);
    result.months.forEach(m => expect(m.capex).toBe(0));
  });
});

// ── Scenario multipliers ──

describe('Scenario multipliers', () => {
  test('pessimistic reduces revenue and increases costs', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 100 })],
      staff: [{ role: 'Dev', count: 1, monthlyCost: 5000 }],
      opex: [{ name: 'Rent', monthly: 1000, growthRate: 0 }],
      scenario: 'pessimistic'
    });
    const result = SimEngine.run(config);
    const baseConfig = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 100 })],
      staff: [{ role: 'Dev', count: 1, monthlyCost: 5000 }],
      opex: [{ name: 'Rent', monthly: 1000, growthRate: 0 }],
      scenario: 'base'
    });
    const baseResult = SimEngine.run(baseConfig);

    expect(result.months[0].revenue).toBeLessThan(baseResult.months[0].revenue);
    expect(result.months[0].staffCost).toBeGreaterThan(baseResult.months[0].staffCost);
  });

  test('unknown scenario uses default multipliers (1.0)', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10 })],
      scenario: 'nonexistent'
    });
    const result = SimEngine.run(config);
    expect(result.months[0].revenue).toBe(1000);
  });

  test('costMult does not apply to capex', () => {
    const config = makeConfig({
      capex: [{ name: 'Equipment', amount: 10000, month: 0 }],
      scenario: 'pessimistic'
    });
    const result = SimEngine.run(config);
    expect(result.months[0].capex).toBe(10000);
  });
});

// ── rollupYear ──

describe('SimEngine.rollupYear()', () => {
  test('partial year rollup with less than 12 months', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10 })],
      projectionMonths: 8
    });
    const result = SimEngine.run(config);

    expect(result.years).toHaveLength(1);
    expect(result.years[0].months).toBe(8);
    expect(result.years[0].revenue).toBeGreaterThan(0);
  });

  test('multi-year projection has correct year boundaries', () => {
    const config = makeConfig({
      revenueStreams: [makeStream()],
      projectionMonths: 30
    });
    const result = SimEngine.run(config);

    expect(result.years).toHaveLength(3);
    expect(result.years[0].months).toBe(12);
    expect(result.years[1].months).toBe(12);
    expect(result.years[2].months).toBe(6);
  });

  test('year rollup sums monthly values correctly', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10, growthRate: 0 })],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);

    const monthlySum = result.months.reduce((s, m) => s + m.revenue, 0);
    expect(result.years[0].revenue).toBe(Math.round(monthlySum));
  });

  test('returns null for year beyond data', () => {
    const config = makeConfig({
      revenueStreams: [makeStream()],
      projectionMonths: 6
    });
    const result = SimEngine.run(config);
    const y2 = SimEngine.rollupYear(result.months, 2);
    expect(y2).toBeNull();
  });
});

// ── calcKPIs edge cases ──

describe('SimEngine.calcKPIs() edge cases', () => {
  test('break-even requires sustained profitability', () => {
    // Create a config where net income oscillates positive/negative
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 80, growthRate: 5 })],
      staff: [{ role: 'Owner', count: 1, monthlyCost: 7500 }],
      projectionMonths: 24
    });
    const result = SimEngine.run(config);
    const summary = result.summary;

    // If break-even is set, verify it's sustained
    if (summary.breakEvenMonth !== null) {
      const beIdx = summary.breakEvenMonth - 1;
      for (let j = beIdx; j < Math.min(beIdx + 3, result.months.length); j++) {
        expect(result.months[j].netIncome).toBeGreaterThan(0);
      }
    }
  });

  test('peakCashNeeded is 0 when cash never goes below starting cash', () => {
    const config = makeConfig({
      startingCash: 100000,
      revenueStreams: [makeStream({ unitPrice: 1000, unitsPerMonth: 100 })],
      projectionMonths: 6
    });
    const result = SimEngine.run(config);

    expect(result.summary.peakCashNeeded).toBe(0);
  });

  test('year3Revenue is 0 for 12-month projection', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10 })],
      projectionMonths: 12
    });
    const result = SimEngine.run(config);
    expect(result.summary.year3Revenue).toBe(0);
  });

  test('empty months returns empty object', () => {
    const kpis = SimEngine.calcKPIs([], { startingCash: 0 });
    expect(kpis).toEqual({});
  });

  test('avgGrossMargin is computed across all months', () => {
    const config = makeConfig({
      revenueStreams: [makeStream({ unitPrice: 100, unitsPerMonth: 10, cogsPct: 40 })],
      projectionMonths: 6
    });
    const result = SimEngine.run(config);
    // Gross margin should be around 60%
    expect(result.summary.avgGrossMargin).toBeCloseTo(60, 0);
  });
});

// ── Currency and percentage formatters ──

describe('SimEngine formatters', () => {
  test('currency with custom symbol', () => {
    expect(SimEngine.currency(1500, '€')).toBe('€1.5K');
    expect(SimEngine.currency(500, '£')).toBe('£500');
  });

  test('currency rounds small values', () => {
    expect(SimEngine.currency(99.7)).toBe('$100');
    expect(SimEngine.currency(0)).toBe('$0');
  });

  test('currency handles negative millions', () => {
    expect(SimEngine.currency(-2500000)).toBe('-$2.5M');
  });

  test('pct handles null/undefined', () => {
    expect(SimEngine.pct(null)).toBe('0.0%');
    expect(SimEngine.pct(undefined)).toBe('0.0%');
  });
});

// ── Month label ──

describe('Month labels', () => {
  test('first month uses current month', () => {
    const config = makeConfig({ projectionMonths: 1 });
    const result = SimEngine.run(config);
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.months[0].label).toContain(months[now.getMonth()]);
  });

  test('month labels wrap around year boundaries', () => {
    const config = makeConfig({ projectionMonths: 24 });
    const result = SimEngine.run(config);
    const labels = result.months.map(m => m.label);
    // All labels should be valid format like "Jan 2025"
    labels.forEach(l => expect(l).toMatch(/^[A-Z][a-z]{2} \d{4}$/));
  });
});

// ── SimulationTypes additional tests ──

describe('SimulationTypes additional coverage', () => {
  test('getTemplate returns same data as DEFAULTS', () => {
    const tmpl = SimulationTypes.getTemplate('restaurant');
    expect(tmpl.label).toBe('Restaurant / Food & Drink');
    expect(tmpl.revenueStreams).toBeTruthy();
    expect(tmpl.staff).toBeTruthy();
  });

  test('getTemplate falls back to service for unknown type', () => {
    const tmpl = SimulationTypes.getTemplate('spaceship');
    expect(tmpl.label).toBe('Service / Consulting');
  });

  test('buildConfigFromWizard maps canvas cost structure to opex', () => {
    const business = { type: 'restaurant' };
    const canvas = {
      revenueStreams: [],
      costStructure: [
        { id: 'c1', text: 'Marketing expenses' },
        { id: 'c2', text: 'Custom cost item' }
      ]
    };
    const config = SimulationTypes.buildConfigFromWizard(business, canvas);
    expect(config.opex.length).toBe(2);
    expect(config.opex[0].name).toBe('Marketing expenses');
    expect(config.opex[1].name).toBe('Custom cost item');
    // Unmatched custom cost should get default monthly value
    expect(config.opex[1].monthly).toBe(300);
  });

  test('buildConfigFromWizard applies revenue range to starting cash', () => {
    const ranges = {
      'Pre-revenue': 5000,
      '$0 - $1K': 8000,
      '$1K - $5K': 15000,
      '$5K - $20K': 30000,
      '$20K - $50K': 60000,
      '$50K - $100K': 100000,
      '$100K+': 200000
    };
    Object.entries(ranges).forEach(([range, expected]) => {
      const config = SimulationTypes.buildConfigFromWizard(
        { type: 'service', revenueRange: range }, null
      );
      expect(config.startingCash).toBe(expected);
    });
  });

  test('buildConfigFromWizard override takes precedence over revenue range', () => {
    const config = SimulationTypes.buildConfigFromWizard(
      { type: 'service', revenueRange: '$100K+' },
      null,
      { startingCash: 42 }
    );
    expect(config.startingCash).toBe(42);
  });

  test('DEFAULT_SCENARIOS has correct structure', () => {
    const sc = SimulationTypes.DEFAULT_SCENARIOS;
    expect(sc.pessimistic.revenueMult).toBeLessThan(1);
    expect(sc.pessimistic.costMult).toBeGreaterThan(1);
    expect(sc.base.revenueMult).toBe(1);
    expect(sc.base.costMult).toBe(1);
    expect(sc.optimistic.revenueMult).toBeGreaterThan(1);
    expect(sc.optimistic.costMult).toBeLessThan(1);
  });

  test('all business types have kpiLabels', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
    types.forEach(type => {
      const labels = SimulationTypes.getKpiLabels(type);
      expect(labels).toHaveProperty('units');
      expect(labels).toHaveProperty('revenue');
      expect(labels).toHaveProperty('customers');
    });
  });
});
