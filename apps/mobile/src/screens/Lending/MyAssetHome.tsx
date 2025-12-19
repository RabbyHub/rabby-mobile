import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useLendingData, useLendingSummary } from './hooks';
import { DisplayPoolReserveInfo } from './type';
import BorrowItem from './components/ItemRender/BorrowItem';
import SupplyItem from './components/ItemRender/SupplyItem';
import SummaryItem from './components/ItemRender/SummaryItem';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { getSupplyCapData } from './utils/supply';
import { ChainSelector } from './ChainSelector';

type MyAssetItem =
  | {
      type: 'borrow';
      reserve: DisplayPoolReserveInfo;
      usdValue: number;
    }
  | {
      type: 'supply';
      reserve: DisplayPoolReserveInfo;
      usdValue: number;
      canBeEnabledAsCollateral: boolean;
    };

const MyAssetHome: React.FC = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { displayPoolReserves, loading, iUserSummary, apyInfo } =
    useLendingSummary();
  const { fetchData } = useLendingData();

  const myAssetList: MyAssetItem[] = useMemo(() => {
    const list: MyAssetItem[] = [];
    (displayPoolReserves || []).forEach(item => {
      const supplyUsd = Number(item.underlyingBalanceUSD || '0');
      const borrowUsd = Number(item.totalBorrowsUSD || '0');

      if (supplyUsd > 0) {
        const { supplyCapReached } = getSupplyCapData(item);
        const canBeEnabledAsCollateral = iUserSummary
          ? !supplyCapReached &&
            item.reserve.reserveLiquidationThreshold !== '0' &&
            ((!item.reserve.isIsolated && !iUserSummary.isInIsolationMode) ||
              iUserSummary.isolatedReserve?.underlyingAsset ===
                item.underlyingAsset ||
              (item.reserve.isIsolated &&
                iUserSummary.totalCollateralMarketReferenceCurrency === '0'))
          : false;
        list.push({
          type: 'supply',
          reserve: item,
          usdValue: supplyUsd,
          canBeEnabledAsCollateral,
        });
      }

      if (borrowUsd > 0) {
        list.push({
          type: 'borrow',
          reserve: item,
          usdValue: borrowUsd,
        });
      }
    });

    return list.sort((a, b) => b.usdValue - a.usdValue);
  }, [displayPoolReserves, iUserSummary]);

  const handleOpenBorrowDetail = useCallback(
    (item: DisplayPoolReserveInfo) => {
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

  const handleOpenSupplyDetail = useCallback(
    (item: DisplayPoolReserveInfo) => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SUPPLY_DETAIL,
        underlyingAsset: item.underlyingAsset,
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

  const handleOpenSupplyList = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.LENDING_SUPPLY_LIST,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  }, []);

  const handleOpenBorrowList = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.LENDING_BORROW_LIST,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  }, []);

  const keyExtractor = useCallback((item: MyAssetItem) => {
    const { reserve } = item;
    return `${item.type}-${reserve.reserve.underlyingAsset}-${reserve.reserve.symbol}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MyAssetItem }) => {
      if (item.type === 'borrow') {
        return (
          <BorrowItem
            reserve={item.reserve}
            style={styles.item}
            onPressBorrow={handleOpenBorrowDetail}
            onPressRepay={handleOpenBorrowDetail}
          />
        );
      }
      return (
        <SupplyItem
          reserve={item.reserve}
          canBeEnabledAsCollateral={item.canBeEnabledAsCollateral}
          style={styles.item}
          onToggleCollateral={handleOpenSupplyDetail}
          onPressSupply={handleOpenSupplyDetail}
          onPressWithdraw={handleOpenSupplyDetail}
        />
      );
    },
    [handleOpenBorrowDetail, handleOpenSupplyDetail, styles.item],
  );

  const renderHeader = useCallback(() => {
    return (
      <View style={styles.headerContainer}>
        <ChainSelector />
      </View>
    );
  }, [styles.headerContainer]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return null;
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {/*{t('page.Lending.myAssets.noBorrowedPositions')}*/}
          xx
        </Text>
      </View>
    );
  }, [loading, styles.emptyContainer, styles.emptyText]);

  return (
    <View style={styles.container}>
      <FlatList
        data={myAssetList}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContentContainer}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          iUserSummary ? (
            <View style={styles.footer}>
              <SummaryItem
                netWorth={iUserSummary?.netWorthUSD || ''}
                supplied={iUserSummary?.totalLiquidityUSD || ''}
                borrowed={iUserSummary?.totalBorrowsUSD || ''}
                netApy={apyInfo?.netAPY || 0}
                healthFactor={iUserSummary?.healthFactor || ''}
              />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => fetchData(true)}
          />
        }
      />
      <View style={styles.actionBar}>
        <View style={styles.actionBtnContainer}>
          <Button
            type="primary"
            containerStyle={[styles.actionButton]}
            buttonStyle={styles.normalButton}
            titleStyle={styles.actionGhostTitle}
            title={t('page.Lending.supplyDetail.actions')}
            onPress={handleOpenSupplyList}
          />
        </View>
        <View style={styles.actionBtnContainer}>
          <Button
            containerStyle={styles.actionButton}
            titleStyle={styles.actionPrimaryTitle}
            title={t('page.Lending.borrowDetail.actions')}
            onPress={handleOpenBorrowList}
          />
        </View>
      </View>
    </View>
  );
};

export default MyAssetHome;

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  headerContainer: {
    //marginBottom: 24,
  },
  listContentContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 140,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 34,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  actionBtnContainer: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  actionButton: {
    borderRadius: 12,
  },
  normalButton: {
    backgroundColor: colors2024['neutral-line'],
  },
  actionGhostTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  actionPrimaryTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  item: {
    marginHorizontal: 0,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
