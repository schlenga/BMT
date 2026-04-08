const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'simulationTypes', 'simulation', 'simulationUI']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
  Store.saveBusiness({ name: 'UI Test', type: 'service' });
});

// Helper: render simulation and ensure edit mode is open
function renderWithEditPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  SimulationUI.render(container);
  // Toggle edit until edit panel is visible
  if (!container.querySelector('.sim-edit-panel')) {
    container.querySelector('#sim-toggle-edit').click();
  }
  return container;
}

// Helper: render simulation without edit panel
function renderDefault() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  SimulationUI.render(container);
  // Ensure edit panel is closed
  if (container.querySelector('.sim-edit-panel')) {
    container.querySelector('#sim-toggle-edit').click();
  }
  return container;
}

describe('SimulationUI — edit panel and interactions', () => {
  describe('scenario toggle', () => {
    test('clicking scenario tab re-renders with that scenario', () => {
      const container = renderDefault();
      container.querySelector('[data-scenario="pessimistic"]').click();
      const active = container.querySelector('.sim-sc.active');
      expect(active.textContent).toBe('Pessimistic');
    });

    test('clicking optimistic shows optimistic scenario', () => {
      const container = renderDefault();
      container.querySelector('[data-scenario="optimistic"]').click();
      const active = container.querySelector('.sim-sc.active');
      expect(active.textContent).toBe('Optimistic');
    });
  });

  describe('edit mode', () => {
    test('edit button toggles edit panel visibility', () => {
      const container = renderDefault();
      // Should start without edit panel
      expect(container.querySelector('.sim-edit-panel')).toBeNull();

      // Click edit
      container.querySelector('#sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeTruthy();

      // Click again to close
      container.querySelector('#sim-toggle-edit').click();
      expect(container.querySelector('.sim-edit-panel')).toBeNull();
    });

    test('edit panel contains starting cash slider', () => {
      const container = renderWithEditPanel();
      const cashSlider = container.querySelector('[data-key="startingCash"]');
      expect(cashSlider).toBeTruthy();
    });

    test('edit panel contains projection months slider', () => {
      const container = renderWithEditPanel();
      const monthsSlider = container.querySelector('[data-key="projectionMonths"]');
      expect(monthsSlider).toBeTruthy();
    });

    test('edit panel shows revenue stream sliders', () => {
      const container = renderWithEditPanel();
      expect(container.querySelector('[data-key="rs_price_0"]')).toBeTruthy();
      expect(container.querySelector('[data-key="rs_volume_0"]')).toBeTruthy();
      expect(container.querySelector('[data-key="rs_growth_0"]')).toBeTruthy();
    });

    test('edit panel shows staff sliders', () => {
      const container = renderWithEditPanel();
      expect(container.querySelector('[data-key="staff_count_0"]')).toBeTruthy();
      expect(container.querySelector('[data-key="staff_cost_0"]')).toBeTruthy();
    });

    test('edit panel shows opex sliders', () => {
      const container = renderWithEditPanel();
      expect(container.querySelector('[data-key="opex_0"]')).toBeTruthy();
    });
  });

  describe('slider interactions', () => {
    test('slider input updates display value', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="startingCash"]');
      slider.value = '25000';
      slider.dispatchEvent(new Event('input'));
      const valDisplay = slider.parentElement.querySelector('.sim-slider-val');
      expect(valDisplay.textContent).toContain('25,000');
    });

    test('slider change saves config and re-renders', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="startingCash"]');
      slider.value = '75000';
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change'));
      const config = Store.getSimConfig();
      expect(config.startingCash).toBe(75000);
    });

    test('revenue stream price slider updates config', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="rs_price_0"]');
      slider.value = '150';
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change'));
      const config = Store.getSimConfig();
      expect(config.revenueStreams[0].unitPrice).toBe(150);
    });

    test('staff count slider updates config', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="staff_count_0"]');
      slider.value = '5';
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change'));
      const config = Store.getSimConfig();
      expect(config.staff[0].count).toBe(5);
    });

    test('opex slider updates config', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="opex_0"]');
      slider.value = '800';
      slider.dispatchEvent(new Event('input'));
      slider.dispatchEvent(new Event('change'));
      const config = Store.getSimConfig();
      expect(config.opex[0].monthly).toBe(800);
    });

    test('growth rate slider shows percentage display', () => {
      const container = renderWithEditPanel();
      const slider = container.querySelector('[data-key="rs_growth_0"]');
      slider.value = '7';
      slider.dispatchEvent(new Event('input'));
      const valDisplay = slider.parentElement.querySelector('.sim-slider-val');
      expect(valDisplay.textContent).toContain('7%');
    });
  });

  describe('KPI cards', () => {
    test('renders 6 KPI cards', () => {
      const container = renderDefault();
      expect(container.querySelectorAll('.sim-kpi')).toHaveLength(6);
    });

    test('renders break-even and funding needed KPIs', () => {
      const container = renderDefault();
      const kpis = container.querySelectorAll('.sim-kpi');
      const kpiLabels = Array.from(kpis).map(k => k.querySelector('.sim-kpi-label').textContent);
      expect(kpiLabels).toContain('Break-even');
      expect(kpiLabels).toContain('Funding Needed');
      expect(kpiLabels).toContain('Y1 Revenue');
      expect(kpiLabels).toContain('Y3 Cash');
      expect(kpiLabels).toContain('Gross Margin');
      expect(kpiLabels).toContain('Final Monthly');
    });
  });

  describe('chart rendering', () => {
    test('renders at least 2 SVG charts', () => {
      const container = renderDefault();
      const svgs = container.querySelectorAll('.sim-svg');
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });

    test('renders at least 3 sections', () => {
      const container = renderDefault();
      const sections = container.querySelectorAll('.sim-section');
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('P&L table', () => {
    test('renders P&L table with quarterly headers', () => {
      const container = renderDefault();
      const table = container.querySelector('.sim-pl-table');
      expect(table).toBeTruthy();
      const headers = table.querySelectorAll('th.sim-pl-yr');
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('revenue stream breakdown', () => {
    test('renders stream breakdown table', () => {
      const container = renderDefault();
      const tables = container.querySelectorAll('.sim-pl-table');
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('slider zero value (bug regression)', () => {
    test('slider renders value 0 correctly instead of using min', () => {
      // Set up config with 0 growth rate
      const config = SimulationTypes.getDefaults('service');
      config.revenueStreams[0].growthRate = 0;
      Store.saveSimConfig(config);

      const container = renderWithEditPanel();
      const growthSlider = container.querySelector('[data-key="rs_growth_0"]');
      expect(growthSlider.value).toBe('0');
    });
  });

  describe('different business types render correctly', () => {
    const types = ['restaurant', 'retail', 'saas', 'ecommerce', 'subscription'];

    types.forEach(type => {
      test(`${type} type renders without errors`, () => {
        Store.saveBusiness({ name: `${type} biz`, type: type });
        // Clear sim config to force rebuild
        localStorage.removeItem('bmt_sim_config');

        const container = renderDefault();
        expect(container.querySelector('.sim-header')).toBeTruthy();
      });
    });
  });
});
