import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  ComputedUserReserve,
  nativeToUSD,
  normalize,
  USD_DECIMALS,
} from '@aave/math-utils';
import BigNumber from 'bignumber.js';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../Home/utils/price';
import { formatPercent } from '../TokenDetail/util';
import { IWalletBalance } from './type';
import { formatAmount } from '@/utils/number';
import { PoolBaseCurrencyHumanized } from '@aave/contract-helpers';
import { formatNetworth } from '@/utils/math';

interface IProps {
  data: ComputedUserReserve[];
  mappedBalances: IWalletBalance[];
  baseCurrencyData?: PoolBaseCurrencyHumanized;
}
const SupplyPoolList = (props: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const sortReserves = useMemo(() => {
    return [...(props?.data || [])].sort((a, b) => {
      return Number(b.underlyingBalanceUSD) - Number(a.underlyingBalanceUSD);
    });
  }, [props.data]);

  const handlePressItem = item => {
    console.log('handlePressItem', item);
  };

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.listHeader}>
        <Text style={styles.headerToken}>Token</Text>
        <Text style={styles.headerApy}>APY</Text>
        <Text style={styles.headerMySupplies}>My Supplies</Text>
      </View>
    );
  }, [
    styles.headerApy,
    styles.headerMySupplies,
    styles.headerToken,
    styles.listHeader,
  ]);
  return (
    <Tabs.FlatList
      data={sortReserves}
      style={styles.container}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item, index }) => {
        const balance = props.mappedBalances.find(
          balance =>
            balance.address === item.reserve.underlyingAsset.toLowerCase(),
        );
        return (
          <TouchableOpacity
            style={styles.item}
            key={index}
            onPress={() => handlePressItem(item)}>
            <View style={styles.left}>
              <View style={styles.ava} />
              <View style={styles.symbolContainer}>
                <Text style={styles.symbol}>{item.reserve.symbol}</Text>
                <Text style={styles.tvl}>
                  TVL:{' '}
                  {formatUsdValueKMB(
                    Number(item.reserve.totalLiquidityUSD || '0'),
                  )}
                </Text>
              </View>
            </View>
            <Text style={styles.apy}>
              {formatPercent(Number(item.reserve.supplyAPY || '0'))}
            </Text>
            <View style={styles.right}>
              <Text style={styles.yourSupplied}>
                {formatUsdValueKMB(Number(item.underlyingBalanceUSD || '0'))}
              </Text>
              <Text style={styles.yourBalance}>
                {formatUsdValueKMB(
                  nativeToUSD({
                    amount: new BigNumber(balance?.amount || '0'),
                    currencyDecimals: item.reserve.decimals,
                    priceInMarketReferenceCurrency:
                      item.reserve.priceInMarketReferenceCurrency,
                    marketReferenceCurrencyDecimals:
                      props.baseCurrencyData?.marketReferenceCurrencyDecimals ||
                      0,
                    normalizedMarketReferencePriceInUsd: normalize(
                      props.baseCurrencyData
                        ?.marketReferenceCurrencyPriceInUsd || '0',
                      USD_DECIMALS,
                    ),
                  }),
                )}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
};

export default SupplyPoolList;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    flex: 1,
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginTop: 8,
  },
  ava: {
    width: 46,
    height: 46,
    borderRadius: 46,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apy: {
    flex: 0,
    width: 60,
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  right: {
    flex: 0,
    marginLeft: 10,
    width: 80,
    gap: 2,
  },
  symbolContainer: {
    gap: 2,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tvl: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  yourSupplied: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  yourBalance: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  listHeader: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 2,
  },
  headerToken: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    flex: 1,
  },
  headerApy: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    width: 60,
    flex: 0,
  },
  headerMySupplies: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
}));
