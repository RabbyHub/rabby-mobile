import React, { useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useTheme2024 } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import { ChainSelector } from './ChainSelector';
import wrapperToken from './config/wrapperToken';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import { assetCanBeBorrowedByUser } from './utils/borrow';
import BorrowItem from './components/ItemRender/BorrowItem';
import SupplyItem from './components/ItemRender/SupplyItem';
import { displayGhoForMintableMarket } from './utils/supply';
import SummaryItem from './components/ItemRender/SummaryItem';
import {
  useFetchLendingData,
  useLendingIsLoading,
  useLendingRemoteData,
  useRefreshLendingWalletBalances,
  useLendingSummary,
  useSelectedMarket,
} from './hooks';
import { ItemListLoading } from './components/ItemRender/ItemLoading';
import EmptyItem from './components/ItemRender/EmptyItem';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
  BOTTOM_BUTTON_TEXT_SIZE,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import type { TransactionNavigatorParamList } from '@/navigation-type';
import {
  clearLendingActionPopupState,
  consumeLendingActionPopupToRestore,
  hideActiveLendingActionPopupForBlur,
  openLendingActionPopup,
  peekLendingActionPopupToRestore,
} from './utils/actionPopup';

type LendingRouteProp = RouteProp<
  TransactionNavigatorParamList,
  typeof RootNames.Lending
>;

type LendingNavigationProp = NativeStackNavigationProp<
  TransactionNavigatorParamList,
  typeof RootNames.Lending
>;

type MyAssetItem =
  | {
      type: 'borrow';
      underlyingAsset: string;
      usdValue: number;
    }
  | {
      type: 'supply';
      underlyingAsset: string;
      usdValue: number;
    };

