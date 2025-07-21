import { ProviderRequest } from './type';

import { ethErrors } from 'eth-rpc-errors';
import { dappService, keyringService, preferenceService } from '../services';

import rpcFlow from './rpcFlow';
import internalMethod from './internalMethod';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { Account } from '../services/preference';

const IGNORE_CHECK = ['wallet_importAddress'];

export default async function provider<T = void>(
  req: ProviderRequest,
): Promise<T> {
  const {
    data: { method },
  } = req;

  const origin = req.session?.origin || req.origin;
  let account: Account | undefined = undefined;

  if (origin) {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      account =
        req.account || preferenceService.getFallbackAccount() || undefined;
    } else {
      const site = dappService.getDapp(origin);
      if (site?.isConnected) {
        account =
          site.currentAccount ||
          preferenceService.getFallbackAccount() ||
          undefined;
      }
    }
  }

  req.account = account;

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
}
