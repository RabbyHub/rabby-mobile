import abiCoderInst, { AbiCoder } from 'web3-eth-abi';

import provider from '../controllers';
import { ProviderRequest } from '../controllers/type';

export function sendRequest<T = any>(
  data: ProviderRequest['data'],
  session: ProviderRequest['session'],
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

export const abiCoder = abiCoderInst as unknown as AbiCoder;
