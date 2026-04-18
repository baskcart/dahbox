import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.integration.test.ts'],
  // Integration tests use real AWS credentials — load from .env.local
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { module: 'commonjs' },
    }],
  },
  testTimeout: 30000, // DynamoDB round-trips can take a few seconds
  verbose: true,
};

export default config;
