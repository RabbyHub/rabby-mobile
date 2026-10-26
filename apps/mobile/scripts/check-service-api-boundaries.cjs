#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const eslintBin = path.join(appRoot, 'node_modules/.bin/eslint');

const result = spawnSync(
  eslintBin,
  [
    './src',
    '--no-eslintrc',
    '--no-inline-config',
    '--rulesdir',
    './eslint-rules',
    '--parser',
    '@typescript-eslint/parser',
    '--parser-options',
    JSON.stringify({
      ecmaVersion: 2020,
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    }),
    '--rule',
    JSON.stringify({
      'no-runtime-service-imports': 'error',
      'no-floating-deferred-service-api-calls': 'error',
    }),
    '--ignore-pattern',
    '**/*.integration.test.*',
    '--ext',
    '.js,.jsx,.ts,.tsx',
  ],
  {
    cwd: appRoot,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
