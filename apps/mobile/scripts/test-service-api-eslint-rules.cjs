#!/usr/bin/env node

const assert = require('assert');
const { Linter } = require('eslint');
const noFloatingDeferredServiceApiCalls = require('../eslint-rules/no-floating-deferred-service-api-calls');

const linter = new Linter();
linter.defineRule(
  'no-floating-deferred-service-api-calls',
  noFloatingDeferredServiceApiCalls,
);

const config = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-floating-deferred-service-api-calls': 'error',
  },
};

function verify(source) {
  return linter.verify(source, config, 'fixture.js');
}

const validCases = [
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    async function run() { await dappServiceApi.getDapp('origin'); }
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    function run() { return dappServiceApi.getDapp('origin'); }
  `,
  `
    import { dappServiceApi as api } from '@/core/serviceApi/dapp';
    void api.getDapp('origin').catch(console.error);
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    dappServiceApi.getDapp('origin').then(useDapp, reportError);
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    async function run() {
      await Promise.all([dappServiceApi.getDapp('origin')]);
    }
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    void Promise.allSettled([dappServiceApi.getDapp('origin')]);
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    const run = () => dappServiceApi.getDapp('origin');
  `,
  `
    import { miscServiceApi } from '@/core/serviceApi/misc';
    miscServiceApi.setCurrentGasLevel('normal');
  `,
];

const invalidCases = [
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    dappServiceApi.getDapp('origin');
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    void dappServiceApi.getDapp('origin');
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    dappServiceApi.getDapp('origin').then(useDapp);
  `,
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    void Promise.all([dappServiceApi.getDapp('origin')]);
  `,
];

validCases.forEach((source, index) => {
  assert.deepStrictEqual(
    verify(source),
    [],
    `expected valid case ${index + 1} to pass`,
  );
});

invalidCases.forEach((source, index) => {
  const messages = verify(source);
  assert.strictEqual(
    messages.length,
    1,
    `expected invalid case ${index + 1} to report once`,
  );
  assert.strictEqual(
    messages[0].ruleId,
    'no-floating-deferred-service-api-calls',
  );
});

console.log('service API ESLint rule tests passed');
