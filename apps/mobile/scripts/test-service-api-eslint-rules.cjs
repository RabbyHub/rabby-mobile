#!/usr/bin/env node

const assert = require('assert');
const { Linter } = require('eslint');
const typescriptParser = require('@typescript-eslint/parser');
const noFloatingDeferredServiceApiCalls = require('../eslint-rules/no-floating-deferred-service-api-calls');
const noPersistStoreDirectMutation = require('../eslint-rules/no-persist-store-direct-mutation');
const noDirectNativeTokenChainSync = require('../eslint-rules/no-direct-native-token-chain-sync');

const linter = new Linter();
linter.defineRule(
  'no-floating-deferred-service-api-calls',
  noFloatingDeferredServiceApiCalls,
);
linter.defineRule(
  'no-persist-store-direct-mutation',
  noPersistStoreDirectMutation,
);
linter.defineRule(
  'no-direct-native-token-chain-sync',
  noDirectNativeTokenChainSync,
);
linter.defineParser('@typescript-eslint/parser', typescriptParser);

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
  `
    import { dappServiceApi } from '@/core/serviceApi/dapp';
    async function run() { await dappServiceApi.unknownSemanticMethod(); }
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

const unclassifiedMessages = verify(invalidCases[invalidCases.length - 1]);
assert.strictEqual(unclassifiedMessages[0].messageId, 'unclassifiedMethod');

const persistStoreConfig = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-persist-store-direct-mutation': 'error',
  },
};

function verifyPersistStore(source) {
  return linter.verify(source, persistStoreConfig, 'fixture.ts');
}

const validPersistStoreCases = [
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      read() { return this.store.value; }
      write() { this.mutateStore(draft => { draft.value = 1; }); }
    }
  `,
  `
    import type { StorageSnapshot } from '@rabby-wallet/persist-store';
    class UnrelatedService {
      store = { value: 0 };
      write() { this.store.value = 1; }
    }
  `,
  `
    service.store.value;
  `,
];

const invalidPersistStoreCases = [
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      write() { this.store.value = 1; }
    }
  `,
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      write() { this.store.nested.value = 1; }
    }
  `,
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      write() { this.store.items.push('item'); }
    }
  `,
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      write() { delete this.store.value; }
    }
  `,
  `
    import { StoreServiceBase } from '@rabby-wallet/persist-store';
    class Service extends StoreServiceBase {
      write() { this.store.count++; }
    }
  `,
  `
    (service.store as any).value = 1;
  `,
  `
    const snapshot = service.store as unknown as { value: number };
  `,
];

validPersistStoreCases.forEach((source, index) => {
  assert.deepStrictEqual(
    verifyPersistStore(source),
    [],
    `expected valid persist-store case ${index + 1} to pass`,
  );
});

invalidPersistStoreCases.forEach((source, index) => {
  const messages = verifyPersistStore(source);
  assert.strictEqual(
    messages.length,
    1,
    `expected invalid persist-store case ${index + 1} to report once`,
  );
  assert.strictEqual(messages[0].ruleId, 'no-persist-store-direct-mutation');
});

const nativeTokenSyncConfig = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-direct-native-token-chain-sync': 'error',
  },
};

const nativeTokenSyncSource = `
  import NativeHelpers from '@/core/native/RNHelpers';
  NativeHelpers.syncNativeTokenChains('0xabc', ['eth'], 'address', true);
`;

assert.deepStrictEqual(
  linter.verify(
    nativeTokenSyncSource,
    nativeTokenSyncConfig,
    '/workspace/src/store/tokenChainSyncExecutor.ts',
  ),
  [],
  'expected the central token-chain executor to access the native bridge',
);

const directNativeSyncMessages = linter.verify(
  nativeTokenSyncSource,
  nativeTokenSyncConfig,
  '/workspace/src/store/tokens.ts',
);
assert.strictEqual(directNativeSyncMessages.length, 1);
assert.strictEqual(
  directNativeSyncMessages[0].ruleId,
  'no-direct-native-token-chain-sync',
);

console.log('service API ESLint rule tests passed');
