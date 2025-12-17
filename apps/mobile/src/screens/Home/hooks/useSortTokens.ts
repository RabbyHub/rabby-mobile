import { useEffect, useState, useCallback, useMemo } from 'react';

import {
  TokenItem,
  TotalBalanceResponse,
} from '@rabby-wallet/rabby-api/dist/types';

import { apiBalance } from '@/core/apis';
import { AbstractPortfolioToken } from '../types';
import { Account } from '@/core/services/preference';

const sortByChainBalance = <T extends TokenItem | AbstractPortfolioToken>(
  list: T[],
  currentAddress?: Account['address'] | null,
) => {
  if (currentAddress) {
    const cache = apiBalance.getAddressCacheBalanceSync(currentAddress);
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

const useSortToken = <T extends TokenItem | AbstractPortfolioToken>(
  list: T[],
  account?: Account | null,
) => {
  const result = useMemo(() => {
    if (!list) return [];

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
      if (
        (a as AbstractPortfolioToken)._isExcludeBalance &&
        (b as AbstractPortfolioToken)._isExcludeBalance
      ) {
        return (b.credit_score || 0) - (a.credit_score || 0) || bWorth - aWorth;
      }
      if (
        (a as AbstractPortfolioToken)._isExcludeBalance &&
        !(b as AbstractPortfolioToken)._isExcludeBalance
      ) {
        return bWorth === 0 ? -1 : 1;
      }
      if (
        (b as AbstractPortfolioToken)._isExcludeBalance &&
        !(a as AbstractPortfolioToken)._isExcludeBalance
      ) {
        return aWorth === 0 ? 1 : -1;
      }
      return bWorth - aWorth;
    });

    return [
      ...hasUsdValue,
      ...hasAmount,
      ...sortByChainBalance(others, account?.address),
    ];
  }, [list, account?.address]);

  return result;
};

export default useSortToken;
