const { loadModules, resetLocalStorage } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation']);
});

beforeEach(() => {
  resetLocalStorage();
});

describe('SimEngine — detailed unit tests', () => {

  describe('projectMonth()', () => {
    test('returns correct structure for a single month', () => {
      const config = SimulationTypes.getDefaults('service');
      config.scenario = 'base';
      const m = SimEngine.projectMonth(config, 0, 10000);
      expect(m.month).toBe(1);
      expect(typeof m.label).toBe('string');
      expect(typeof m.revenue).toBe('number');
      expect(typeof m.cogs).toBe('number');
      expect(typeof m.grossProfit).toBe('number');
      expect(typeof m.grossMargin).toBe('number');
      expect(typeof m.staffCost).toBe('number');
      expect(typeof m.opex).toBe('number');
      expect(typeof m.capex).toBe('number');
      expect(typeof m.ebitda).toBe('number');
      expect(typeof m.netIncome).toBe('number');
      expect(typeof m.cashBalance).toBe('number');
      expect(typeof m.headcount).toBe('number');
    });

    test('month index 0 uses initial cash as prevCash', () => {
      const config = {
        revenueStreams: [],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const m = SimEngine.projectMonth(config, 0, 5000);
      expect(m.cashBalance).toBe(5000);
    });

    test('cash flows accumulate from prevCash', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const m = SimEngine.projectMonth(config, 0, 1000);
      expect(m.cashBalance).toBe(1000 + m.netIncome);
    });

    test('scenario multipliers affect revenue and costs', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Dev', count: 1, monthlyCost: 500 }],
        opex: [{ name: 'Rent', monthly: 200, growthRate: 0 }],
        capex: [],
        scenario: 'pessimistic',
        scenarioMultipliers: {
          pessimistic: { revenueMult: 0.7, costMult: 1.1 }
        }
      };
      const m = SimEngine.projectMonth(config, 0, 0);
      // Revenue: 10 units * $100 * 0.7 = $700 (rounded from units)
      expect(m.revenue).toBeLessThan(1000);
      // Staff: $500 * 1.1 = $550
      expect(m.staffCost).toBeCloseTo(550, 0);
    });

    test('handles missing scenarioMultipliers gracefully', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: {}
      };
      const m = SimEngine.projectMonth(config, 0, 0);
      expect(m.revenue).toBe(1000);
    });

    test('grossProfit equals revenue minus cogs', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 30, cogsPct: 0, churnRate: 0
        }],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const m = SimEngine.projectMonth(config, 0, 0);
      expect(m.grossProfit).toBe(m.revenue - m.cogs);
    });

    test('ebitda equals grossProfit minus fixed costs', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 300 }],
        opex: [{ name: 'Rent', monthly: 200, growthRate: 0 }],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const m = SimEngine.projectMonth(config, 0, 0);
      expect(m.ebitda).toBe(m.grossProfit - m.totalFixedCosts);
    });

    test('netIncome equals ebitda minus capex', () => {
      const config = {
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [],
        opex: [],
        capex: [{ name: 'Equipment', amount: 200, month: 0 }],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const m = SimEngine.projectMonth(config, 0, 0);
      expect(m.netIncome).toBe(m.ebitda - m.capex);
    });
  });

  describe('rollupYear()', () => {
    test('sums monthly values for a year', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);
      const y1 = SimEngine.rollupYear(result.months, 1);
      expect(y1.year).toBe(1);
      expect(y1.months).toBe(12);

      let totalRev = 0;
      for (let i = 0; i < 12; i++) totalRev += result.months[i].revenue;
      expect(y1.revenue).toBe(Math.round(totalRev));
    });

    test('returns null for empty month slice', () => {
      expect(SimEngine.rollupYear([], 1)).toBeNull();
    });

    test('handles partial year correctly', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 8;
      const result = SimEngine.run(config);
      const y1 = SimEngine.rollupYear(result.months, 1);
      expect(y1.months).toBe(8);
    });

    test('year 2 starts from month 13', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);
      const y2 = SimEngine.rollupYear(result.months, 2);
      expect(y2.year).toBe(2);
      expect(y2.months).toBe(12);
      expect(y2.cashBalance).toBe(Math.round(result.months[23].cashBalance));
    });

    test('grossMargin calculated correctly', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      const result = SimEngine.run(config);
      const y1 = SimEngine.rollupYear(result.months, 1);
      const expectedMargin = y1.revenue > 0
        ? Math.round(y1.grossProfit / y1.revenue * 1000) / 10
        : 0;
      expect(y1.grossMargin).toBe(expectedMargin);
    });
  });

  describe('calcKPIs()', () => {
    test('break-even requires 3 consecutive profitable months', () => {
      // Construct months where last 3 months (indices 9,10,11) are profitable
      const months = [];
      for (let i = 0; i < 12; i++) {
        const profitable = i >= 9;
        months.push({
          month: i + 1, revenue: 1000, cogs: 0,
          grossProfit: 1000, grossMargin: 100,
          staffCost: profitable ? 500 : 2000,
          opex: 0, capex: 0, totalFixedCosts: profitable ? 500 : 2000,
          ebitda: profitable ? 500 : -1000,
          netIncome: profitable ? 500 : -1000,
          cashBalance: 0,
          headcount: 1, revenuePerHead: 1000, burnRate: profitable ? 0 : 1000,
          runway: 0, revenueByStream: []
        });
      }
      const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
      // Index 9 has 2 confirming months (10, 11) → break-even = month 10
      expect(kpis.breakEvenMonth).toBe(10);
    });

    test('break-even is null when fewer than 3 months of profitability at end', () => {
      // Only last 2 months profitable — not enough to confirm sustainability
      const months = [];
      for (let i = 0; i < 6; i++) {
        const profitable = i >= 4;
        months.push({
          month: i + 1, revenue: 1000, cogs: 0,
          grossProfit: 1000, grossMargin: 100,
          staffCost: profitable ? 500 : 2000,
          opex: 0, capex: 0, totalFixedCosts: profitable ? 500 : 2000,
          ebitda: profitable ? 500 : -1000,
          netIncome: profitable ? 500 : -1000,
          cashBalance: 0,
          headcount: 1, revenuePerHead: 1000,
          burnRate: profitable ? 0 : 1000, runway: 0,
          revenueByStream: []
        });
      }
      const kpis = SimEngine.calcKPIs(months, { startingCash: 0 });
      // Index 4 has only 1 confirming month (index 5), not enough
      expect(kpis.breakEvenMonth).toBeNull();
    });

    test('peakCashNeeded is zero when cash never goes negative', () => {
      const months = [];
      for (let i = 0; i < 6; i++) {
        months.push({
          month: i + 1, revenue: 5000, cogs: 1000,
          grossProfit: 4000, grossMargin: 80,
          staffCost: 1000, opex: 500, capex: 0,
          totalFixedCosts: 1500, ebitda: 2500,
          netIncome: 2500,
          cashBalance: 10000 + 2500 * (i + 1),
          headcount: 1, revenuePerHead: 5000,
          burnRate: 0, runway: 999,
          revenueByStream: []
        });
      }
      const kpis = SimEngine.calcKPIs(months, { startingCash: 10000 });
      expect(kpis.peakCashNeeded).toBe(0);
    });

    test('finalMonthlyRevenue and finalMonthlyNet reflect last month', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);
      const last = result.months[result.months.length - 1];
      expect(result.summary.finalMonthlyRevenue).toBe(Math.round(last.revenue));
      expect(result.summary.finalMonthlyNet).toBe(Math.round(last.netIncome));
    });
  });

  describe('staff hireEveryMonths', () => {
    test('adds 1 headcount every N months', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 100000,
        revenueStreams: [],
        staff: [{ role: 'Dev', count: 2, monthlyCost: 5000, hireEveryMonths: 3 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 0: count=2, Month 3: count=3, Month 6: count=4, Month 9: count=5
      expect(result.months[0].headcount).toBe(2);
      expect(result.months[3].headcount).toBe(3);
      expect(result.months[6].headcount).toBe(4);
      expect(result.months[9].headcount).toBe(5);
    });
  });

  describe('COGS combined per-unit and percentage', () => {
    test('both cogsPerUnit and cogsPct apply together', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 10, cogsPct: 20, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // COGS = 10 * $10 (per unit) + $1000 * 20% (pct) = $100 + $200 = $300
      expect(result.months[0].cogs).toBe(300);
    });
  });

  describe('recurring revenue with both growth and churn', () => {
    test('net growth compounds correctly', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 50, unitsPerMonth: 100, growthRate: 10, churnRate: 5,
          cogsPerUnit: 0, cogsPct: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Net growth = 10% - 5% = 5% per month
      // Month 0: 100 subs, Month 1: ~105, etc.
      expect(result.months[0].revenueByStream[0].units).toBe(100);
      expect(result.months[1].revenueByStream[0].units).toBeGreaterThan(100);
      // Verify compounding: month 5 should be ~100 * 1.05^5 ≈ 128
      expect(result.months[5].revenueByStream[0].units).toBeGreaterThan(120);
    });
  });

  describe('runway calculation', () => {
    test('runway is 999 when profitable', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].runway).toBe(999);
    });

    test('runway reflects months of cash remaining when burning', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [],
        staff: [{ role: 'Dev', count: 1, monthlyCost: 1000 }],
        opex: [],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 0: cash = 10000 - 1000 = 9000, burnRate = 1000, runway = 9
      expect(result.months[0].burnRate).toBe(1000);
      expect(result.months[0].runway).toBe(9);
    });
  });

  describe('currency() edge cases', () => {
    test('formats zero', () => {
      expect(SimEngine.currency(0)).toBe('$0');
    });

    test('formats exactly 1000', () => {
      expect(SimEngine.currency(1000)).toBe('$1.0K');
    });

    test('formats exactly 1000000', () => {
      expect(SimEngine.currency(1000000)).toBe('$1.0M');
    });

    test('supports custom currency symbol', () => {
      expect(SimEngine.currency(500, '€')).toBe('€500');
      expect(SimEngine.currency(2500, '£')).toBe('£2.5K');
    });

    test('formats negative millions', () => {
      expect(SimEngine.currency(-1500000)).toBe('-$1.5M');
    });
  });
});

