module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.enum.ts',
    '!**/*.dto.ts',
    '!**/main.ts',
    '!**/*.module.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  cacheDirectory: './.jest-cache',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transformIgnorePatterns: ['node_modules/(?!(fireorm|@firebase)/)'],
};

