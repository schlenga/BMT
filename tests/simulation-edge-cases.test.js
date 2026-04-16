/**
 * Edge case tests for the simulation engine and simulation types.
 * Covers boundary conditions, unusual inputs, and financial edge cases.
 */
const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

describe('SimEngine edge cases', () => {
  describe('projectMonth edge cases', () => {
    test('handles zero starting cash', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 50, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].cashBalance).toBe(500);
    });

    test('handles negative net income correctly', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 1: 10000 - 5000 = 5000
      expect(result.months[0].cashBalance).toBe(5000);
      // Month 2: 5000 - 5000 = 0
      expect(result.months[1].cashBalance).toBe(0);
      // Month 3: 0 - 5000 = -5000
      expect(result.months[2].cashBalance).toBe(-5000);
    });

    test('burn rate is zero when profitable', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].burnRate).toBe(0);
    });

    test('runway is 999 when profitable', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].runway).toBe(999);
    });

    test('runway is 0 when cash is depleted', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 1000,
        revenueStreams: [],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // After month 1: cash = 1000 - 5000 = -4000 (negative)
      expect(result.months[0].cashBalance).toBe(-4000);
      expect(result.months[0].runway).toBe(0);
    });
  });

  describe('revenue stream types', () => {
    test('hourly type works like unit type', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Consulting', type: 'hourly',
          unitPrice: 150, unitsPerMonth: 80, growthRate: 5,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].revenue).toBe(12000); // 80 * 150
      expect(result.months[5].revenue).toBeGreaterThan(result.months[0].revenue);
    });

    test('project type works like unit type', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Projects', type: 'project',
          unitPrice: 5000, unitsPerMonth: 2, growthRate: 0,
          cogsPerUnit: 1000, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].revenue).toBe(10000);
      expect(result.months[0].cogs).toBe(2000);
    });

    test('recurring type with net negative growth shrinks to zero', () => {
      const config = {
        projectionMonths: 24,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 50, unitsPerMonth: 100, growthRate: 2,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 15 // heavy churn
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Units can't go below 0
      result.months.forEach(m => {
        expect(m.revenue).toBeGreaterThanOrEqual(0);
      });
    });

    test('COGS combines per-unit and percentage', () => {
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
      // COGS = 10*10 (per unit) + 1000*0.20 (percentage) = 100 + 200 = 300
      expect(result.months[0].cogs).toBe(300);
    });
  });

  describe('staff with auto-hiring', () => {
    test('hireEveryMonths triggers additional headcount', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [],
        staff: [{ role: 'Dev', count: 2, monthlyCost: 5000, hireEveryMonths: 3 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 0: count=2 (no hires yet)
      expect(result.months[0].headcount).toBe(2);
      // Month 3: count=2+1=3
      expect(result.months[3].headcount).toBe(3);
      // Month 6: count=2+2=4
      expect(result.months[6].headcount).toBe(4);
    });
  });

  describe('scenario multipliers', () => {
    test('pessimistic multiplier reduces revenue and increases costs', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 6;

      config.scenario = 'base';
      const base = SimEngine.run(config);

      config.scenario = 'pessimistic';
      const pess = SimEngine.run(config);

      expect(pess.months[0].revenue).toBeLessThan(base.months[0].revenue);
      expect(pess.months[0].staffCost).toBeGreaterThan(base.months[0].staffCost);
    });

    test('optimistic multiplier increases revenue', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 6;

      config.scenario = 'base';
      const base = SimEngine.run(config);

      config.scenario = 'optimistic';
      const opt = SimEngine.run(config);

      expect(opt.months[0].revenue).toBeGreaterThan(base.months[0].revenue);
    });

    test('missing scenario defaults to 1.0 multipliers', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'nonexistent',
        scenarioMultipliers: {}
      };
      const result = SimEngine.run(config);
      expect(result.months[0].revenue).toBe(1000);
    });
  });

  describe('rollupYear edge cases', () => {
    test('partial year rollup (< 12 months)', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 8;
      const result = SimEngine.run(config);
      expect(result.years).toHaveLength(1);
      expect(result.years[0].months).toBe(8);
    });

    test('exact year boundary', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 24;
      const result = SimEngine.run(config);
      expect(result.years).toHaveLength(2);
      expect(result.years[0].months).toBe(12);
      expect(result.years[1].months).toBe(12);
    });

    test('annual totals sum correctly', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      const year = result.years[0];
      // 12 months * $1000/month = $12000
      expect(year.revenue).toBe(12000);
    });
  });

  describe('calcKPIs edge cases', () => {
    test('year3Revenue is 0 when projection < 36 months', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 12;
      const result = SimEngine.run(config);
      expect(result.summary.year3Revenue).toBe(0);
    });

    test('year1Revenue sums first 12 months only', () => {
      const config = {
        projectionMonths: 24,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.summary.year1Revenue).toBe(12000); // 12 * 1000
    });

    test('avgGrossMargin handles zero revenue months', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.summary.avgGrossMargin).toBe(0);
    });

    test('finalMonthlyRevenue reflects last month', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 10,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.summary.finalMonthlyRevenue).toBe(Math.round(result.months[11].revenue));
    });
  });

  describe('currency() edge cases', () => {
    test('formats zero', () => {
      expect(SimEngine.currency(0)).toBe('$0');
    });

    test('formats exact boundaries', () => {
      expect(SimEngine.currency(999)).toBe('$999');
      expect(SimEngine.currency(1000)).toBe('$1.0K');
      expect(SimEngine.currency(999999)).toBe('$1000.0K');
      expect(SimEngine.currency(1000000)).toBe('$1.0M');
    });

    test('uses custom symbol', () => {
      expect(SimEngine.currency(1500, '€')).toBe('€1.5K');
      expect(SimEngine.currency(500, '£')).toBe('£500');
    });

    test('pct handles null', () => {
      expect(SimEngine.pct(null)).toBe('0.0%');
      expect(SimEngine.pct(undefined)).toBe('0.0%');
    });
  });

  describe('multiple revenue streams', () => {
    test('aggregates revenue from multiple streams', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [
          {
            id: 'rs1', name: 'Product A', type: 'unit',
            unitPrice: 50, unitsPerMonth: 20, growthRate: 0,
            cogsPerUnit: 10, cogsPct: 0, churnRate: 0
          },
          {
            id: 'rs2', name: 'Product B', type: 'unit',
            unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
            cogsPerUnit: 0, cogsPct: 25, churnRate: 0
          }
        ],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // A: 20*50=1000, B: 10*100=1000 => total=2000
      expect(result.months[0].revenue).toBe(2000);
      // A COGS: 20*10=200, B COGS: 1000*0.25=250 => total=450
      expect(result.months[0].cogs).toBe(450);
      expect(result.months[0].revenueByStream).toHaveLength(2);
    });
  });
});

