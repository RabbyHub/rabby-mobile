import type { Account } from '@/core/startupServices/preference';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import { sortBy } from 'lodash';

export type PerpsAccountInfoByAddress = Record<
  string,
  ClearinghouseState | null
>;

export const buildPerpsAccountSelectorData = (
  accounts: Account[],
  infoByAddress?: PerpsAccountInfoByAddress,
) =>
  sortBy(
    accounts.map(account => ({
      account,
      info: infoByAddress?.[account.address.toLowerCase()] ?? null,
    })),
    item => -(item.info?.assetPositions?.length || 0),
    item => -Number(item.info?.withdrawable || 0),
  );
