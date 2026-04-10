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

  describe('getTemplate()', () => {
    test('returns raw template for known type', () => {
      const tmpl = SimulationTypes.getTemplate('restaurant');
      expect(tmpl.label).toBe('Restaurant / Food & Drink');
      expect(tmpl.revenueStreams).toBeTruthy();
      expect(tmpl.revenueStreams.length).toBeGreaterThan(0);
      expect(tmpl.startingCash).toBeGreaterThan(0);
      expect(tmpl.kpiLabels).toBeTruthy();
    });

    test('falls back to service for unknown type', () => {
      const tmpl = SimulationTypes.getTemplate('nonexistent');
      expect(tmpl.label).toBe('Service / Consulting');
    });

    test('returns template with kpiLabels for each type', () => {
      ['restaurant', 'retail', 'service', 'saas', 'ecommerce', 'subscription'].forEach(type => {
        const tmpl = SimulationTypes.getTemplate(type);
        expect(tmpl.kpiLabels).toBeTruthy();
        expect(tmpl.kpiLabels.units).toBeTruthy();
        expect(tmpl.kpiLabels.revenue).toBeTruthy();
        expect(tmpl.kpiLabels.customers).toBeTruthy();
      });
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
});