describe('SimulationTypes edge cases', () => {
  describe('getDefaults deep copy', () => {
    test('modifications to returned config do not affect templates', () => {
      const config1 = SimulationTypes.getDefaults('saas');
      config1.startingCash = 999999;
      config1.revenueStreams[0].unitPrice = 1;

      const config2 = SimulationTypes.getDefaults('saas');
      expect(config2.startingCash).toBe(30000);
      expect(config2.revenueStreams[0].unitPrice).toBe(29);
    });
  });

  describe('buildConfigFromWizard revenue range mapping', () => {
    test('maps all revenue ranges correctly', () => {
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

    test('override startingCash takes priority over revenue range', () => {
      const config = SimulationTypes.buildConfigFromWizard(
        { type: 'service', revenueRange: '$100K+' },
        { revenueStreams: [], costStructure: [] },
        { startingCash: 42 }
      );
      expect(config.startingCash).toBe(42);
    });
  });

  describe('buildConfigFromWizard canvas matching', () => {
    test('maps canvas revenue stream names to type defaults', () => {
      const business = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [
          { id: 'r1', text: 'Lunch service' },
          { id: 'r2', text: 'Catering' },
          { id: 'r3', text: 'Merch' }
        ],
        costStructure: []
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      expect(config.revenueStreams).toHaveLength(3);
      expect(config.revenueStreams[0].name).toBe('Lunch service');
      expect(config.revenueStreams[2].name).toBe('Merch');
      // Third stream should still get first type's defaults for numbers
      expect(config.revenueStreams[2].unitPrice).toBe(config.revenueStreams[0].unitPrice);
    });
  });

  describe('DEFAULT_SCENARIOS', () => {
    test('has all three scenarios', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.pessimistic).toBeTruthy();
      expect(SimulationTypes.DEFAULT_SCENARIOS.base).toBeTruthy();
      expect(SimulationTypes.DEFAULT_SCENARIOS.optimistic).toBeTruthy();
    });

    test('base scenario is 1.0 multipliers', () => {
      expect(SimulationTypes.DEFAULT_SCENARIOS.base.revenueMult).toBe(1.0);
      expect(SimulationTypes.DEFAULT_SCENARIOS.base.costMult).toBe(1.0);
    });
  });
});

describe('SimulationUI edge cases', () => {
  test('creates config from wizard data when no saved config', () => {
    Store.saveBusiness({ name: 'New Biz', type: 'retail' });
    // Don't save any sim config — UI should auto-generate
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Should have created and saved a config
    const savedConfig = Store.getSimConfig();
    expect(savedConfig).toBeTruthy();
    expect(savedConfig.businessType).toBe('retail');
  });

  test('renders edit button', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const editBtn = container.querySelector('#sim-toggle-edit');
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent).toBe('Edit Assumptions');
  });

  test('renders revenue stream breakdown table', () => {
    Store.saveBusiness({ name: 'Test', type: 'restaurant' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Restaurant has 2 revenue streams, table should render
    const tables = container.querySelectorAll('.sim-pl-table');
    expect(tables.length).toBeGreaterThanOrEqual(2); // P&L + stream breakdown
  });

  test('SVG charts contain valid coordinates', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const svgs = container.querySelectorAll('.sim-svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    svgs.forEach(svg => {
      const html = svg.outerHTML;
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
    });
  });

  test('scenario toggle buttons render for all three scenarios', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const scenarios = container.querySelectorAll('.sim-sc');
    expect(scenarios).toHaveLength(3);
    const texts = Array.from(scenarios).map(s => s.textContent);
    expect(texts).toContain('Pessimistic');
    expect(texts).toContain('Base Case');
    expect(texts).toContain('Optimistic');
  });
});
