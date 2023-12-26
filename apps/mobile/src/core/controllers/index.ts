import { ProviderRequest } from './type';

import { ethErrors } from 'eth-rpc-errors';
import { keyringService } from '../services';

import rpcFlow from './rpcFlow';
import internalMethod from './internalMethod';

const IGNORE_CHECK = ['wallet_importAddress'];

export default async <T = void>(req: ProviderRequest): Promise<T> => {
  const {
    data: { method },
  } = req;

  if (internalMethod[method]) {
    return internalMethod[method](req);
  }

  if (!IGNORE_CHECK.includes(method)) {
    const hasVault = keyringService.hasVault();
    if (!hasVault) {
      throw ethErrors.provider.userRejectedRequest({
        message: 'wallet must has at least one account',
      });
    }
  }

  return rpcFlow(req) as any;
};
