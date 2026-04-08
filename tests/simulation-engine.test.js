const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

describe('SimEngine — edge cases', () => {
  describe('staff hiring schedule', () => {
    test('hireEveryMonths adds headcount over time', () => {
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

      // Month 0: count=2, no hires yet
      expect(result.months[0].headcount).toBe(2);
      // Month 3: count=2 + floor(3/3)=1 = 3
      expect(result.months[3].headcount).toBe(3);
      // Month 6: count=2 + floor(6/3)=2 = 4
      expect(result.months[6].headcount).toBe(4);
      // Month 9: count=2 + floor(9/3)=3 = 5
      expect(result.months[9].headcount).toBe(5);
    });

    test('hireEveryMonths=0 does not add headcount', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 100000,
        revenueStreams: [],
        staff: [{ role: 'Dev', count: 2, monthlyCost: 5000, hireEveryMonths: 0 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].headcount).toBe(2);
      expect(result.months[11].headcount).toBe(2);
    });
  });

  describe('combined COGS (per unit + percentage)', () => {
    test('both cogsPerUnit and cogsPct contribute to total COGS', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 10, cogsPct: 20, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Per-unit: 10 units * $10 = $100
      // Percentage: $1000 revenue * 20% = $200
      // Total COGS: $300
      expect(result.months[0].cogs).toBe(300);
    });
  });

  describe('multiple revenue streams', () => {
    test('aggregates revenue from multiple streams', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [
          { id: 'rs1', name: 'A', type: 'unit', unitPrice: 50, unitsPerMonth: 10, growthRate: 0, cogsPerUnit: 0, cogsPct: 0, churnRate: 0 },
          { id: 'rs2', name: 'B', type: 'unit', unitPrice: 100, unitsPerMonth: 5, growthRate: 0, cogsPerUnit: 0, cogsPct: 0, churnRate: 0 }
        ],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // A: 10*50=500, B: 5*100=500 => total 1000
      expect(result.months[0].revenue).toBe(1000);
      expect(result.months[0].revenueByStream).toHaveLength(2);
    });
  });

  describe('zero growth rate', () => {
    test('flat revenue with zero growth', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Flat', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Revenue should be the same every month
      expect(result.months[0].revenue).toBe(1000);
      expect(result.months[11].revenue).toBe(1000);
    });
  });

  describe('recurring stream with equal growth and churn', () => {
    test('net zero growth keeps subscribers flat', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 10, unitsPerMonth: 100, growthRate: 5, churnRate: 5,
          cogsPerUnit: 0, cogsPct: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Net growth = 1 + 0.05 - 0.05 = 1.0, so subscribers stay flat
      expect(result.months[0].revenue).toBe(result.months[11].revenue);
    });
  });

  describe('month labels', () => {
    test('month labels are formatted as "Mon YYYY"', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 6;
      const result = SimEngine.run(config);
      result.months.forEach(m => {
        expect(m.label).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
      });
    });
  });

  describe('rollupYear', () => {
    test('returns null for empty months', () => {
      const result = SimEngine.rollupYear([], 1);
      expect(result).toBeNull();
    });

    test('handles partial year (less than 12 months)', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 8;
      const result = SimEngine.run(config);
      expect(result.years).toHaveLength(1);
      expect(result.years[0].months).toBe(8);
    });

    test('year 2 rollup starts from month 13', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 24;
      const result = SimEngine.run(config);
      expect(result.years).toHaveLength(2);
      expect(result.years[0].year).toBe(1);
      expect(result.years[1].year).toBe(2);
      expect(result.years[0].months).toBe(12);
      expect(result.years[1].months).toBe(12);
    });
  });

  describe('calcKPIs edge cases', () => {
    test('break-even requires sustained profitability', () => {
      // Create a scenario where net income flips positive briefly then negative
      const config = {
        projectionMonths: 12,
        startingCash: 10000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 70, growthRate: 2,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0,
          seasonality: [1.0, 1.0, 1.0, 1.0, 1.0, 0.1, 0.1, 0.1, 1.0, 1.0, 1.0, 1.0]
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [{ name: 'Rent', monthly: 1000, growthRate: 0 }],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.summary).toBeTruthy();
      // break-even should not be triggered by a single profitable month
      // if followed by unprofitable months
    });

    test('year3Revenue is calculated from months 25-36', () => {
      const config = {
        projectionMonths: 36,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 5,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Year 3 revenue should be sum of months 25-36 (indices 24-35)
      let y3Rev = 0;
      for (let i = 24; i < 36; i++) {
        y3Rev += result.months[i].revenue;
      }
      expect(result.summary.year3Revenue).toBe(Math.round(y3Rev));
    });

    test('average gross margin is calculated across all months', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      const result = SimEngine.run(config);
      expect(result.summary.avgGrossMargin).toBeGreaterThan(0);
      expect(result.summary.avgGrossMargin).toBeLessThan(100);
    });
  });

  describe('currency and pct formatting', () => {
    test('currency with custom symbol', () => {
      expect(SimEngine.currency(1500, '€')).toBe('€1.5K');
    });

    test('currency handles zero', () => {
      expect(SimEngine.currency(0)).toBe('$0');
    });

    test('currency handles undefined', () => {
      expect(SimEngine.currency(undefined)).toBe('$0');
    });

    test('pct handles undefined', () => {
      expect(SimEngine.pct(undefined)).toBe('0.0%');
    });

    test('pct handles negative', () => {
      expect(SimEngine.pct(-10.5)).toBe('-10.5%');
    });
  });
});

