import { createDeferred } from '@rabby-wallet/base-utils';
import { recordApprovalProbe } from '@/debug/approvalProbe';

import type { ProviderRequest } from './type';

export type ProviderExecutor = <T = void>(req: ProviderRequest) => Promise<T>;

let currentProviderExecutor: ProviderExecutor | null = null;
let providerExecutorDeferred = createDeferred<ProviderExecutor>();

export function registerProviderExecutor(
  providerExecutor: ProviderExecutor,
  options?: {
    source?: string;
  },
) {
  currentProviderExecutor = providerExecutor;
  providerExecutorDeferred.resolve(providerExecutor);
  recordApprovalProbe('PROVIDER_EXECUTOR_REGISTER', {
    source: options?.source || 'unknown',
  });
}

export async function getProviderExecutor(): Promise<ProviderExecutor> {
  if (currentProviderExecutor) {
    return currentProviderExecutor;
  }

  recordApprovalProbe('PROVIDER_EXECUTOR_GET_WAIT', {});
  return providerExecutorDeferred.promise.then(providerExecutor => {
    recordApprovalProbe('PROVIDER_EXECUTOR_GET_READY', {});
    return providerExecutor;
  });
}
