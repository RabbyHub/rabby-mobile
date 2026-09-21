import abiCoderInst, { AbiCoder } from 'web3-eth-abi';

import provider from '../controllers';
import type { ProviderRequest } from '../controllers/type';
import { setGlobalTmpStore } from './globalProvider';
import type { Account } from '@/types/account';

export function sendRequest<T = any>(
  {
    data,
    session,
    account,
    requestContext,
  }: {
    data: ProviderRequest['data'];
    session: ProviderRequest['session'];
    account: Account | null;
    requestContext?: ProviderRequest['requestContext'];
  },
  isBuild = false,
) {
  if (isBuild) {
    return Promise.resolve<T>(data as T);
  }
  return provider<T>({
    data,
    session,
    account,
    requestContext,
  });
}

export function dappSendRequest<T = any>(
  {
    data,
    session,
  }: {
    data: ProviderRequest['data'];
    session: ProviderRequest['session'];
  },
  isBuild = false,
) {
  if (isBuild) {
    return Promise.resolve<T>(data as T);
  }
  return provider<T>({
    data,
    session,
  });
}

setGlobalTmpStore({ sendRequest });

export const abiCoder = abiCoderInst as unknown as AbiCoder;
