import type { DappInfo } from '@/core/services/dappService';
import type { Account } from '@/core/startupServices/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const HYPERLIQUID_APP_ORIGIN = 'https://app.hyperliquid.xyz';

export const isHyperliquidAppUrl = (url?: string | null) =>
  !!url && safeGetOrigin(url) === HYPERLIQUID_APP_ORIGIN;

/**
 * Account to open Perps with from the Hyperliquid site. Only the account the
 * site is connected with counts, and only when the Perps account selector
 * could pick it too (no Safe; watch addresses only behind the experimental
 * switch). `undefined` keeps Perps on its own current / last used account.
 */
export const resolveHyperliquidPerpsAccount = ({
  dapp,
  accounts,
  enablePerpsWatchAddress,
}: {
  dapp?: Pick<DappInfo, 'isConnected' | 'currentAccount'> | null;
  accounts: Account[];
  enablePerpsWatchAddress: boolean;
}): Account | undefined => {
  const connected = dapp?.isConnected ? dapp.currentAccount : null;
  if (!connected?.address) {
    return undefined;
  }

  const account = accounts.find(
    item =>
      isSameAddress(item.address, connected.address) &&
      item.type === connected.type,
  );
  if (!account || account.type === KEYRING_CLASS.GNOSIS) {
    return undefined;
  }
  if (account.type === KEYRING_CLASS.WATCH && !enablePerpsWatchAddress) {
    return undefined;
  }
  return account;
};
