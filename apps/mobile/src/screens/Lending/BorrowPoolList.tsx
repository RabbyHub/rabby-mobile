import React, { useCallback, useMemo } from 'react';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatPercent, formatUsdValueKMB } from '../TokenDetail/util';
import { useLendingData, useLendingSummary } from './hooks';
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

const FOOT_HEIGHT = 100;
const BorrowPoolList = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { displayPoolReserves, reserves, iUserSummary, loading } =
    useLendingSummary();
  const { t } = useTranslation();
  const { fetchData } = useLendingData();
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
        if (
          reserve?.borrowingEnabled === false ||
          reserve?.isActive === false ||
          reserve?.isFrozen ||
          reserve?.isPaused
        ) {
          return false;
        }
        return true;
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
  }, [displayPoolReserves, reserves?.reservesData]);

  const handlePressItem = item => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.BORROW_DETAIL,
      reserve: item,
      userSummary: iUserSummary,
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
  };

  const availableCard = useMemo(() => {
    if (loading || !iUserSummary?.totalLiquidityUSD) {
      return null;
    }
    return (
      <View style={styles.availableCard}>
        <View style={styles.availableCardHeader}>
          {iUserSummary?.availableBorrowsUSD &&
          iUserSummary?.availableBorrowsUSD !== '0' ? null : (
            <RcIconWarningCircleCC
              width={14}
              height={14}
              color={colors2024['neutral-info']}
            />
          )}
          <Text style={styles.availableCardTitle}>
            {t('page.Lending.modalDesc.availableToBorrow')}:{' '}
            <Text style={styles.usdValue}>
              {formatUsdValueKMB(
                Number(iUserSummary?.availableBorrowsUSD || '0'),
              )}
            </Text>
          </Text>
        </View>
        <Text style={styles.availableCardValue}>
          {iUserSummary?.availableBorrowsUSD &&
          iUserSummary?.availableBorrowsUSD !== '0'
            ? t('page.Lending.availableCard.canBorrow')
            : t('page.Lending.availableCard.needSupply')}
        </Text>
      </View>
    );
  }, [
    colors2024,
    iUserSummary?.availableBorrowsUSD,
    iUserSummary?.totalLiquidityUSD,
    loading,
    styles.availableCard,
    styles.availableCardHeader,
    styles.availableCardTitle,
    styles.availableCardValue,
    styles.usdValue,
    t,
  ]);

  const ListHeaderComponent = useCallback(() => {
    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <>
        {availableCard}
        <View style={styles.listHeader}>
          <Text style={styles.headerToken}>
            {t('page.Lending.list.headers.token')}
          </Text>
          <Text style={styles.headerApy}>
            {t('page.Lending.list.headers.apy')}
          </Text>
          <Text style={styles.headerMyBorrows}>
            {t('page.Lending.list.headers.myBorrows')}
          </Text>
        </View>
      </>
    );
  }, [
    availableCard,
    loading,
    styles.headerApy,
    styles.headerMyBorrows,
    styles.headerToken,
    styles.listHeader,
    styles.loading,
    t,
  ]);

  return (
    <Tabs.FlatList
      data={loading ? [] : sortReserves}
      style={styles.container}
      ListHeaderComponent={ListHeaderComponent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => fetchData(true)} />
      }
      ListEmptyComponent={<PoolListLoading />}
      ListFooterComponent={<View style={{ height: FOOT_HEIGHT }} />}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={styles.item}
          key={index}
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
    lineHeight: 20,
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
}));
