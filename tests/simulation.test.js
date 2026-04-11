const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

// ── SimulationTypes ──

describe('SimulationTypes', () => {
  describe('listTypes()', () => {
    test('returns all 6 business types', () => {
      const types = SimulationTypes.listTypes();
      expect(types).toHaveLength(6);
      const ids = types.map(t => t.id);
      expect(ids).toContain('restaurant');
      expect(ids).toContain('retail');
      expect(ids).toContain('service');
      expect(ids).toContain('saas');
      expect(ids).toContain('ecommerce');
      expect(ids).toContain('subscription');
    });

    test('each type has id and label', () => {
      SimulationTypes.listTypes().forEach(t => {
        expect(t.id).toBeTruthy();
        expect(t.label).toBeTruthy();
      });
    });
  });

  describe('getDefaults()', () => {
    test('returns a complete config for each business type', () => {
      const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
      types.forEach(type => {
        const config = SimulationTypes.getDefaults(type);
        expect(config.businessType).toBe(type);
        expect(config.projectionMonths).toBe(36);
        expect(config.startingCash).toBeGreaterThan(0);
        expect(config.revenueStreams.length).toBeGreaterThan(0);
        expect(config.staff.length).toBeGreaterThan(0);
        expect(config.opex.length).toBeGreaterThan(0);
        expect(config.scenario).toBe('base');
        expect(config.scenarioMultipliers).toBeTruthy();
      });
    });

    test('falls back to service for unknown type', () => {
      const config = SimulationTypes.getDefaults('unknown');
      expect(config.businessType).toBe('unknown');
      expect(config.revenueStreams.length).toBeGreaterThan(0);
    });

    test('revenue streams have required fields', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      config.revenueStreams.forEach(rs => {
        expect(rs.id).toBeTruthy();
        expect(rs.name).toBeTruthy();
        expect(rs.type).toBeTruthy();
        expect(typeof rs.unitPrice).toBe('number');
        expect(typeof rs.unitsPerMonth).toBe('number');
        expect(typeof rs.growthRate).toBe('number');
      });
    });

    test('SaaS streams have churnRate', () => {
      const config = SimulationTypes.getDefaults('saas');
      const recurring = config.revenueStreams.filter(rs => rs.type === 'recurring');
      expect(recurring.length).toBeGreaterThan(0);
      recurring.forEach(rs => {
        expect(typeof rs.churnRate).toBe('number');
        expect(rs.churnRate).toBeGreaterThan(0);
      });
    });
  });

  describe('getKpiLabels()', () => {
    test('returns labels for known types', () => {
      const labels = SimulationTypes.getKpiLabels('restaurant');
      expect(labels.units).toBe('covers');
      expect(labels.revenue).toBe('sales');
      expect(labels.customers).toBe('guests');
    });

    test('returns service labels for unknown type', () => {
      const labels = SimulationTypes.getKpiLabels('unknown');
      expect(labels.units).toBe('billable hours');
    });
  });

  describe('buildConfigFromWizard()', () => {
    test('builds config from business and canvas data', () => {
      const business = { type: 'restaurant', name: 'Test Cafe', revenueRange: '$5K - $20K' };
      const canvas = { revenueStreams: [], costStructure: [] };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);

      expect(config.businessType).toBe('restaurant');
      expect(config.businessName).toBe('Test Cafe');
      expect(config.startingCash).toBe(30000); // from revenue range mapping
    });

    test('uses canvas revenue stream names when available', () => {
      const business = { type: 'service' };
      const canvas = {
        revenueStreams: [{ id: 'r1', text: 'Consulting' }, { id: 'r2', text: 'Training' }],
        costStructure: []
      };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas);
      expect(config.revenueStreams[0].name).toBe('Consulting');
      expect(config.revenueStreams[1].name).toBe('Training');
    });

    test('applies overrides', () => {
      const business = { type: 'service' };
      const canvas = { revenueStreams: [], costStructure: [] };
      const config = SimulationTypes.buildConfigFromWizard(business, canvas, {
        startingCash: 99999,
        projectionMonths: 60
      });
      expect(config.startingCash).toBe(99999);
      expect(config.projectionMonths).toBe(60);
    });

    test('handles null business and canvas', () => {
      const config = SimulationTypes.buildConfigFromWizard(null, null);
      expect(config.businessType).toBe('service');
      expect(config.revenueStreams.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplate()', () => {
    test('returns template for known type', () => {
      const tmpl = SimulationTypes.getTemplate('saas');
      expect(tmpl.label).toBe('Software / SaaS');
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
      expect(tmpl.kpiLabels).toBeTruthy();
    });

    test('falls back to service for unknown type', () => {
      const tmpl = SimulationTypes.getTemplate('magic');
      expect(tmpl.label).toBe('Service / Consulting');
    });
  });

  describe('buildConfigFromWizard() edge cases', () => {
    test('maps all revenue ranges to starting cash', () => {
      const ranges = {
        'Pre-revenue': 5000,
        '$0 - $1K': 8000,
        '$1K - $5K': 15000,
        '$5K - $20K': 30000,
        '$20K - $50K': 60000,
        '$50K - $100K': 100000,
        '$100K+': 200000
      };

      Object.keys(ranges).forEach(range => {
        const biz = { type: 'service', revenueRange: range };
        const config = SimulationTypes.buildConfigFromWizard(biz, null);
        expect(config.startingCash).toBe(ranges[range]);
      });
    });

    test('startingCash override takes precedence over revenue range', () => {
      const biz = { type: 'service', revenueRange: '$100K+' };
      const config = SimulationTypes.buildConfigFromWizard(biz, null, { startingCash: 42 });
      expect(config.startingCash).toBe(42);
    });

    test('matches canvas cost structure to defaults by name similarity', () => {
      const biz = { type: 'restaurant' };
      const canvas = {
        revenueStreams: [],
        costStructure: [
          { id: 'c1', text: 'Rent for building' },
          { id: 'c2', text: 'Marketing and ads' }
        ]
      };
      const config = SimulationTypes.buildConfigFromWizard(biz, canvas);
      expect(config.opex).toHaveLength(2);
      expect(config.opex[0].name).toBe('Rent for building');
      // Should match Rent / Lease default
      expect(config.opex[0].monthly).toBe(4000);
      expect(config.opex[1].name).toBe('Marketing and ads');
      // Should match Marketing default
      expect(config.opex[1].monthly).toBe(500);
    });

    test('unmatched cost structure items get default monthly of 300', () => {
      const biz = { type: 'service' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ id: 'c1', text: 'Wizard school tuition' }]
      };
      const config = SimulationTypes.buildConfigFromWizard(biz, canvas);
      expect(config.opex[0].monthly).toBe(300);
    });

    test('handles empty text in canvas cost structure without crashing', () => {
      const biz = { type: 'service' };
      const canvas = {
        revenueStreams: [],
        costStructure: [{ id: 'c1', text: '' }, { id: 'c2' }]
      };
      expect(() => {
        SimulationTypes.buildConfigFromWizard(biz, canvas);
      }).not.toThrow();
    });

    test('overrides staff array entirely', () => {
      const biz = { type: 'service' };
      const overrides = {
        staff: [{ role: 'CTO', count: 1, monthlyCost: 12000 }]
      };
      const config = SimulationTypes.buildConfigFromWizard(biz, null, overrides);
      expect(config.staff).toHaveLength(1);
      expect(config.staff[0].role).toBe('CTO');
    });

    test('canvas revenue streams inherit financial defaults from type', () => {
      const biz = { type: 'saas' };
      const canvas = {
        revenueStreams: [
          { id: 'r1', text: 'Pro plan' },
          { id: 'r2', text: 'Enterprise plan' },
          { id: 'r3', text: 'API access' }
        ],
        costStructure: []
      };
      const config = SimulationTypes.buildConfigFromWizard(biz, canvas);
      expect(config.revenueStreams).toHaveLength(3);
      expect(config.revenueStreams[0].name).toBe('Pro plan');
      // Third stream falls back to first base stream
      expect(config.revenueStreams[2].type).toBe('recurring');
    });
  });

  describe('DEFAULT_SCENARIOS', () => {
    test('has three scenario multipliers', () => {
      const sc = SimulationTypes.DEFAULT_SCENARIOS;
      expect(sc.pessimistic.revenueMult).toBeLessThan(1);
      expect(sc.pessimistic.costMult).toBeGreaterThan(1);
      expect(sc.base.revenueMult).toBe(1);
      expect(sc.base.costMult).toBe(1);
      expect(sc.optimistic.revenueMult).toBeGreaterThan(1);
      expect(sc.optimistic.costMult).toBeLessThan(1);
    });
  });
});