describe('SimulationTypes — detailed tests', () => {

  describe('getTemplate()', () => {
    test('returns template for known type', () => {
      const tmpl = SimulationTypes.getTemplate('restaurant');
      expect(tmpl.label).toBe('Restaurant / Food & Drink');
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
      expect(tmpl.staff.length).toBeGreaterThan(0);
    });

    test('falls back to service for unknown type', () => {
      const tmpl = SimulationTypes.getTemplate('unknown');
      expect(tmpl.label).toBe('Service / Consulting');
    });
  });

  describe('DEFAULT_SCENARIOS', () => {
    test('has pessimistic, base, and optimistic', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.pessimistic).toBeTruthy();
      expect(SimulationTypes.DEFAULT_SCENARIOS.base).toBeTruthy();
      expect(SimulationTypes.DEFAULT_SCENARIOS.optimistic).toBeTruthy();
    });

    test('pessimistic has lower revenue mult and higher cost mult', () => {
      const p = SimulationTypes.DEFAULT_SCENARIOS.pessimistic;
      const b = SimulationTypes.DEFAULT_SCENARIOS.base;
      expect(p.revenueMult).toBeLessThan(b.revenueMult);
      expect(p.costMult).toBeGreaterThan(b.costMult);
    });

    test('optimistic has higher revenue mult and lower cost mult', () => {
      const o = SimulationTypes.DEFAULT_SCENARIOS.optimistic;
      const b = SimulationTypes.DEFAULT_SCENARIOS.base;
      expect(o.revenueMult).toBeGreaterThan(b.revenueMult);
      expect(o.costMult).toBeLessThan(b.costMult);
    });
  });

  describe('buildConfigFromWizard() — cost matching', () => {
    test('matches canvas costs to default opex by name prefix', () => {
      const business = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ id: 'c1', text: 'Rent for the shop' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      // Should match to "Rent / Lease" from restaurant defaults
      const rent = config.opex.find(o => o.name === 'Rent for the shop');
      expect(rent).toBeTruthy();
      expect(rent.monthly).toBeGreaterThan(0);
    });

    test('unmatched canvas costs get default value', () => {
      const business = { type: 'service' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ id: 'c1', text: 'Completely custom cost' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      const custom = config.opex.find(o => o.name === 'Completely custom cost');
      expect(custom).toBeTruthy();
      expect(custom.monthly).toBe(300);
    });

    test('revenue range mapping for all ranges', () => {
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
          { type: 'service', revenueRange: range },
          { revenueStreams: [], costStructure: [] }
        );
        expect(config.startingCash).toBe(expected);
      });
    });
  });

  describe('DEFAULTS structure', () => {
    test('all types have required fields', () => {
      const types = Object.keys(SimulationTypes.DEFAULTS);
      types.forEach(type => {
        const d = SimulationTypes.DEFAULTS[type];
        expect(d.label).toBeTruthy();
        expect(d.currency).toBe('$');
        expect(Array.isArray(d.revenueStreams)).toBe(true);
        expect(Array.isArray(d.staff)).toBe(true);
        expect(Array.isArray(d.opex)).toBe(true);
        expect(Array.isArray(d.capex)).toBe(true);
        expect(typeof d.startingCash).toBe('number');
        expect(d.kpiLabels).toBeTruthy();
      });
    });

    test('restaurant has seasonality on dine-in', () => {
      const dineIn = SimulationTypes.DEFAULTS.restaurant.revenueStreams[0];
      expect(dineIn.seasonality).toBeTruthy();
      expect(dineIn.seasonality).toHaveLength(12);
    });

    test('saas has recurring streams with churn', () => {
      const streams = SimulationTypes.DEFAULTS.saas.revenueStreams;
      streams.forEach(s => {
        expect(s.type).toBe('recurring');
        expect(typeof s.churnRate).toBe('number');
      });
    });
  });
});
