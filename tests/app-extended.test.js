const { loadModules, resetLocalStorage, setupDOM } = require('./setup');

beforeAll(() => {
  loadModules(['store', 'ai', 'prompts', 'simulationTypes', 'simulation', 'simulationUI', 'canvas', 'tracker', 'wizard', 'app']);
});

beforeEach(() => {
  resetLocalStorage();
  setupDOM();
});

describe('App simulation route', () => {
  test('renders simulation page when hash is #simulation', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test Biz', type: 'service' });
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
    expect(app.querySelector('.sim-kpi-strip')).toBeTruthy();
  });

  test('simulation is default route when wizard is complete', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test Biz', type: 'service' });
    window.location.hash = '';
    App.render();

    const app = document.getElementById('app');
    expect(app.querySelector('.sim-header')).toBeTruthy();
  });

  test('nav shows Projection link when wizard complete', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test' });
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    const links = Array.from(app.querySelectorAll('.nav-link'));
    const projectionLink = links.find(l => l.textContent === 'Projection');
    expect(projectionLink).toBeTruthy();
    expect(projectionLink.classList.contains('active')).toBe(true);
  });

  test('Projection link is not active when on different page', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test' });
    window.location.hash = '#tracker';
    App.render();

    const app = document.getElementById('app');
    const links = Array.from(app.querySelectorAll('.nav-link'));
    const projectionLink = links.find(l => l.textContent === 'Projection');
    expect(projectionLink).toBeTruthy();
    expect(projectionLink.classList.contains('active')).toBe(false);

    const trackerLink = links.find(l => l.textContent === 'Tracker');
    expect(trackerLink.classList.contains('active')).toBe(true);
  });
});

describe('App nav ordering', () => {
  test('nav links appear in correct order', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Nav Test' });
    window.location.hash = '#simulation';
    App.render();

    const app = document.getElementById('app');
    const links = Array.from(app.querySelectorAll('.nav-link')).map(l => l.textContent);
    expect(links).toEqual(['Projection', 'Tracker', 'Canvas', 'Settings']);
  });
});

describe('App settings data section', () => {
  test('export button exists on settings page', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Settings Test', type: 'service', description: 'test', createdAt: '2025-01-01' });
    window.location.hash = '#settings';
    App.render();

    expect(document.getElementById('btn-export')).toBeTruthy();
    expect(document.getElementById('btn-import')).toBeTruthy();
  });

  test('reset button exists on settings page', () => {
    Store.setWizardComplete();
    Store.saveBusiness({ name: 'Test', type: 'service', description: 'test', createdAt: '2025-01-01' });
    window.location.hash = '#settings';
    App.render();

    expect(document.getElementById('btn-reset')).toBeTruthy();
  });
});
