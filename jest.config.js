/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Root directories
  roots: ['<rootDir>/src', '<rootDir>/netlify', '<rootDir>/tests'],
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@functions/(.*)$': '<rootDir>/netlify/functions/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/**/__tests__/**/*.(ts|js)',
    '<rootDir>/**/?(*.)(test|spec).(ts|js)',
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/.netlify/',
  ],
  
  // Module ignore patterns
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/.netlify/',
  ],
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'netlify/functions/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
    },
  },
  
  // Timeout settings
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks
  clearMocks: true,
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch mode
  watchman: true,
  
  // Notification
  notify: false,
  notifyMode: 'failure-change',
  
  // Snapshot settings
  updateSnapshot: false,
  
  // Bail settings
  bail: false,
  
  // Maximum worker processes
  maxWorkers: '50%',
  
  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
};