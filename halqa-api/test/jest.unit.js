module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/test/unit', '<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.test.json' } },
  testTimeout: 30000,
};
