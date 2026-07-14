import { ProviderRequest } from './type';

import { ethErrors } from 'eth-rpc-errors';
import { getDappSnapshot } from '@/core/serviceApi/dapp';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';

import rpcFlow from './rpcFlow';
import internalMethod from './internalMethod';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import type { Account } from '@/types/account';

const IGNORE_CHECK = ['wallet_importAddress'];

export default async function provider<T = void>(
  req: ProviderRequest,
): Promise<T> {
  const {
    data: { method },
  } = req;

  const origin = req.session?.origin || req.origin;
  const isWalletConnectRequest =
    req.requestContext?.source === 'walletconnect' ||
    req.session?.$mobileCtx?.isFromWalletConnect;
  let account: Account | undefined = undefined;

  if (isWalletConnectRequest) {
    account = req.account || undefined;
  } else if (origin) {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      account = req.account || getFallbackAccountSnapshot() || undefined;
    } else {
      const site = getDappSnapshot(origin);
      if (site?.isConnected) {
        account =
          site.currentAccount || getFallbackAccountSnapshot() || undefined;
      }
    }
  }

  req.account = account;

  if (internalMethod[method]) {
    return internalMethod[method](req);
  }

  if (!IGNORE_CHECK.includes(method)) {
    const hasVault = await keyringServiceApi.hasVault();
    if (!hasVault) {
      throw ethErrors.provider.userRejectedRequest({
        message: 'wallet must has at least one account',
      });
    }
  }

  return rpcFlow(req) as any;
}
