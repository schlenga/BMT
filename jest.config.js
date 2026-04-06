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
  ]
};
