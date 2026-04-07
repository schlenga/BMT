const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

// ── SimEngine advanced edge cases ──

describe('SimEngine advanced', () => {
  describe('staff hiring growth (hireEveryMonths)', () => {
    test('hires additional staff at specified intervals', () => {
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

      // Month 0: 2 staff, Month 3: 2+1=3, Month 6: 2+2=4, Month 9: 2+3=5
      expect(result.months[0].headcount).toBe(2);
      expect(result.months[0].staffCost).toBe(10000);
      expect(result.months[3].headcount).toBe(3);
      expect(result.months[3].staffCost).toBe(15000);
      expect(result.months[6].headcount).toBe(4);
      expect(result.months[9].headcount).toBe(5);
    });

    test('does not hire in month 0', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 50000,
        revenueStreams: [],
        staff: [{ role: 'Support', count: 1, monthlyCost: 3000, hireEveryMonths: 1 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Month 0: no extra hires (monthIndex > 0 check)
      expect(result.months[0].headcount).toBe(1);
      // Month 1: 1 + floor(1/1) = 2
      expect(result.months[1].headcount).toBe(2);
    });
  });

  describe('combined COGS (per-unit + percentage)', () => {
    test('adds both per-unit COGS and percentage COGS', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Product', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 10, cogsPct: 20, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Revenue: 10 * $100 = $1000
      // COGS: 10 * $10 (per-unit) + $1000 * 20% (pct) = $100 + $200 = $300
      expect(result.months[0].cogs).toBe(300);
    });
  });

  describe('recurring revenue with both growth and churn', () => {
    test('net growth = growth - churn compounds correctly', () => {
      const config = {
        projectionMonths: 12,
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
      // Net growth rate = 10% - 5% = 5% per month
      // Subscribers should grow over time
      expect(result.months[11].revenue).toBeGreaterThan(result.months[0].revenue);
      // But slower than pure 10% growth
      const pureGrowthMonth11 = Math.round(100 * Math.pow(1.10, 11)) * 50;
      expect(result.months[11].revenue).toBeLessThan(pureGrowthMonth11);
    });

    test('high churn overwhelms growth', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 50, unitsPerMonth: 100, growthRate: 2, churnRate: 10,
          cogsPerUnit: 0, cogsPct: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[11].revenue).toBeLessThan(result.months[0].revenue);
    });
  });

  describe('multiple revenue streams', () => {
    test('correctly sums revenue from multiple streams', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [
          { id: 'rs1', name: 'A', type: 'unit', unitPrice: 100, unitsPerMonth: 10, growthRate: 0, cogsPerUnit: 0, cogsPct: 0, churnRate: 0 },
          { id: 'rs2', name: 'B', type: 'unit', unitPrice: 50, unitsPerMonth: 20, growthRate: 0, cogsPerUnit: 0, cogsPct: 0, churnRate: 0 }
        ],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Stream A: 10 * $100 = $1000, Stream B: 20 * $50 = $1000
      expect(result.months[0].revenue).toBe(2000);
      expect(result.months[0].revenueByStream).toHaveLength(2);
      expect(result.months[0].revenueByStream[0].revenue).toBe(1000);
      expect(result.months[0].revenueByStream[1].revenue).toBe(1000);
    });
  });

  describe('scenario multipliers', () => {
    test('pessimistic reduces revenue and increases costs', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 1000 }],
        opex: [{ name: 'Rent', monthly: 500, growthRate: 0 }],
        capex: [],
        scenario: 'pessimistic',
        scenarioMultipliers: {
          pessimistic: { revenueMult: 0.7, costMult: 1.1 },
          base: { revenueMult: 1.0, costMult: 1.0 }
        }
      };

      const result = SimEngine.run(config);
      // Revenue: round(10 * 0.7) * 100 = 7 * 100 = 700
      expect(result.months[0].revenue).toBe(700);
      // Staff: 1000 * 1.1 = 1100, Opex: 500 * 1.1 = 550
      expect(result.months[0].staffCost).toBe(1100);
      expect(result.months[0].opex).toBe(550);
    });

    test('missing scenario defaults to multiplier of 1.0', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
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
    test('handles partial year (less than 12 months)', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 8;
      const result = SimEngine.run(config);

      expect(result.years).toHaveLength(1);
      expect(result.years[0].months).toBe(8);
    });

    test('year 2 rollup starts at month 13', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 24;
      const result = SimEngine.run(config);

      expect(result.years).toHaveLength(2);
      expect(result.years[0].year).toBe(1);
      expect(result.years[0].months).toBe(12);
      expect(result.years[1].year).toBe(2);
      expect(result.years[1].months).toBe(12);
    });
  });

  describe('monthLabel', () => {
    test('month labels wrap correctly around year boundary', () => {
      const config = {
        projectionMonths: 24,
        startingCash: 0,
        revenueStreams: [],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Labels should include month abbreviations and years
      result.months.forEach(m => {
        expect(m.label).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/);
      });
    });
  });

  describe('KPI calculations', () => {
    test('runway calculated correctly when burning cash', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 24000,
        revenueStreams: [],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 2000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Month 0: cash = 24000 - 2000 = 22000, burn = 2000, runway = 22000/2000 = 11
      expect(result.months[0].burnRate).toBe(2000);
      expect(result.months[0].runway).toBe(11);
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
      expect(result.months[0].burnRate).toBe(0);
      expect(result.months[0].runway).toBe(999);
    });

    test('revenue per head calculated correctly', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Dev', count: 2, monthlyCost: 3000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Revenue: $1000, headcount: 2, revenuePerHead: 500
      expect(result.months[0].revenuePerHead).toBe(500);
    });

    test('break-even requires sustained profitability', () => {
      // Build a scenario where month 3 is profitable but month 4 is not
      // Break-even should not trigger at month 3
      const config = {
        projectionMonths: 12,
        startingCash: 50000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0,
          // Seasonality: big spike in month 3, then drop
          seasonality: [0.1, 0.1, 0.1, 20, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 1500 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Break-even should NOT be month 4 (index 3) because profitability isn't sustained
      if (result.summary.breakEvenMonth === 4) {
        // If it is month 4, check months 5 and 6 are also profitable (they shouldn't be)
        expect(result.months[4].netIncome).toBeGreaterThan(0);
      }
    });
  });

  describe('gross margin calculation', () => {
    test('gross margin is 0 when no revenue', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].grossMargin).toBe(0);
    });

    test('gross margin calculated correctly with COGS', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 40, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Revenue: $1000, COGS: $400, GP: $600, GM: 60%
      expect(result.months[0].grossMargin).toBe(60);
    });
  });
});

