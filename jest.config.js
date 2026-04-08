module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'store.js',
    'ai.js',
    'prompts.js',
    'simulation.js',
    'simulation-types.js',
    'simulation-ui.js',
    'canvas.js',
    'tracker.js',
    'wizard.js',
    'app.js'
  ],
  // Note: Coverage metrics show 0% because IIFE modules are loaded via
  // new Function() in tests/setup.js, which bypasses Istanbul instrumentation.
  // Coverage reports are informational. Test completeness is enforced by the
  // test suite itself (387+ tests across all modules).
};