// ── SimEngine ──

describe('SimEngine', () => {
  describe('run()', () => {
    test('returns months, years, summary, and config', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);

      expect(result.months).toBeTruthy();
      expect(result.months).toHaveLength(36);
      expect(result.years).toBeTruthy();
      expect(result.years).toHaveLength(3);
      expect(result.summary).toBeTruthy();
      expect(result.config).toBeTruthy();
    });

    test('monthly output has all required fields', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);
      const m = result.months[0];

      expect(typeof m.month).toBe('number');
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
      expect(typeof m.revenuePerHead).toBe('number');
      expect(typeof m.burnRate).toBe('number');
      expect(typeof m.runway).toBe('number');
      expect(Array.isArray(m.revenueByStream)).toBe(true);
    });

    test('annual rollup has correct fields', () => {
      const config = SimulationTypes.getDefaults('service');
      const result = SimEngine.run(config);
      const y = result.years[0];

      expect(y.year).toBe(1);
      expect(y.months).toBe(12);
      expect(typeof y.revenue).toBe('number');
      expect(typeof y.cogs).toBe('number');
      expect(typeof y.grossProfit).toBe('number');
      expect(typeof y.staffCost).toBe('number');
      expect(typeof y.opex).toBe('number');
      expect(typeof y.netIncome).toBe('number');
      expect(typeof y.cashBalance).toBe('number');
    });

    test('cash balance starts from starting cash', () => {
      const config = SimulationTypes.getDefaults('service');
      config.startingCash = 50000;
      const result = SimEngine.run(config);
      // First month cash = startingCash + netIncome for month 0
      const m0 = result.months[0];
      expect(m0.cashBalance).toBe(50000 + m0.netIncome);
    });

    test('respects projectionMonths', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 12;
      const result = SimEngine.run(config);
      expect(result.months).toHaveLength(12);
      expect(result.years).toHaveLength(1);
    });

    test('clamps projection to minimum 6 months', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 2;
      const result = SimEngine.run(config);
      expect(result.months).toHaveLength(6);
    });

    test('clamps projection to maximum 120 months', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 999;
      const result = SimEngine.run(config);
      expect(result.months).toHaveLength(120);
    });

    test('handles empty config gracefully', () => {
      const result = SimEngine.run({});
      expect(result.months).toHaveLength(36);
      result.months.forEach(m => {
        expect(m.revenue).toBe(0);
        expect(m.cashBalance).toBe(0);
      });
    });
  });

  describe('revenue growth', () => {
    test('unit revenue grows over time with positive growth rate', () => {
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
      // Revenue should increase month over month
      expect(result.months[11].revenue).toBeGreaterThan(result.months[0].revenue);
    });

    test('recurring revenue accounts for churn', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 10 // 10% monthly churn, 0 growth
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // With 10% churn and 0% growth, subscribers should decrease
      expect(result.months[11].revenue).toBeLessThan(result.months[0].revenue);
    });

    test('seasonality multipliers affect revenue', () => {
      const seasonality = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 2.0];
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0,
          seasonality: seasonality
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // December (month 12, index 11) should have much higher revenue
      expect(result.months[11].revenue).toBeGreaterThan(result.months[0].revenue * 2);
    });
  });

  describe('costs', () => {
    test('COGS calculated per unit', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 20, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].cogs).toBe(200); // 10 units * $20
      expect(result.months[0].revenue).toBe(1000); // 10 units * $100
    });

    test('COGS calculated as percentage of revenue', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Test', type: 'unit',
          unitPrice: 100, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 30, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].cogs).toBe(300); // 30% of $1000
    });

    test('staff costs scale with headcount', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [],
        staff: [
          { role: 'Dev', count: 3, monthlyCost: 5000 }
        ],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].staffCost).toBe(15000); // 3 * $5000
      expect(result.months[0].headcount).toBe(3);
    });

    test('opex with growth rate increases over time', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [],
        staff: [],
        opex: [{ name: 'Marketing', monthly: 1000, growthRate: 10 }],
        capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[11].opex).toBeGreaterThan(result.months[0].opex);
    });

    test('capex applied only in scheduled month', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 100000,
        revenueStreams: [],
        staff: [],
        opex: [],
        capex: [{ name: 'Equipment', amount: 50000, month: 2 }],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      expect(result.months[0].capex).toBe(0);
      expect(result.months[1].capex).toBe(0);
      expect(result.months[2].capex).toBe(50000);
      expect(result.months[3].capex).toBe(0);
    });
  });

  describe('scenarios', () => {
    test('pessimistic scenario has lower revenue than base', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      config.projectionMonths = 12;
      const scenarios = SimEngine.runScenarios(config);

      expect(scenarios.pessimistic.summary.year1Revenue).toBeLessThan(
        scenarios.base.summary.year1Revenue
      );
    });

    test('optimistic scenario has higher revenue than base', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      config.projectionMonths = 12;
      const scenarios = SimEngine.runScenarios(config);

      expect(scenarios.optimistic.summary.year1Revenue).toBeGreaterThan(
        scenarios.base.summary.year1Revenue
      );
    });

    test('runScenarios returns all three scenarios', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 12;
      const scenarios = SimEngine.runScenarios(config);

      expect(scenarios.pessimistic).toBeTruthy();
      expect(scenarios.base).toBeTruthy();
      expect(scenarios.optimistic).toBeTruthy();
    });
  });

  describe('summary KPIs', () => {
    test('calculates break-even month for profitable business', () => {
      const config = {
        projectionMonths: 24,
        startingCash: 5000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 5,
          cogsPerUnit: 20, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [{ name: 'Rent', monthly: 2000, growthRate: 0 }],
        capex: [{ name: 'Setup', amount: 10000, month: 0 }],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // With $10K revenue, $2K COGS, $7K fixed costs - profitable from month 1
      // but capex in month 0 pushes cash negative initially
      expect(result.summary.breakEvenMonth).toBeTruthy();
      expect(result.summary.breakEvenMonth).toBeGreaterThanOrEqual(1);
    });

    test('break-even is null when never profitable', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 10, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 5, cogsPct: 0, churnRate: 0
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 5000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // $100 revenue vs $5000 staff = never profitable
      expect(result.summary.breakEvenMonth).toBeNull();
    });

    test('peak cash needed reflects lowest point', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 10000,
        revenueStreams: [],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 2000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };

      const result = SimEngine.run(config);
      // Burns $2K/mo, starting at $10K, goes negative at month 6
      expect(result.summary.peakCashDeficit).toBeLessThan(0);
    });
  });

  describe('currency() and pct()', () => {
    test('formats large numbers with K/M suffixes', () => {
      expect(SimEngine.currency(1500)).toBe('$1.5K');
      expect(SimEngine.currency(2500000)).toBe('$2.5M');
      expect(SimEngine.currency(500)).toBe('$500');
    });

    test('formats negative numbers', () => {
      expect(SimEngine.currency(-5000)).toBe('-$5.0K');
    });

    test('handles null/NaN', () => {
      expect(SimEngine.currency(null)).toBe('$0');
      expect(SimEngine.currency(NaN)).toBe('$0');
    });

    test('pct formats correctly', () => {
      expect(SimEngine.pct(45.67)).toBe('45.7%');
      expect(SimEngine.pct(0)).toBe('0.0%');
    });
  });

  describe('revenue edge cases', () => {
    test('zero growth rate maintains approximately constant revenue', () => {
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Flat', type: 'unit',
          unitPrice: 50, unitsPerMonth: 20, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // All months should have the same revenue (no growth, no seasonality)
      expect(result.months[0].revenue).toBe(1000);
      expect(result.months[11].revenue).toBe(1000);
    });

    test('churn exceeding growth leads to subscriber decline', () => {
      const config = {
        projectionMonths: 24,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Subs', type: 'recurring',
          unitPrice: 10, unitsPerMonth: 1000, growthRate: 2,
          cogsPerUnit: 0, cogsPct: 0, churnRate: 8
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Net growth = 1 + 0.02 - 0.08 = 0.94, so declining
      expect(result.months[23].revenue).toBeLessThan(result.months[0].revenue);
    });

    test('combined COGS per unit and COGS percentage', () => {
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
      // COGS = 10 units * $10/unit + 20% of $1000 = $100 + $200 = $300
      expect(result.months[0].cogs).toBe(300);
    });

    test('multiple revenue streams aggregate correctly', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [
          { id: 'rs1', name: 'A', type: 'unit', unitPrice: 50, unitsPerMonth: 10, growthRate: 0, cogsPerUnit: 0, cogsPct: 0 },
          { id: 'rs2', name: 'B', type: 'unit', unitPrice: 100, unitsPerMonth: 5, growthRate: 0, cogsPerUnit: 0, cogsPct: 0 }
        ],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].revenue).toBe(1000); // 500 + 500
      expect(result.months[0].revenueByStream).toHaveLength(2);
      expect(result.months[0].revenueByStream[0].revenue).toBe(500);
      expect(result.months[0].revenueByStream[1].revenue).toBe(500);
    });
  });

  describe('staff edge cases', () => {
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
      // Month 0: count=2, month 3: count=3, month 6: count=4, month 9: count=5
      expect(result.months[0].headcount).toBe(2);
      expect(result.months[3].headcount).toBe(3);
      expect(result.months[6].headcount).toBe(4);
      expect(result.months[9].headcount).toBe(5);
    });

    test('zero staff cost when count is 0', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 0,
        revenueStreams: [],
        staff: [{ role: 'Intern', count: 0, monthlyCost: 1000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].staffCost).toBe(0);
      expect(result.months[0].headcount).toBe(0);
    });
  });

  describe('capex edge cases', () => {
    test('multiple capex events in different months', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 100000,
        revenueStreams: [],
        staff: [],
        opex: [],
        capex: [
          { name: 'A', amount: 10000, month: 0 },
          { name: 'B', amount: 20000, month: 3 },
          { name: 'C', amount: 5000, month: 0 }
        ],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].capex).toBe(15000); // A + C
      expect(result.months[3].capex).toBe(20000); // B
      expect(result.summary.totalCapex).toBe(35000);
    });
  });

  describe('break-even edge cases', () => {
    test('break-even requires sustained profitability', () => {
      // Business that is profitable month 1, unprofitable month 2, then profitable again
      const config = {
        projectionMonths: 12,
        startingCash: 0,
        revenueStreams: [{
          id: 'rs1', name: 'Seasonal', type: 'unit',
          unitPrice: 100, unitsPerMonth: 100, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0,
          seasonality: [2.0, 0.1, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0]
        }],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 9000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 0 (Jan): revenue = 200*100 = $20K, profit. Month 1 (Feb): revenue = 10*100 = $1K, loss.
      // Break-even should NOT be month 1 since it's not sustained
      if (result.summary.breakEvenMonth !== null) {
        expect(result.summary.breakEvenMonth).toBeGreaterThan(1);
      }
    });
  });

  describe('runway calculation', () => {
    test('runway is 999 when cash positive and net income positive', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [{
          id: 'rs1', name: 'Sales', type: 'unit',
          unitPrice: 1000, unitsPerMonth: 10, growthRate: 0,
          cogsPerUnit: 0, cogsPct: 0
        }],
        staff: [], opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      expect(result.months[0].runway).toBe(999);
      expect(result.months[0].burnRate).toBe(0);
    });

    test('runway calculated correctly when burning cash', () => {
      const config = {
        projectionMonths: 6,
        startingCash: 10000,
        revenueStreams: [],
        staff: [{ role: 'Owner', count: 1, monthlyCost: 1000 }],
        opex: [], capex: [],
        scenario: 'base',
        scenarioMultipliers: { base: { revenueMult: 1.0, costMult: 1.0 } }
      };
      const result = SimEngine.run(config);
      // Month 0: cash = 10000 - 1000 = 9000, burn = 1000, runway = 9
      expect(result.months[0].burnRate).toBe(1000);
      expect(result.months[0].runway).toBe(9);
    });
  });

  describe('rollupYear()', () => {
    test('rolls up 12 months into year', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 24;
      const result = SimEngine.run(config);

      expect(result.years).toHaveLength(2);
      expect(result.years[0].months).toBe(12);
      expect(result.years[1].months).toBe(12);
    });

    test('partial year has fewer months', () => {
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 18;
      const result = SimEngine.run(config);

      expect(result.years).toHaveLength(2);
      expect(result.years[0].months).toBe(12);
      expect(result.years[1].months).toBe(6);
    });

    test('gross margin and net margin in annual rollup', () => {
      const config = SimulationTypes.getDefaults('restaurant');
      const result = SimEngine.run(config);
      const y1 = result.years[0];

      expect(y1.grossMargin).toBeGreaterThan(0);
      expect(y1.grossMargin).toBeLessThan(100);
      expect(typeof y1.netMargin).toBe('number');
    });
  });

  describe('all business types produce valid results', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      test(`${type} defaults produce a valid 36-month projection`, () => {
        const config = SimulationTypes.getDefaults(type);
        const result = SimEngine.run(config);

        expect(result.months).toHaveLength(36);
        expect(result.years).toHaveLength(3);

        // Revenue should be positive
        expect(result.months[0].revenue).toBeGreaterThan(0);

        // Cash balance should be a number for every month
        result.months.forEach(m => {
          expect(typeof m.cashBalance).toBe('number');
          expect(isFinite(m.cashBalance)).toBe(true);
        });

        // Summary should be populated
        expect(typeof result.summary.year1Revenue).toBe('number');
        expect(typeof result.summary.avgGrossMargin).toBe('number');
        expect(typeof result.summary.totalCapex).toBe('number');
      });
    });
  });
});

