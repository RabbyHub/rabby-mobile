import { addressUtils } from '@rabby-wallet/base-utils';
import { filterOutTopAccounts, getAccountList } from '../apis/account';
import { makeAvoidParallelAsyncFunc } from '../utils/concurrency';

export const getTopMyAccountsOnNotifications = makeAvoidParallelAsyncFunc(
  async ({ gatherSameAddress = false } = {}) => {
    const { sortedAccounts } = await getAccountList({
      filter: 'onlyMine',
    });

    const result = filterOutTopAccounts(sortedAccounts, {
      topCount: 100,
      gatherSameAddress,
    });

    return {
      top100Accounts: result.topAccounts,
      top100Addresses: result.topAddresses,
      top100Records: result.topRecords,
      restAccounts: result.restAccounts,
    };
  },
);

export async function findMyAccountByOwnerAddress(address: string) {
  if (!address) return null;

  return getTopMyAccountsOnNotifications({ gatherSameAddress: true }).then(
    ({ top100Accounts }) => {
      return (
        top100Accounts.find(acc =>
          addressUtils.isSameAddress(acc.address, address),
        ) || null
      );
    },
  );
}
