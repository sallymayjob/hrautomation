module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    'gas/Utils.gs',
    'gas/BlockKit.gs'
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 70
    }
  }
};
