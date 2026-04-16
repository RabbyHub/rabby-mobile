import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useAccounts } from './account';
import { useWhitelist } from './whitelist';
import { useEffect, useMemo } from 'react';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import PQueue from 'p-queue';
import { getCexWithLocalCache } from '@/databases/hooks/cex';

const queue = new PQueue({ intervalCap: 10, concurrency: 7, interval: 1000 });

export const useFetchCexInfo = () => {
  const { accounts } = useAccounts();
  const { whitelist } = useWhitelist();

  const pendingFetchCexAddresses = useMemo(() => {
    const watchAccounts = accounts.filter(
      account => account.type === KEYRING_CLASS.WATCH,
    );
    const otherAccounts = accounts.filter(
      account => account.type !== KEYRING_CLASS.WATCH,
    );
    const pendingWhitelistAddresses = whitelist.filter(
      item => !otherAccounts.some(acc => isSameAddress(acc.address, item)),
    );
    const pendingWatchAddresses = watchAccounts
      .filter(
        item =>
          !pendingWhitelistAddresses.some(acc =>
            isSameAddress(acc, item.address),
          ),
      )
      .map(item => item.address);
    return [...pendingWatchAddresses, ...pendingWhitelistAddresses];
  }, [accounts, whitelist]);

  useEffect(() => {
    if (queue.size > 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      pendingFetchCexAddresses.forEach(address => {
        queue.add(async () => {
          try {
            await getCexWithLocalCache(address, false);
          } catch (error) {
            console.error('cex desc fetch error', error);
          }
        });
      });
    }, 100); // 100ms 防抖

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFetchCexAddresses.join(',')]);
};