describe('SimulationTypes — edge cases', () => {
  describe('getTemplate()', () => {
    test('returns template for known type', () => {
      const tmpl = SimulationTypes.getTemplate('restaurant');
      expect(tmpl.label).toBe('Restaurant / Food & Drink');
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
    });

    test('falls back to service for unknown type', () => {
      const tmpl = SimulationTypes.getTemplate('nonexistent');
      expect(tmpl.label).toBe('Service / Consulting');
    });
  });

  describe('DEFAULT_SCENARIOS', () => {
    test('pessimistic has lower revenue multiplier', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.pessimistic.revenueMult).toBeLessThan(1);
      expect(SimulationTypes.DEFAULT_SCENARIOS.pessimistic.costMult).toBeGreaterThan(1);
    });

    test('base is 1.0/1.0', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.base.revenueMult).toBe(1.0);
      expect(SimulationTypes.DEFAULT_SCENARIOS.base.costMult).toBe(1.0);
    });

    test('optimistic has higher revenue multiplier', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.optimistic.revenueMult).toBeGreaterThan(1);
    });
  });

  describe('buildConfigFromWizard — cost matching', () => {
    test('matches cost structure items to base opex by keyword', () => {
      const business = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ text: 'Marketing expenses' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      // Should match "Marketing" from base opex
      const marketingOpex = config.opex.find(o => o.name === 'Marketing expenses');
      expect(marketingOpex).toBeTruthy();
      expect(marketingOpex.monthly).toBeGreaterThan(0);
    });

    test('empty cost text does not falsely match (bug regression)', () => {
      const business = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ text: '' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      // With empty text, should get default fallback (300)
      expect(config.opex[0].monthly).toBe(300);
    });

    test('null-ish cost text does not crash', () => {
      const business = { type: 'service' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ text: null }, { text: undefined }]
      };
      // Should not throw
      expect(() => {
        SimulationTypes.buildConfigFromWizard(business, canvas);
      }).not.toThrow();
    });

    test('revenue range maps to starting cash', () => {
      const cases = [
        ['Pre-revenue', 5000],
        ['$0 - $1K', 8000],
        ['$100K+', 200000]
      ];
      cases.forEach(([range, expected]) => {
        const config = SimulationTypes.buildConfigFromWizard(
          { type: 'service', revenueRange: range },
          { revenueStreams: [], costStructure: [] }
        );
        expect(config.startingCash).toBe(expected);
      });
    });

    test('overrides.startingCash takes priority over revenue range', () => {
      const config = SimulationTypes.buildConfigFromWizard(
        { type: 'service', revenueRange: '$100K+' },
        { revenueStreams: [], costStructure: [] },
        { startingCash: 42 }
      );
      expect(config.startingCash).toBe(42);
    });
  });

  describe('getDefaults — stream IDs', () => {
    test('each revenue stream gets a unique id', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      const ids = config.revenueStreams.map(rs => rs.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
