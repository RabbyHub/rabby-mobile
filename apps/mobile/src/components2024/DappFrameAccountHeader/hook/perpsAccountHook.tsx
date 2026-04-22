import React, { useCallback, useMemo } from 'react';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { Account } from '@/core/services/preference';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useAccounts } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { appChainResourceStore } from '@/store/appchain';
import { formatUsdValue } from '@/utils/number';
import { View } from 'react-native';
import { getStyle } from '../styles';
import { Text } from '@/components/Typography';

const PERPS_LIST = INNER_DAPP_LIST.PERPS;
const DEFAULT_PERPS_ID = PERPS_LIST[0]?.id ?? 'hyperliquid';

const getOriginKey = (url?: string) => {
  if (!url) {
    return undefined;
  }
  const origin = safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  return origin ? origin.toLowerCase() : undefined;
};

export const usePerpsDappAccountExtraInfo = (dapp: string) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const activeItem = useMemo(
    () => PERPS_LIST.find(item => item.id === dapp) || PERPS_LIST[0],
    [dapp],
  );
  const perpsDappOrigin = useMemo(() => {
    if (activeItem?.id === DEFAULT_PERPS_ID) {
      return undefined;
    }
    if (!activeItem?.url) {
      return undefined;
    }
    return safeGetOrigin(activeItem.url) || activeItem.url;
  }, [activeItem?.id, activeItem?.url]);
  const trackedAddresses = useMemo(
    () => accounts.map(account => account.address),
    [accounts],
  );
  const appChainsByAddress =
    appChainResourceStore.useAddressesAppChains(trackedAddresses);

  const perpsAppChainByAddress = useMemo(() => {
    const originKey = getOriginKey(perpsDappOrigin);
    if (!originKey) {
      return undefined;
    }
    const map: Record<string, { balance: number; positions: number }> = {};
    Object.entries(appChainsByAddress).forEach(([address, list]) => {
      let balance = 0;
      let positions = 0;
      let hasMatch = false;
      list.forEach(item => {
        const itemOrigin = getOriginKey(item.site_url);
        if (!itemOrigin || itemOrigin !== originKey) {
          return;
        }
        hasMatch = true;
        balance += Number(item.netWorth || 0);
        const hyperliquidWithdrawable = `perp_withdrawable_usdc_hyperliquid_${address?.toLowerCase()}`;

        item.portfolio_item_list.reduce((pre, portfolioItem) => {
          if (activeItem?.id === 'hyperliquid') {
            if (portfolioItem.position_index === hyperliquidWithdrawable) {
              return pre + (portfolioItem?.stats?.net_usd_value || 0);
            }
            return pre;
          }
          if (portfolioItem.name === 'deposit') {
            return pre + portfolioItem.stats.net_usd_value;
          }
          return pre;
        }, 0);

        positions +=
          item.portfolio_item_list?.filter(e => e.name === 'Perpetuals')
            ?.length || 0;
      });
      if (hasMatch) {
        map[address] = { balance, positions };
      }
    });
    return map;
  }, [appChainsByAddress, perpsDappOrigin, activeItem?.id]);

  const renderPerpsDappRight = useCallback(
    ({ account }: { account: Account }) => {
      if (!perpsAppChainByAddress) {
        return null;
      }
      const key = account.address?.toLowerCase();
      if (!key) {
        return null;
      }
      const data = perpsAppChainByAddress[key];
      if (!data) {
        return null;
      }
      const hasBalance = data.balance > 0;
      const hasPositions = data.positions > 0;
      if (!hasBalance && !hasPositions) {
        return null;
      }
      return (
        <View style={styles.perpsDappRight}>
          {hasBalance ? (
            <Text style={styles.perpsDappBalance}>
              {formatUsdValue(data.balance)}
            </Text>
          ) : null}
          {hasPositions ? (
            <Text style={styles.perpsDappPositions}>
              {data.positions} {t('page.perpsDetail.PerpsPosition.title')}
            </Text>
          ) : null}
        </View>
      );
    },
    [perpsAppChainByAddress, styles, t],
  );

  const sortPerpsDappAccounts = useCallback(
    (accountList: Account[]) => {
      if (!perpsAppChainByAddress) {
        return accountList;
      }
      const list = [...accountList];
      list.sort((a, b) => {
        const aKey = a.address?.toLowerCase() || '';
        const bKey = b.address?.toLowerCase() || '';
        const aData = perpsAppChainByAddress[aKey] || {
          balance: 0,
          positions: 0,
        };
        const bData = perpsAppChainByAddress[bKey] || {
          balance: 0,
          positions: 0,
        };
        if (bData.positions !== aData.positions) {
          return bData.positions - aData.positions;
        }
        return bData.balance - aData.balance;
      });

      return list;
    },
    [perpsAppChainByAddress],
  );

  return {
    sortAccounts: sortPerpsDappAccounts,
    renderRight: renderPerpsDappRight,
  };
};
