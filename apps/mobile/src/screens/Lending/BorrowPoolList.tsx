import React, { useCallback, useMemo } from 'react';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../TokenDetail/util';
import {
  useFetchLendingData,
  useLendingIsLoading,
  useLendingISummary,
  useLendingRemoteData,
  useLendingSummary,
} from './hooks';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import TokenIcon from './components/TokenIcon';
import { PoolListLoading } from './components/Loading';
import { Skeleton } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { API_ETH_MOCK_ADDRESS } from '@aave/contract-helpers';
import { useTranslation } from 'react-i18next';
import WalletFillCC from '@/assets2024/icons/lending/wallet-fill-cc.svg';
import { formatApy, formatListNetWorth } from './utils/format';
import { assetCanBeBorrowedByUser } from './utils/borrow';
import { useRendererDetect } from '@/components/Perf/PerfDetector';

const ListHeaderComponent = React.memo(
  ({ sortReservesLen }: { sortReservesLen: number }) => {
    const { styles, colors2024, isLight } = useTheme2024({
      getStyle: getStyles,
    });

    const { t } = useTranslation();
    const { loading } = useLendingIsLoading();
    const { iUserSummary } = useLendingISummary();
    const isInIsolationMode = useMemo(() => {
      return iUserSummary?.isInIsolationMode;
    }, [iUserSummary?.isInIsolationMode]);

    useRendererDetect({ name: 'BorrowPoolList::ListHeaderComponent' });

    const desc = useMemo(() => {
      if (
        iUserSummary?.availableBorrowsUSD === '0' ||
        !iUserSummary?.availableBorrowsUSD
      ) {
        return t('page.Lending.availableCard.needSupply');
      }
      if (iUserSummary.userEmodeCategoryId !== 0) {
        if (!sortReservesLen) {
          return t('page.Lending.availableCard.emodeNoAssets');
        }
        return t('page.Lending.availableCard.emode');
      }
      if (isInIsolationMode) {
        return t('page.Lending.availableCard.isolated');
      }
      return t('page.Lending.availableCard.canBorrow');
    }, [
      iUserSummary?.availableBorrowsUSD,
      iUserSummary?.userEmodeCategoryId,
      isInIsolationMode,
      sortReservesLen,
      t,
    ]);

    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <>
        {!(loading || !iUserSummary?.totalLiquidityUSD) && (
          <View
            style={[
              styles.availableCard,
              isInIsolationMode && styles.availableCardIsolated,
            ]}>
            <View style={styles.availableCardHeader}>
              {(iUserSummary?.availableBorrowsUSD &&
                iUserSummary?.availableBorrowsUSD === '0') ||
              isInIsolationMode ? (
                <RcIconWarningCircleCC
                  width={14}
                  height={14}
                  color={
                    isInIsolationMode
                      ? colors2024['orange-default']
                      : colors2024['neutral-info']
                  }
                />
              ) : null}
              <Text
                style={[
                  styles.availableCardTitle,
                  (isInIsolationMode || !!iUserSummary?.userEmodeCategoryId) &&
                    styles.orangeText,
                ]}>
                {t('page.Lending.modalDesc.availableToBorrow')}:{' '}
                <Text
                  style={[
                    styles.usdValue,
                    (isInIsolationMode ||
                      !!iUserSummary?.userEmodeCategoryId) &&
                      styles.orangeText,
                  ]}>
                  {formatUsdValueKMB(
                    Number(iUserSummary?.availableBorrowsUSD || '0'),
                  )}
                </Text>
              </Text>
            </View>
            <Text
              style={[
                styles.availableCardValue,
                (isInIsolationMode || !!iUserSummary?.userEmodeCategoryId) &&
                  styles.orangeText,
              ]}>
              {desc}
            </Text>
          </View>
        )}
        {sortReservesLen ? (
          <View style={styles.listHeader}>
            <Text style={styles.headerToken}>
              {t('page.Lending.list.headers.token_balance')}
            </Text>
            <Text style={styles.headerApy}>{t('page.Lending.apy')}</Text>
            <Text style={styles.headerMyBorrows}>
              {t('page.Lending.list.headers.myBorrows')}
            </Text>
          </View>
        ) : null}
      </>
    );
  },
);

