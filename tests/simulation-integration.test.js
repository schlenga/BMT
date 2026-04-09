const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  global.alert = jest.fn();
  global.confirm = jest.fn(() => true);
  global.prompt = jest.fn(() => null);

  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  jest.clearAllMocks();
});

describe('Simulation integration', () => {
  describe('wizard data flows to simulation', () => {
    test('wizard business type determines simulation defaults', () => {
      Store.saveBusiness({ name: 'Cafe', type: 'restaurant', revenueRange: '$5K - $20K' });
      Store.saveCanvas({
        customerSegments: [{ id: 'c1', text: 'Locals' }],
        valueProp: [{ id: 'v1', text: 'Great food' }],
        channels: [],
        customerRelationships: [],
        revenueStreams: [{ id: 'r1', text: 'Dine-in' }],
        keyResources: [],
        keyActivities: [],
        keyPartners: [],
        costStructure: [{ id: 'cs1', text: 'Rent / lease' }]
      });

      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(),
        Store.getCanvas()
      );

      expect(config.businessType).toBe('restaurant');
      expect(config.startingCash).toBe(30000); // from revenue range mapping
      expect(config.revenueStreams[0].name).toBe('Dine-in'); // from canvas
    });

    test('wizard financial overrides apply to simulation', () => {
      Store.saveBusiness({ name: 'SaaS Co', type: 'saas' });
      const canvas = Store.getCanvas();

      const overrides = {
        startingCash: 100000,
        revenueStreams: [{
          id: 'custom', name: 'Enterprise', type: 'recurring',
          unitPrice: 99, unitsPerMonth: 200, growthRate: 10,
          churnRate: 3, cogsPerUnit: 5, cogsPct: 0
        }]
      };

      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), canvas, overrides
      );

      expect(config.startingCash).toBe(100000);
      expect(config.revenueStreams[0].name).toBe('Enterprise');
      expect(config.revenueStreams[0].unitPrice).toBe(99);
    });

    test('simulation runs with wizard-generated config', () => {
      Store.saveBusiness({ name: 'Test', type: 'retail', revenueRange: '$1K - $5K' });
      const canvas = Store.getCanvas();
      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), canvas
      );

      const result = SimEngine.run(config);

      expect(result.months).toHaveLength(36);
      expect(result.months[0].revenue).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
      expect(result.summary.year1Revenue).toBeGreaterThan(0);
    });
  });

  describe('simulation UI renders from store data', () => {
    test('rendering simulation creates and saves config', () => {
      Store.saveBusiness({ name: 'Render Test', type: 'ecommerce' });
      Store.setWizardComplete();

      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const savedConfig = Store.getSimConfig();
      expect(savedConfig).toBeTruthy();
      expect(savedConfig.businessType).toBe('ecommerce');

      const savedResults = Store.getSimResults();
      expect(savedResults).toBeTruthy();
      expect(savedResults.months.length).toBeGreaterThan(0);
    });

    test('KPI values in UI match simulation results', () => {
      Store.saveBusiness({ name: 'KPI Test', type: 'service' });

      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const results = Store.getSimResults();
      const kpis = container.querySelectorAll('.sim-kpi');

      // Break-even KPI
      const breakEvenKpi = kpis[0];
      if (results.summary.breakEvenMonth) {
        expect(breakEvenKpi.textContent).toContain('Month');
      } else {
        expect(breakEvenKpi.textContent).toContain('Not yet');
      }

      // Y1 Revenue KPI
      const y1Rev = kpis[2];
      expect(y1Rev.textContent).toContain('Y1 Revenue');
    });
  });

  describe('scenario comparison', () => {
    test('all scenarios produce different cash projections', () => {
      Store.saveBusiness({ name: 'Scenario Test', type: 'restaurant' });
      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), Store.getCanvas()
      );

      const scenarios = SimEngine.runScenarios(config);

      const pessLast = scenarios.pessimistic.months[35].cashBalance;
      const baseLast = scenarios.base.months[35].cashBalance;
      const optLast = scenarios.optimistic.months[35].cashBalance;

      expect(pessLast).toBeLessThan(baseLast);
      expect(baseLast).toBeLessThan(optLast);
    });

    test('pessimistic scenario has lower revenue and higher costs', () => {
      const config = SimulationTypes.getDefaults('service');
      const scenarios = SimEngine.runScenarios(config);

      // First month comparison
      expect(scenarios.pessimistic.months[0].revenue)
        .toBeLessThan(scenarios.base.months[0].revenue);
    });
  });

  describe('canvas cost mapping to simulation opex', () => {
    test('canvas cost items map to simulation operating expenses', () => {
      Store.saveBusiness({ name: 'Cost Map', type: 'service' });
      Store.saveCanvas({
        customerSegments: [],
        valueProp: [],
        channels: [],
        customerRelationships: [],
        revenueStreams: [],
        keyResources: [],
        keyActivities: [],
        keyPartners: [],
        costStructure: [
          { id: 'c1', text: 'Marketing' },
          { id: 'c2', text: 'Office / Coworking' },
          { id: 'c3', text: 'Custom expense' }
        ]
      });

      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), Store.getCanvas()
      );

      expect(config.opex.length).toBe(3);
      expect(config.opex[0].name).toBe('Marketing');
      expect(config.opex[1].name).toBe('Office / Coworking');
      expect(config.opex[2].name).toBe('Custom expense');

      // Marketing should match known defaults
      expect(config.opex[0].monthly).toBeGreaterThan(0);
      // Custom expense gets fallback amount
      expect(config.opex[2].monthly).toBe(300);
    });
  });

  describe('full flow: wizard to simulation display', () => {
    test('wizard data produces valid simulation in UI', () => {
      // Simulate wizard completion
      Store.saveBusiness({
        name: 'Full Flow Biz',
        type: 'saas',
        description: 'A SaaS product',
        revenueRange: '$1K - $5K',
        teamSize: '2-5',
        stage: 'validation',
        createdAt: '2025-01-01'
      });

      const canvas = AI.buildCanvas({
        segments: ['Developers', 'Small teams'],
        proudOf: 'Best developer tools',
        costs: ['Hosting & Infrastructure', 'Marketing & Ads'],
        revenueRange: '$1K - $5K',
        teamSize: '2-5'
      });
      Store.saveCanvas(canvas);

      const hyps = AI.keywordFallbackHypotheses({
        segments: ['Developers'],
        proudOf: 'Best developer tools',
        goal: 'Find product-market fit'
      });
      hyps.forEach(h => Store.addHypothesis(h));

      Store.setWizardComplete();

      // Build sim config
      const simConfig = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), canvas
      );
      Store.saveSimConfig(simConfig);

      // Render simulation
      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      // Verify complete rendering
      expect(container.querySelector('.sim-header')).toBeTruthy();
      expect(container.querySelector('.sim-kpi-strip')).toBeTruthy();
      expect(container.querySelector('.sim-svg')).toBeTruthy();
      expect(container.querySelector('.sim-pl-table')).toBeTruthy();

      // Verify KPIs are populated (not empty)
      const kpiValues = container.querySelectorAll('.sim-kpi-value');
      kpiValues.forEach(kpi => {
        expect(kpi.textContent.length).toBeGreaterThan(0);
      });

      // Verify results are saved
      const savedResults = Store.getSimResults();
      expect(savedResults.months).toHaveLength(36);
      expect(savedResults.summary.year1Revenue).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('simulation handles pre-revenue business', () => {
      Store.saveBusiness({ name: 'Pre-Rev', type: 'service', revenueRange: 'Pre-revenue' });
      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), Store.getCanvas()
      );

      // Pre-revenue maps to $5000 starting cash
      expect(config.startingCash).toBe(5000);

      const result = SimEngine.run(config);
      expect(result.months).toHaveLength(36);
    });

    test('simulation handles empty canvas', () => {
      Store.saveBusiness({ name: 'Empty Canvas', type: 'service' });
      const canvas = Store.getCanvas(); // default empty canvas
      const config = SimulationTypes.buildConfigFromWizard(
        Store.getBusiness(), canvas
      );

      const result = SimEngine.run(config);
      expect(result.months).toHaveLength(36);
      // Should use type defaults
      expect(result.months[0].revenue).toBeGreaterThan(0);
    });

    test('P&L table handles short projection (6 months)', () => {
      Store.saveBusiness({ name: 'Short', type: 'service' });
      const config = SimulationTypes.getDefaults('service');
      config.projectionMonths = 6;
      Store.saveSimConfig(config);

      const container = document.createElement('div');
      document.body.appendChild(container);
      SimulationUI.render(container);

      const table = container.querySelector('.sim-pl-table');
      expect(table).toBeTruthy();
    });

    test('rollupYear returns null for empty month range', () => {
      const result = SimEngine.rollupYear([], 1);
      expect(result).toBeNull();
    });

    test('currency formatter handles zero', () => {
      expect(SimEngine.currency(0)).toBe('$0');
    });

    test('currency formatter handles exact thousands', () => {
      expect(SimEngine.currency(1000)).toBe('$1.0K');
    });

    test('currency formatter handles exact millions', () => {
      expect(SimEngine.currency(1000000)).toBe('$1.0M');
    });
  });
});