// ── SimulationTypes advanced ──

describe('SimulationTypes advanced', () => {
  describe('getTemplate()', () => {
    test('returns template for known type', () => {
      const tmpl = SimulationTypes.getTemplate('restaurant');
      expect(tmpl.label).toBe('Restaurant / Food & Drink');
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
      expect(tmpl.staff.length).toBeGreaterThan(0);
      expect(tmpl.startingCash).toBeGreaterThan(0);
    });

    test('falls back to service for unknown type', () => {
      const tmpl = SimulationTypes.getTemplate('nonexistent');
      expect(tmpl.label).toBe('Service / Consulting');
    });
  });

  describe('DEFAULT_SCENARIOS', () => {
    test('has three scenarios with expected multipliers', () => {
      const sc = SimulationTypes.DEFAULT_SCENARIOS;
      expect(sc.pessimistic.revenueMult).toBeLessThan(1);
      expect(sc.pessimistic.costMult).toBeGreaterThan(1);
      expect(sc.base.revenueMult).toBe(1);
      expect(sc.base.costMult).toBe(1);
      expect(sc.optimistic.revenueMult).toBeGreaterThan(1);
      expect(sc.optimistic.costMult).toBeLessThan(1);
    });
  });

  describe('buildConfigFromWizard() edge cases', () => {
    test('maps canvas costStructure to opex with name matching', () => {
      const business = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [],
        costStructure: [
          { id: 'c1', text: 'Rent' },
          { id: 'c2', text: 'Marketing budget' }
        ]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      expect(config.opex).toHaveLength(2);
      expect(config.opex[0].name).toBe('Rent');
      expect(config.opex[1].name).toBe('Marketing budget');
      // Should have matched "Rent" to the default "Rent / Lease" entry
      expect(config.opex[0].monthly).toBeGreaterThan(0);
    });

    test('uses default monthly cost when no match found', () => {
      const business = { type: 'service' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ id: 'c1', text: 'Zzzunique expense' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      expect(config.opex[0].monthly).toBe(300); // default fallback
    });

    test('maps revenue range to starting cash', () => {
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
        const business = { type: 'service', revenueRange: range };
        const config = SimulationTypes.buildConfigFromWizard(business, null);
        expect(config.startingCash).toBe(expected);
      });
    });

    test('override startingCash takes precedence over revenue range mapping', () => {
      const business = { type: 'service', revenueRange: '$100K+' };
      const config = SimulationTypes.buildConfigFromWizard(business, null, { startingCash: 42 });
      expect(config.startingCash).toBe(42);
    });

    test('sets businessName from business object', () => {
      const business = { type: 'service', name: 'Acme Corp' };
      const config = SimulationTypes.buildConfigFromWizard(business, null);
      expect(config.businessName).toBe('Acme Corp');
    });
  });

  describe('DEFAULTS data integrity', () => {
    test('all types have kpiLabels with units, revenue, and customers', () => {
      const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
      types.forEach(type => {
        const labels = SimulationTypes.getKpiLabels(type);
        expect(labels.units).toBeTruthy();
        expect(labels.revenue).toBeTruthy();
        expect(labels.customers).toBeTruthy();
      });
    });

    test('all types have valid seasonality arrays or null', () => {
      const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
      types.forEach(type => {
        const config = SimulationTypes.getDefaults(type);
        config.revenueStreams.forEach(rs => {
          if (rs.seasonality !== null) {
            expect(rs.seasonality).toHaveLength(12);
            rs.seasonality.forEach(s => {
              expect(typeof s).toBe('number');
              expect(s).toBeGreaterThan(0);
            });
          }
        });
      });
    });

    test('all capex items have month >= 0', () => {
      const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
      types.forEach(type => {
        const config = SimulationTypes.getDefaults(type);
        config.capex.forEach(c => {
          expect(c.month).toBeGreaterThanOrEqual(0);
          expect(c.amount).toBeGreaterThan(0);
        });
      });
    });
  });
});