const MyAssetHome: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { chainEnum, marketKey } = useSelectedMarket();
  const { reserves } = useLendingRemoteData();
  const { loading: isFetching } = useLendingIsLoading();
  const { fetchData } = useFetchLendingData();
  const { refreshWalletBalances } = useRefreshLendingWalletBalances();
  const { displayPoolReserves, iUserSummary, apyInfo } = useLendingSummary();
  const route = useRoute<LendingRouteProp>();
  const navigation = useNavigation<LendingNavigationProp>();
  const isFocused = useIsFocused();
  const openedRouteActionKeyRef = useRef<string | null>(null);
  const restoringPopupRefreshKeyRef = useRef<string | null>(null);

  const loading = isFetching || !iUserSummary || !displayPoolReserves;

  const myAssetList: MyAssetItem[] = useMemo(() => {
    const list: MyAssetItem[] = [];
    const supplyList = displayPoolReserves?.filter(item => {
      if (item.underlyingBalance && item.underlyingBalance !== '0') {
        return true;
      }
      const realUnderlyingAsset =
        isSameAddress(item.underlyingAsset, API_ETH_MOCK_ADDRESS) && chainEnum
          ? wrapperToken?.[chainEnum]?.address
          : item.reserve.underlyingAsset;
      const reserve = reserves?.reservesData?.find(x =>
        isSameAddress(x.underlyingAsset, realUnderlyingAsset),
      );
      if (!reserve) {
        return false;
      }
      return (
        !(reserve?.isFrozen || reserve.isPaused) &&
        !displayGhoForMintableMarket({
          symbol: reserve.symbol,
          currentMarket: marketKey,
        })
      );
    });
    const borrowList = displayPoolReserves?.filter(item => {
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
    });
    supplyList?.forEach(item => {
      const supplyUsd = Number(item.underlyingBalanceUSD || '0');
      if (supplyUsd > 0) {
        list.push({
          type: 'supply',
          underlyingAsset: item.underlyingAsset,
          usdValue: supplyUsd,
        });
      }
    });
    borrowList.forEach(item => {
      const borrowUsd = Number(item.totalBorrowsUSD || '0');
      if (borrowUsd > 0) {
        list.push({
          type: 'borrow',
          underlyingAsset: item.underlyingAsset,
          usdValue: borrowUsd,
        });
      }
    });

    return list.sort((a, b) => b.usdValue - a.usdValue);
  }, [
    chainEnum,
    displayPoolReserves,
    iUserSummary,
    marketKey,
    reserves?.reservesData,
  ]);

  const handleOpenSupplyList = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.LENDING_TOKEN_LIST,
      initialTab: 'supply',
      onBeforeSwapNavigate: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      onCancel: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: false,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
    });
  }, [colors2024]);

  const handleOpenBorrowList = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.LENDING_TOKEN_LIST,
      initialTab: 'borrow',
      bottomSheetModalProps: {
        enableContentPanningGesture: false,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
      onCancel: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
    });
  }, [colors2024]);

  const keyExtractor = useCallback(
    (item: MyAssetItem) => {
      const { underlyingAsset } = item;
      return `${marketKey}-${item.type}-${underlyingAsset}-${item.usdValue}`;
    },
    [marketKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: MyAssetItem }) => {
      if (item.type === 'borrow') {
        return (
          <BorrowItem
            underlyingAsset={item.underlyingAsset}
            style={styles.item}
          />
        );
      }
      return (
        <SupplyItem
          underlyingAsset={item.underlyingAsset}
          style={styles.item}
        />
      );
    },
    [styles.item],
  );

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findReserveByTokenAddress = useCallback(
    (tokenAddress: string) => {
      const keyword = tokenAddress.toLowerCase();
      const matchesToken = (address?: string) => {
        if (!address) {
          return false;
        }
        try {
          return isSameAddress(address, tokenAddress);
        } catch {
          return false;
        }
      };
      return displayPoolReserves?.find(item => {
        return (
          matchesToken(item.underlyingAsset) ||
          matchesToken(item.reserve.underlyingAsset) ||
          item.reserve.symbol.toLowerCase() === keyword
        );
      });
    },
    [displayPoolReserves],
  );

  React.useEffect(() => {
    if (!isFocused) {
      hideActiveLendingActionPopupForBlur();
      return;
    }
    if (loading || !iUserSummary) {
      return;
    }

    const popupToRestore = peekLendingActionPopupToRestore();
    if (!popupToRestore) {
      restoringPopupRefreshKeyRef.current = null;
      return;
    }

    const restoreKey = `${popupToRestore.popup}-${
      popupToRestore.tokenAddress
    }-${popupToRestore.source || ''}`;
    if (restoringPopupRefreshKeyRef.current !== restoreKey) {
      restoringPopupRefreshKeyRef.current = restoreKey;
      refreshWalletBalances(true).catch(() => {
        restoringPopupRefreshKeyRef.current = null;
      });
    }

    const reserve = findReserveByTokenAddress(popupToRestore.tokenAddress);
    if (!reserve) {
      restoringPopupRefreshKeyRef.current = null;
      clearLendingActionPopupState();
      return;
    }

    openLendingActionPopup({
      popup: popupToRestore.popup,
      reserve,
      userSummary: iUserSummary,
      colors2024,
      source: popupToRestore.source,
    });
    restoringPopupRefreshKeyRef.current = null;
    consumeLendingActionPopupToRestore();
  }, [
    colors2024,
    findReserveByTokenAddress,
    iUserSummary,
    isFocused,
    loading,
    refreshWalletBalances,
  ]);

  React.useEffect(() => {
    const tokenAddress = route.params?.tokenAddress;
    const direction = route.params?.direction;
    const source = route.params?.source;
    if (!tokenAddress || !direction || loading || !iUserSummary) {
      return;
    }

    const reserve = findReserveByTokenAddress(tokenAddress);

    if (!reserve) {
      return;
    }

    const actionKey = `${marketKey}-${direction}-${tokenAddress}`;
    if (openedRouteActionKeyRef.current === actionKey) {
      return;
    }
    openedRouteActionKeyRef.current = actionKey;

    if (direction !== 'supply' && direction !== 'borrow') {
      return;
    }

    if (direction === 'borrow') {
      openLendingActionPopup({
        popup: 'repay',
        reserve,
        userSummary: iUserSummary,
        colors2024,
        source,
      });
    } else {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.WITHDRAW_ACTION_DETAIL,
        reserve,
        userSummary: iUserSummary,
        source: source === 'Portfolio Defi' ? source : undefined,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        },
      });
    }

    navigation.setParams({
      tokenAddress: undefined,
      direction: undefined,
      source: undefined,
    });
  }, [
    colors2024,
    findReserveByTokenAddress,
    iUserSummary,
    loading,
    marketKey,
    navigation,
    route.params?.direction,
    route.params?.source,
    route.params?.tokenAddress,
  ]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

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
    return <EmptyItem />;
  }, [loading]);

  return (
    <View style={styles.container}>
      <FlatList
        key={marketKey}
        data={loading ? [] : myAssetList}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContentContainer}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loading ? (
            <ItemListLoading />
          ) : iUserSummary && !!myAssetList.length ? (
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
          <RefreshControl refreshing={false} onRefresh={handleRefresh} />
        }
      />
      <View style={styles.actionBar}>
        <View style={styles.actionBtnContainer}>
          <Button
            type="primary"
            containerStyle={[styles.actionButton]}
            buttonStyle={styles.normalButton}
            height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
            titleStyle={styles.actionGhostTitle}
            title={t('page.Lending.supplyDetail.actions')}
            disabled={loading}
            onPress={handleOpenSupplyList}
          />
        </View>
        <View style={styles.actionBtnContainer}>
          <Button
            type="aave"
            containerStyle={styles.actionButton}
            height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
            titleStyle={styles.actionPrimaryTitle}
            title={t('page.Lending.borrowDetail.actions')}
            splitAndroidCJKTitle
            disabled={loading}
            onPress={handleOpenBorrowList}
          />
        </View>
      </View>
    </View>
  );
};

export default MyAssetHome;

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  headerContainer: {
    //flexDirection: 'row',
    //gap: 16,
  },
  listContentContainer: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 118,
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
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    backgroundColor: colors2024['neutral-bg-1'],
  },
  actionBtnContainer: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  actionButton: {
    borderRadius: 12,
    height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
  },
  normalButton: {
    backgroundColor: colors2024['neutral-line'],
  },
  actionGhostTitle: {
    fontSize: BOTTOM_BUTTON_TEXT_SIZE,
    lineHeight: BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  actionPrimaryTitle: {
    fontSize: BOTTOM_BUTTON_TEXT_SIZE,
    lineHeight: BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
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
