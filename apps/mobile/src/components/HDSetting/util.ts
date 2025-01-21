import { Account } from './type';
import { getTokenSettings } from '@/utils/getTokenSettings';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';

// cached chains, balance, firstTxTime
const cachedAccountInfo = new Map<string, Account>();

export const getAccountBalance = async (
  address: string,
  ignoreCached = false,
) => {
  if (cachedAccountInfo.has(address) && !ignoreCached) {
    const cached = cachedAccountInfo.get(address);
    if (cached) {
      return cached.balance;
    }
  }

  try {
    const tokenSetting = await getTokenSettings();
    const res = await batchBalanceWithLocalCache(
      {
        address,
        isCore: false,
        ...tokenSetting,
      },
      ignoreCached,
    );

    cachedAccountInfo.set(address, {
      address,
      balance: res.total_usd_value,
    });

    return res.total_usd_value;
  } catch (e) {
    console.error('ignore getTotalBalance error', e);
    return 0;
  }
};

export const fetchAccountsInfo = async (accounts: Account[]) => {
  return await Promise.all(
    accounts.map(async account => {
      let balance;
      const address = account.address?.toLowerCase();
      if (!address) {
        return account;
      }

      let needCache = true;

      if (cachedAccountInfo.has(address)) {
        const cached = cachedAccountInfo.get(address);
        if (cached) {
          return {
            ...account,
            balance: cached.balance,
          };
        }
      }

      try {
        // get balance from api
        const tokenSetting = await getTokenSettings();
        const res = await batchBalanceWithLocalCache({
          address: account.address,
          isCore: false,
          ...tokenSetting,
        });
        balance = res.total_usd_value;
      } catch (e) {
        console.error('ignore getTotalBalance error', e);
        needCache = false;
      }

      const accountInfo: Account = {
        ...account,
        balance,
      };

      if (needCache) {
        cachedAccountInfo.set(address, accountInfo);
      }

      return accountInfo;
    }),
  );
};
