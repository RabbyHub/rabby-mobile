import { Account, IPinAddress } from '@/core/services/preference';
import { sortAccountsByBalance } from '@/utils/account';
import { addressUtils } from '@rabby-wallet/base-utils';

export function sortAccountList(
  accounts: Account[],
  {
    highlightedAddresses = [],
  }: {
    highlightedAddresses: IPinAddress[];
  },
) {
  const restAccounts = [...accounts];
  let highlightedAccounts: typeof accounts = [];

  highlightedAddresses.forEach(highlighted => {
    const idx = restAccounts.findIndex(
      account =>
        addressUtils.isSameAddress(account.address, highlighted.address) &&
        account.brandName === highlighted.brandName,
    );
    if (idx > -1) {
      highlightedAccounts.push(restAccounts[idx]);
      restAccounts.splice(idx, 1);
    }
  });
  highlightedAccounts = sortAccountsByBalance(highlightedAccounts);

  const normalAccounts = highlightedAccounts
    .concat(sortAccountsByBalance(restAccounts))
    .filter(e => !!e);

  return normalAccounts;
}
