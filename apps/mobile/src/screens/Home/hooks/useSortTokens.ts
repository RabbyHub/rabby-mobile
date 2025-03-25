import { useEffect, useState, useCallback, useMemo } from 'react';

import {
  TokenItem,
  TotalBalanceResponse,
} from '@rabby-wallet/rabby-api/dist/types';

import { apiBalance } from '@/core/apis';
import { useCurrentAccount } from '@/hooks/account';
import { AbstractPortfolioToken } from '../types';
import { devLog } from '@/utils/logger';

const useSortToken = <T extends TokenItem | AbstractPortfolioToken>(
  list?: T[],
) => {
  const { currentAccount } = useCurrentAccount();
  const [result, setResult] = useState<T[]>([]);

  const sortByChainBalance = async (list: T[]) => {
    if (currentAccount) {
      const cache = await apiBalance.getAddressCacheBalance(
        currentAccount.address,
      );
      if (cache) {
        list.sort((a, b) => {
          const chain1 = cache.chain_list.find(chain => chain.id === a.chain);
          const chain2 = cache.chain_list.find(chain => chain.id === b.chain);
          if (chain1 && chain2) {
            if (chain1.usd_value <= 0 && chain2.usd_value <= 0) {
              return (chain2.born_at || 0) - (chain1.born_at || 0);
            }
            return chain2.usd_value - chain1.usd_value;
          }
          return 0;
        });
      }
    }
    return list;
  };

  useEffect(() => {
    if (!list) return;
    const hasUsdValue: T[] = [];
    const hasAmount: T[] = [];
    const others: T[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const usdValue = item.price * item.amount;
      if (usdValue > 0) {
        hasUsdValue.push(item);
      } else if (item.amount > 0) {
        hasAmount.push(item);
      } else {
        others.push(item);
      }
    }
    hasUsdValue.sort((a, b) => {
      const aWorth = a.amount * a.price || 0;
      const bWorth = b.amount * b.price || 0;
      if (a._isExcludeBalance && b._isExcludeBalance) {
        return (b.credit_score || 0) - (a.credit_score || 0) || bWorth - aWorth;
      }
      if (a._isExcludeBalance && !b._isExcludeBalance) {
        return bWorth === 0 ? -1 : 1;
      }
      if (b._isExcludeBalance && !a._isExcludeBalance) {
        return aWorth === 0 ? 1 : -1;
      }
      return bWorth - aWorth;
    });
    sortByChainBalance(others).then(list => {
      setResult(
        [...hasUsdValue, ...hasAmount, ...list].sort((a, b) => {
          if (a._isPined && b._isPined) {
            const aWorth = a.amount * a.price || 0;
            const bWorth = b.amount * b.price || 0;
            return bWorth - aWorth;
          }
          if (a._isPined) {
            return -1;
          }
          if (b._isPined) {
            return 1;
          }
          return 0;
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  return result;
};

function sortTokenByChainBalance<T extends TokenItem | AbstractPortfolioToken>(
  list: T[],
  totalBalanceCache?: TotalBalanceResponse | null,
) {
  if (totalBalanceCache) {
    list.sort((a, b) => {
      const chain1 = totalBalanceCache.chain_list.find(
        chain => chain.id === a.chain,
      );
      const chain2 = totalBalanceCache.chain_list.find(
        chain => chain.id === b.chain,
      );
      if (chain1 && chain2) {
        if (chain1.usd_value <= 0 && chain2.usd_value <= 0) {
          return (chain2.born_at || 0) - (chain1.born_at || 0);
        }
        return chain2.usd_value - chain1.usd_value;
      }
      return 0;
    });
  }

  return list;
}

export default useSortToken;

export function useSortTokenPure<T extends TokenItem | AbstractPortfolioToken>(
  list?: T[],
) {
  const { currentAccount } = useCurrentAccount();
  // const [, setSpinner] = useState(false);
  const [balanceCache, setBalanceCache] = useState<TotalBalanceResponse | null>(
    null,
  );

  const triggerResort = useCallback(async () => {
    if (currentAccount) {
      try {
        const cache = await apiBalance.getAddressCacheBalance(
          currentAccount.address,
        );
        setBalanceCache(cache);
      } catch (error) {
        // setSpinner(prev => !prev);
        devLog('useSortTokenPure::getAddressCacheBalance error', error);
      }
    }
  }, [currentAccount]);

  const sortedList = useMemo(() => {
    if (!list || !currentAccount) return list || [];
    const hasUsdValue: T[] = [];
    const hasAmount: T[] = [];
    const others: T[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const usdValue = item.price * item.amount;
      if (usdValue > 0) {
        hasUsdValue.push(item);
      } else if (item.amount > 0) {
        hasAmount.push(item);
      } else {
        others.push(item);
      }
    }
    hasUsdValue.sort((a, b) => {
      return b.amount * b.price - a.amount * a.price;
    });

    const sortedOthers = sortTokenByChainBalance(others, balanceCache);
    return [...hasUsdValue, ...hasAmount, ...sortedOthers].sort((a, b) => {
      if (a.isPined && b.isPined) {
        return a.pinIndex! - b.pinIndex!;
      }
      if (a.isPined) {
        return -1;
      }
      if (b.isPined) {
        return 1;
      }
      return 0;
    });
  }, [list, currentAccount, balanceCache]);

  useEffect(() => {
    triggerResort();
  }, [triggerResort]);

  return {
    sortedList,
    triggerResort,
  };
}
