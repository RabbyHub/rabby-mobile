import { openapi } from '@/core/request';
import { Account } from './type';

// cached chains, balance, firstTxTime
const cachedAccountInfo = new Map<string, Account>();

export const getAccountBalance = async (address: string) => {
  if (cachedAccountInfo.has(address)) {
    const cached = cachedAccountInfo.get(address);
    if (cached) {
      return cached.balance;
    }
  }

  try {
    const res = await openapi.getTotalBalance(address);

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
        const res = await openapi.getTotalBalance(account.address);
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
