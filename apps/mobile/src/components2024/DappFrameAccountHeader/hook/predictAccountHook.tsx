import React, { useCallback, useMemo } from 'react';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { Account } from '@/core/services/preference';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useTheme2024 } from '@/hooks/theme';
import useAppChainStore from '@/store/appchain';
import { useShallow } from 'zustand/shallow';
import { formatUsdValue } from '@/utils/number';
import { Text, View } from 'react-native';
import { getStyle } from '../styles';

const PREDICTION_LIST = INNER_DAPP_LIST.PREDICTION;

const getOriginKey = (url?: string) => {
  if (!url) {
    return undefined;
  }
  const origin = safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  return origin ? origin.toLowerCase() : undefined;
};

export const usePredictDappAccountExtraInfo = (dapp: string) => {
  const { styles } = useTheme2024({ getStyle });
  const activeItem = useMemo(
    () => PREDICTION_LIST.find(item => item.id === dapp) || PREDICTION_LIST[0],
    [dapp],
  );
  const predictDappOrigin = useMemo(() => {
    if (!activeItem?.url) {
      return undefined;
    }
    return safeGetOrigin(activeItem.url) || activeItem.url;
  }, [activeItem?.url]);

  const appChainMap = useAppChainStore(useShallow(s => s.appChainMap));

  const predictAppChainByAddress = useMemo(() => {
    const originKey = getOriginKey(predictDappOrigin);
    if (!originKey) {
      return undefined;
    }
    const map: Record<string, { balance: number }> = {};
    Object.entries(appChainMap).forEach(([address, list]) => {
      let balance = 0;
      let hasMatch = false;
      list.forEach(item => {
        const itemOrigin = getOriginKey(item.site_url);

        if (!itemOrigin || itemOrigin !== originKey) {
          return;
        }
        hasMatch = true;
        balance += Number(item.netWorth || 0);
      });
      if (hasMatch) {
        map[address] = { balance };
      }
    });
    return map;
  }, [appChainMap, predictDappOrigin]);

  const renderPredictDappRight = useCallback(
    ({ account }: { account: Account }) => {
      if (!predictAppChainByAddress) {
        return null;
      }
      const key = account.address?.toLowerCase();
      if (!key) {
        return null;
      }
      const data = predictAppChainByAddress[key];
      if (!data) {
        return null;
      }
      const hasBalance = data.balance > 0;
      if (!hasBalance) {
        return null;
      }
      return (
        <View style={styles.perpsDappRight}>
          {hasBalance ? (
            <Text style={styles.perpsDappBalance}>
              {formatUsdValue(data.balance)}
            </Text>
          ) : null}
        </View>
      );
    },
    [predictAppChainByAddress, styles],
  );

  const sortPredictDappAccounts = useCallback(
    (accounts: Account[]) => {
      if (!predictAppChainByAddress) {
        return accounts;
      }
      const list = [...accounts];
      list.sort((a, b) => {
        const aKey = a.address?.toLowerCase() || '';
        const bKey = b.address?.toLowerCase() || '';
        const aData = predictAppChainByAddress[aKey] || {
          balance: 0,
          positions: 0,
        };
        const bData = predictAppChainByAddress[bKey] || {
          balance: 0,
          positions: 0,
        };
        return bData.balance - aData.balance;
      });

      return list;
    },
    [predictAppChainByAddress],
  );

  return {
    sortAccounts: sortPredictDappAccounts,
    renderRight: renderPredictDappRight,
  };
};
