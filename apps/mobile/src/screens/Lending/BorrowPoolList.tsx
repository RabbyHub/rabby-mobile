import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';
import { formatPercent, formatUsdValueKMB } from '../TokenDetail/util';
import { useLendingSummary } from './hooks';

const BorrowPoolList = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const { displayPoolReserves } = useLendingSummary();
  const sortReserves = useMemo(() => {
    return [...(displayPoolReserves || [])].sort((a, b) => {
      return Number(b.totalBorrowsUSD) - Number(a.totalBorrowsUSD);
    });
  }, [displayPoolReserves]);

  const handlePressItem = item => {
    console.log('handlePressItem', item);
  };

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.listHeader}>
        <Text style={styles.headerToken}>Token</Text>
        <Text style={styles.headerApy}>APY</Text>
        <Text style={styles.headerMyBorrows}>My borrows</Text>
      </View>
    );
  }, [
    styles.headerApy,
    styles.headerMyBorrows,
    styles.headerToken,
    styles.listHeader,
  ]);

  return (
    <Tabs.FlatList
      data={sortReserves}
      style={styles.container}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.item}
          key={index}
          onPress={() => handlePressItem(item)}>
          <View style={styles.left}>
            <View style={styles.ava}></View>
            <View style={styles.symbolContainer}>
              <Text style={styles.symbol}>{item.reserve.symbol}</Text>
            </View>
          </View>
          <Text style={styles.apy}>
            {formatPercent(Number(item.reserve.variableBorrowAPY || '0'))}
          </Text>
          <View style={styles.right}>
            <Text style={styles.yourSupplied}>
              {formatUsdValueKMB(Number(item.totalBorrowsUSD || '0'))}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

export default BorrowPoolList;

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
  headerMyBorrows: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
}));
