module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/test/integration'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.test.json' } },
  testTimeout: 120000,
  maxWorkers: 1,
};
