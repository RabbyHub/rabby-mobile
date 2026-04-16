import { createDeferred } from '@rabby-wallet/base-utils';

import type { EthereumProvider } from './buildinProvider';

export type GlobalProviderRef = {
  currentProvider: EthereumProvider;
};

const providerRef = {
  current: null as GlobalProviderRef | null,
};

let providerDeferred = createDeferred<GlobalProviderRef>();
let hasResolvedProvider = false;

export function registerGlobalProvider(provider: GlobalProviderRef) {
  providerRef.current = provider;

  if (!hasResolvedProvider) {
    hasResolvedProvider = true;
    providerDeferred.resolve(provider);
  }
}

export function getGlobalProvider(): Promise<GlobalProviderRef> {
  if (providerRef.current) {
    return Promise.resolve(providerRef.current);
  }

  return providerDeferred.promise;
}