const FOOT_HEIGHT = 100;
const BorrowPoolList = React.memo(() => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { fetchData } = useFetchLendingData();

  const { displayPoolReserves, iUserSummary } = useLendingSummary();
  const { reserves } = useLendingRemoteData();

  useRendererDetect({ name: 'BorrowPoolList' });

  const sortReserves = useMemo(() => {
    return displayPoolReserves
      ?.filter(item => {
        if (isSameAddress(item.underlyingAsset, API_ETH_MOCK_ADDRESS)) {
          return false;
        }
        if (item.variableBorrows && item.variableBorrows !== '0') {
          return true;
        }
        if (BigNumber(item.reserve.totalDebt).gte(item.reserve.borrowCap)) {
          return false;
        }
        const reserve = reserves?.reservesData?.find(x =>
          isSameAddress(x.underlyingAsset, item.reserve.underlyingAsset),
        );
        if (!reserve || !iUserSummary) {
          return false;
        }
        return assetCanBeBorrowedByUser(
          reserve,
          iUserSummary,
          item.reserve.eModes,
        );
      })
      .sort((a, b) => {
        if (
          Number(a.totalBorrowsUSD) === 0 &&
          Number(b.totalBorrowsUSD) === 0
        ) {
          return (
            Number(b.reserve.totalDebtUSD) - Number(a.reserve.totalDebtUSD)
          );
        }
        return Number(b.totalBorrowsUSD) - Number(a.totalBorrowsUSD);
      });
  }, [displayPoolReserves, iUserSummary, reserves?.reservesData]);

  const handlePressItem = useCallback(
    item => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.BORROW_DETAIL,
        underlyingAsset: item.reserve.underlyingAsset,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
      });
    },
    [colors2024, isLight],
  );

  const keyExtractor = useCallback(item => {
    return `${item.reserve.underlyingAsset}-${item.reserve.symbol}`;
  }, []);
  const renderItem = useCallback(
    ({ item }) => {
      const isZeroBorrowed = item.totalBorrowsUSD === '0';
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => handlePressItem(item)}>
          <View style={styles.left}>
            <TokenIcon
              size={46}
              chainSize={0}
              tokenSymbol={item.reserve.symbol}
            />
            <View style={styles.symbolContainer}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {item.reserve.symbol}
              </Text>
              <View style={styles.yourBalanceContainer}>
                <WalletFillCC
                  width={16}
                  height={16}
                  style={styles.walletIcon}
                  color={colors2024['secondary-foot']}
                />
                <Text style={styles.yourBalance}>
                  {formatUsdValueKMB(item.walletBalanceUSD || '0')}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.apy}>
            {formatApy(Number(item.reserve.variableBorrowAPY || '0'))}
          </Text>
          <View style={styles.right}>
            {isZeroBorrowed ? (
              <Text style={[styles.yourSupplied, styles.zeroBorrowed]}>$0</Text>
            ) : (
              <Text style={styles.yourSupplied}>
                {formatListNetWorth(Number(item.totalBorrowsUSD || '0'))}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [colors2024, handlePressItem, styles],
  );
  const renderFooterComponent = useCallback(() => {
    return <View style={{ height: FOOT_HEIGHT }} />;
  }, []);

  return (
    <Tabs.FlatList
      data={sortReserves}
      style={styles.container}
      ListHeaderComponent={() => {
        return <ListHeaderComponent sortReservesLen={sortReserves.length} />;
      }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponentStyle={styles.headerContainer}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={8}
      removeClippedSubviews
      keyExtractor={keyExtractor}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => fetchData(true)} />
      }
      ListEmptyComponent={PoolListLoading}
      ListFooterComponent={renderFooterComponent}
      renderItem={renderItem}
    />
  );
});

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
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
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
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  yourSupplied: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  zeroBorrowed: {
    color: colors2024['neutral-info'],
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
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 1,
  },
  headerApy: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 60,
    flex: 0,
  },
  headerMyBorrows: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
  headerContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  loading: {
    width: 124,
    marginTop: 16,
    backgroundColor: colors2024['neutral-bg-5'],
    marginBottom: 2,
    marginLeft: 8,
  },
  availableCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    marginTop: 8,
    gap: 2,
  },
  availableCardIsolated: {
    backgroundColor: colors2024['orange-light-1'],
  },
  availableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  orangeText: {
    color: colors2024['orange-default'],
  },
  usdValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  availableCardValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  yourBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  walletIcon: {
    width: 16,
    height: 16,
    color: colors2024['neutral-secondary'],
    marginTop: -2,
  },
  yourBalance: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
}));
