import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../Home/utils/price';
import { formatPercent } from '../TokenDetail/util';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useLendingSummary } from './hooks';
import TokenIcon from './components/TokenIcon';
import { CHAINS_ENUM } from '@debank/common';

const SupplyPoolList = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { displayPoolReserves } = useLendingSummary();

  const sortReserves = useMemo(() => {
    return [...(displayPoolReserves || [])].sort((a, b) => {
      return Number(b.underlyingBalanceUSD) - Number(a.underlyingBalanceUSD);
    });
  }, [displayPoolReserves]);

  const handlePressItem = item => {
    createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SUPPLY_DETAIL,
      reserve: item,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-2']
            : colors2024['neutral-bg-1'],
        },
      },
    });
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
        return (
          <TouchableOpacity
            style={styles.item}
            key={index}
            onPress={() => handlePressItem(item)}>
            <View style={styles.left}>
              <TokenIcon
                tokenSymbol={item.reserve.symbol}
                chain={CHAINS_ENUM.ETH}
              />
              <View style={styles.symbolContainer}>
                <Text
                  style={styles.symbol}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.reserve.symbol}
                </Text>
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
                {formatUsdValueKMB(item.walletBalanceUSD || '0')}
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
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
