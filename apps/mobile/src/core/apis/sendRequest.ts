import abiCoderInst, { AbiCoder } from 'web3-eth-abi';

import provider from '../controllers';
import { ProviderRequest } from '../controllers/type';
import { setGlobalTmpStore } from './globalProvider';

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

setGlobalTmpStore({ sendRequest });

export const abiCoder = abiCoderInst as unknown as AbiCoder;