// ── SimulationUI advanced ──

describe('SimulationUI advanced', () => {
  test('creates and saves config from business when none exists', () => {
    Store.saveBusiness({ name: 'New Biz', type: 'restaurant' });
    expect(Store.getSimConfig()).toBeNull();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const savedConfig = Store.getSimConfig();
    expect(savedConfig).toBeTruthy();
    expect(savedConfig.businessType).toBe('restaurant');
  });

  test('uses existing sim config when available', () => {
    const customConfig = SimulationTypes.getDefaults('saas');
    customConfig.startingCash = 99999;
    Store.saveSimConfig(customConfig);
    Store.saveBusiness({ name: 'SaaS Co', type: 'saas' });

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const savedConfig = Store.getSimConfig();
    expect(savedConfig.startingCash).toBe(99999);
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

  test('renders all three scenario buttons', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const scenarios = container.querySelectorAll('.sim-sc');
    expect(scenarios).toHaveLength(3);
    const labels = Array.from(scenarios).map(s => s.textContent);
    expect(labels).toContain('Pessimistic');
    expect(labels).toContain('Base Case');
    expect(labels).toContain('Optimistic');
  });

  test('renders SVG charts', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const svgs = container.querySelectorAll('.sim-svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  test('renders revenue stream breakdown table', () => {
    Store.saveBusiness({ name: 'Test', type: 'restaurant' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Restaurant has 2 revenue streams, should render breakdown
    const tables = container.querySelectorAll('.sim-pl-table');
    expect(tables.length).toBeGreaterThanOrEqual(2); // P&L + Stream breakdown
  });

  test('saves simulation results to store', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    expect(Store.getSimResults()).toBeNull();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const results = Store.getSimResults();
    expect(results).toBeTruthy();
    expect(results.months).toBeTruthy();
    expect(results.months.length).toBeGreaterThan(0);
  });
});

// ── Currency/pct edge cases ──

describe('SimEngine.currency edge cases', () => {
  test('formats zero', () => {
    expect(SimEngine.currency(0)).toBe('$0');
  });

  test('formats small negative', () => {
    expect(SimEngine.currency(-50)).toBe('-$50');
  });

  test('uses custom symbol', () => {
    expect(SimEngine.currency(1500, '€')).toBe('€1.5K');
  });

  test('handles undefined', () => {
    expect(SimEngine.currency(undefined)).toBe('$0');
  });

  test('formats exactly 1000', () => {
    expect(SimEngine.currency(1000)).toBe('$1.0K');
  });

  test('formats exactly 1000000', () => {
    expect(SimEngine.currency(1000000)).toBe('$1.0M');
  });
});

describe('SimEngine.pct edge cases', () => {
  test('formats null as 0', () => {
    expect(SimEngine.pct(null)).toBe('0.0%');
  });

  test('formats undefined as 0', () => {
    expect(SimEngine.pct(undefined)).toBe('0.0%');
  });

  test('formats negative percentage', () => {
    expect(SimEngine.pct(-10.5)).toBe('-10.5%');
  });
});
