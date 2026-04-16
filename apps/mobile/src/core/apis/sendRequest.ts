import abiCoderInst, { AbiCoder } from 'web3-eth-abi';

import { getProviderExecutor } from '../controllers/providerExecutor';
import { ProviderRequest } from '../controllers/type';
import { Account } from '../services/preference';

export function sendRequest<T = any>(
  {
    data,
    session,
    account,
  }: {
    data: ProviderRequest['data'];
    session: ProviderRequest['session'];
    account: Account | null;
  },
  isBuild = false,
) {
  if (isBuild) {
    return Promise.resolve<T>(data as T);
  }
  return getProviderExecutor().then(provider =>
    provider<T>({
      data,
      session,
      account,
    }),
  );
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
  return getProviderExecutor().then(provider =>
    provider<T>({
      data,
      session,
    }),
  );
}

export const abiCoder = abiCoderInst as unknown as AbiCoder;
