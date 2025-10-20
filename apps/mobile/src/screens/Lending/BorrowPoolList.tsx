import React, { useCallback, useMemo } from 'react';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatPercent, formatUsdValueKMB } from '../TokenDetail/util';
import { useLendingData, useLendingSummary } from './hooks';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import TokenIcon from './components/TokenIcon';
import { PoolListLoading } from './components/Loading';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const BorrowPoolList = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { displayPoolReserves, iUserSummary, loading } = useLendingSummary();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { fetchData } = useLendingData(currentAccount?.address);
  const sortReserves = useMemo(() => {
    return [...(displayPoolReserves || [])]
      .filter(item => {
        if (item.variableBorrows && item.variableBorrows !== '0') {
          return true;
        }
        if (BigNumber(item.reserve.totalDebt).gte(item.reserve.borrowCap)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        return Number(b.totalBorrowsUSD) - Number(a.totalBorrowsUSD);
      });
  }, [displayPoolReserves]);

  const handlePressItem = item => {
    createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.BORROW_DETAIL,
      reserve: item,
      userSummary: iUserSummary,
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
    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <View style={styles.listHeader}>
        <Text style={styles.headerToken}>Token</Text>
        <Text style={styles.headerApy}>APY</Text>
        <Text style={styles.headerMyBorrows}>My borrows</Text>
      </View>
    );
  }, [
    loading,
    styles.headerApy,
    styles.headerMyBorrows,
    styles.headerToken,
    styles.listHeader,
    styles.loading,
  ]);

  return (
    <Tabs.FlatList
      data={loading ? [] : sortReserves}
      style={styles.container}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={fetchData} />
      }
      ListEmptyComponent={<PoolListLoading />}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.item}
          key={index}
          onPress={() => handlePressItem(item)}>
          <View style={styles.left}>
            <TokenIcon size={46} tokenSymbol={item.reserve.symbol} />
            <View style={styles.symbolContainer}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {item.reserve.symbol}
              </Text>
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
  loading: {
    width: 124,
    marginTop: 16,
    backgroundColor: colors2024['neutral-bg-5'],
    marginBottom: 2,
    marginLeft: 8,
  },
}));
