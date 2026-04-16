import { createDeferred } from '@rabby-wallet/base-utils';

import type { ProviderRequest } from './type';

export type ProviderExecutor = <T = void>(req: ProviderRequest) => Promise<T>;

let currentProviderExecutor: ProviderExecutor | null = null;
let providerExecutorDeferred = createDeferred<ProviderExecutor>();

export function registerProviderExecutor(providerExecutor: ProviderExecutor) {
  currentProviderExecutor = providerExecutor;
  providerExecutorDeferred.resolve(providerExecutor);
}

export function getProviderExecutor(): Promise<ProviderExecutor> {
  if (currentProviderExecutor) {
    return Promise.resolve(currentProviderExecutor);
  }

  return providerExecutorDeferred.promise;
}