// ── Store simulation persistence ──

describe('Store simulation persistence', () => {
  test('saves and retrieves sim config', () => {
    const config = { businessType: 'test', startingCash: 5000 };
    Store.saveSimConfig(config);
    expect(Store.getSimConfig()).toEqual(config);
  });

  test('saves and retrieves sim results', () => {
    const results = { months: [{ month: 1, revenue: 100 }] };
    Store.saveSimResults(results);
    expect(Store.getSimResults()).toEqual(results);
  });

  test('returns null when no sim config saved', () => {
    expect(Store.getSimConfig()).toBeNull();
  });

  test('sim config included in exportAll', () => {
    Store.saveSimConfig({ businessType: 'test' });
    const exported = JSON.parse(Store.exportAll());
    expect(exported.simConfig).toEqual({ businessType: 'test' });
  });

  test('importAll restores sim config', () => {
    const data = { simConfig: { businessType: 'imported' } };
    Store.importAll(JSON.stringify(data));
    expect(Store.getSimConfig()).toEqual({ businessType: 'imported' });
  });
});

// ── SimulationUI ──

describe('SimulationUI', () => {
  test('renders simulation dashboard into container', () => {
    Store.saveBusiness({ name: 'Test Biz', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);

    SimulationUI.render(container);

    expect(container.querySelector('.sim-header')).toBeTruthy();
    expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
    expect(container.querySelector('.sim-scenarios')).toBeTruthy();
    expect(container.querySelector('.sim-section')).toBeTruthy();
  });

  test('renders scenario toggle with base active by default', () => {
    Store.saveBusiness({ name: 'Test', type: 'restaurant' });
    const container = document.createElement('div');
    document.body.appendChild(container);

    SimulationUI.render(container);

    const activeScenario = container.querySelector('.sim-sc.active');
    expect(activeScenario).toBeTruthy();
    expect(activeScenario.textContent).toBe('Base Case');
  });

  test('renders P&L table', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);

    SimulationUI.render(container);

    expect(container.querySelector('.sim-pl-table')).toBeTruthy();
  });

  test('renders KPI cards', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);

    SimulationUI.render(container);

    const kpis = container.querySelectorAll('.sim-kpi');
    expect(kpis.length).toBeGreaterThanOrEqual(4);
  });

  test('renders all three scenario tabs', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const tabs = container.querySelectorAll('.sim-sc');
    expect(tabs).toHaveLength(3);
    const tabTexts = Array.from(tabs).map(t => t.textContent);
    expect(tabTexts).toContain('Pessimistic');
    expect(tabTexts).toContain('Base Case');
    expect(tabTexts).toContain('Optimistic');
  });

  test('renders edit button with correct initial text', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const editBtn = container.querySelector('#sim-toggle-edit');
    expect(editBtn).toBeTruthy();
    expect(editBtn.textContent).toBe('Edit Assumptions');
  });

  test('renders cash flow SVG chart', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const svgs = container.querySelectorAll('.sim-svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2); // cash chart + revenue chart
  });

  test('renders revenue stream breakdown table', () => {
    Store.saveBusiness({ name: 'Test', type: 'restaurant' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Should have at least 2 P&L tables (main + stream breakdown)
    const tables = container.querySelectorAll('.sim-pl-table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
  });

  test('KPI cards show correct labels', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const labels = container.querySelectorAll('.sim-kpi-label');
    const labelTexts = Array.from(labels).map(l => l.textContent);
    expect(labelTexts).toContain('Break-even');
    expect(labelTexts).toContain('Funding Needed');
    expect(labelTexts).toContain('Y1 Revenue');
    expect(labelTexts).toContain('Y3 Cash');
    expect(labelTexts).toContain('Gross Margin');
    expect(labelTexts).toContain('Final Monthly');
  });

  test('saves sim config to store on first render', () => {
    Store.saveBusiness({ name: 'Test', type: 'saas' });
    expect(Store.getSimConfig()).toBeNull();

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const savedConfig = Store.getSimConfig();
    expect(savedConfig).toBeTruthy();
    expect(savedConfig.businessType).toBe('saas');
  });

  test('saves sim results to store after render', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const results = Store.getSimResults();
    expect(results).toBeTruthy();
    expect(results.months).toBeTruthy();
    expect(results.months.length).toBeGreaterThan(0);
  });

  test('uses existing sim config from store', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const customConfig = SimulationTypes.getDefaults('service');
    customConfig.startingCash = 99999;
    Store.saveSimConfig(customConfig);

    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    // Config should use the stored one, not rebuild
    const results = Store.getSimResults();
    expect(results.config.startingCash).toBe(99999);
  });

  test('P&L table has quarterly columns for year 1', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const headers = container.querySelectorAll('.sim-pl-yr');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Q1 Y1');
    expect(headerTexts).toContain('Q2 Y1');
    expect(headerTexts).toContain('Q3 Y1');
    expect(headerTexts).toContain('Q4 Y1');
  });

  test('P&L table shows year 2 and year 3 columns', () => {
    Store.saveBusiness({ name: 'Test', type: 'service' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const headers = container.querySelectorAll('.sim-pl-yr');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Year 2');
    expect(headerTexts).toContain('Year 3');
  });

  test('stream breakdown shows stream names and types', () => {
    Store.saveBusiness({ name: 'Test', type: 'restaurant' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    SimulationUI.render(container);

    const badges = container.querySelectorAll('.sim-type-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  test('renders for all business types without errors', () => {
    const types = ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'];
    types.forEach(type => {
      resetLocalStorage();
      Store.saveBusiness({ name: 'Test ' + type, type: type });
      const container = document.createElement('div');
      document.body.appendChild(container);
      expect(() => SimulationUI.render(container)).not.toThrow();
      expect(container.querySelector('.sim-header')).toBeTruthy();
      container.remove();
    });
  });
});
