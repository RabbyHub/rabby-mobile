import { Text } from '@/components/Typography';
import type { PerpsQuoteAsset } from '@/constant/perps';
import { useTheme2024 } from '@/hooks/theme';
import { useActiveAssetSubscription } from '@/hooks/perps/subscriptions/useActiveAssetSubscription';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  useWindowDimensions,
  View,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProAccountAssetRow } from '../components/account/PerpsProAccountAssetRow';
import { PerpsProAccountState } from '../components/account/PerpsProAccountState';
import { PerpsProAccountSummary } from '../components/account/PerpsProAccountSummary';
import {
  PerpsProFundingOverlay,
  type PerpsProFundingMode,
} from '../components/account/PerpsProFundingOverlay';
import { PerpsProKlineSheet } from '../components/chart/PerpsProKlineSheet';
import { PerpsProHeader } from '../components/header/PerpsProHeader';
import { usePerpsProHeaderCollapse } from '../components/header/usePerpsProHeaderCollapse';
import { PERPS_PRO_HEADER_HEIGHT } from '../components/header/constants';
import { PerpsProInfoTabs } from '../components/info/PerpsProInfoTabs';
import {
  PerpsProMarketBarSkeleton,
  PerpsProSceneSkeleton,
} from '../components/loading/PerpsProSceneSkeleton';
import {
  PERPS_PRO_MARKET_BAR_HEIGHT,
  PerpsProMarketBar,
} from '../components/market/PerpsProMarketBar';
import {
  PerpsProMarketSelector,
  type PerpsProMarketSelectorHandle,
} from '../components/market/PerpsProMarketSelector';
import { PerpsProOpenOrderCard } from '../components/open-orders/PerpsProOpenOrderCard';
import { PerpsProCancelConfirmationModal } from '../components/open-orders/PerpsProCancelConfirmationModal';
import { PerpsProOpenOrdersControls } from '../components/open-orders/PerpsProOpenOrdersControls';
import { PerpsProPositionCard } from '../components/positions/PerpsProPositionCard';
import { PerpsProCloseConfirmationSheet } from '../components/positions/PerpsProCloseConfirmationSheet';
import { PerpsProClosePositionSheet } from '../components/positions/PerpsProClosePositionSheet';
import { PerpsProLeverageSheet } from '../components/positions/PerpsProLeverageSheet';
import { PerpsProPositionsControls } from '../components/positions/PerpsProPositionsControls';
import { PerpsProTradeSkeleton } from '../components/trade/PerpsProTradeSkeleton';
import type { PerpsAccountAssetRow } from '../model/account';
import { getPerpsProColumnLayout } from '../model/layout';
import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import type { PerpsPositionViewModel } from '../model/position';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';
import {
  type PerpsProAccountPanelState,
  usePerpsProInfoPanel,
} from './usePerpsProInfoPanel';
import { usePerpsProScene } from './usePerpsProScene';
import { usePerpsProCancelOrders } from './usePerpsProCancelOrders';
import { usePerpsProPositionActions } from './usePerpsProPositionActions';

type PerpsProSceneRow =
  | { key: 'trade'; type: 'trade' }
  | { key: 'info-tabs'; type: 'info-tabs' }
  | {
      key: 'account-state';
      state: Exclude<PerpsProAccountPanelState, 'ready'>;
      type: 'account-state';
    }
  | { key: 'account-summary'; type: 'account-summary' }
  | { asset: PerpsAccountAssetRow; key: string; type: 'account-asset' }
  | { key: 'positions-controls'; type: 'positions-controls' }
  | { key: string; position: PerpsPositionViewModel; type: 'position' }
  | { key: 'open-orders-controls'; type: 'open-orders-controls' }
  | { key: string; order: PerpsOpenOrderViewModel; type: 'open-order' };

interface FundingOverlayState {
  mode: PerpsProFundingMode;
  targetAsset: PerpsQuoteAsset;
}

const PERPS_PRO_SCENE_LEAD_IN_HEIGHT =
  PERPS_PRO_HEADER_HEIGHT + PERPS_PRO_MARKET_BAR_HEIGHT;

export const PerpsProScene: React.FC<{
  historyEnabled?: boolean;
  isModeSwitching: boolean;
  onOpenHistory?: () => void;
  onSwitchToSimple: () => void;
}> = ({
  historyEnabled = false,
  isModeSwitching,
  onOpenHistory = () => undefined,
  onSwitchToSimple,
}) => {
  const { width } = useWindowDimensions();
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const scene = usePerpsProScene();
  const activeAsset = useActiveAssetSubscription(
    scene.currentMarket?.canonicalCoin ?? '',
    { enabled: scene.klineEnabled },
  );
  const info = usePerpsProInfoPanel(scene.currentMarket?.canonicalCoin ?? '');
  const positionActions = usePerpsProPositionActions({
    accountIdentity: info.accountIdentity,
    refreshActiveAssetData: activeAsset.refreshActiveAssetData,
  });
  const cancelOrders = usePerpsProCancelOrders();
  const { setHideOtherSymbols } = info;
  const headerCollapse = usePerpsProHeaderCollapse();
  const marketSelectorRef = useRef<PerpsProMarketSelectorHandle>(null);
  const [klineOpen, setKlineOpen] = useState(false);
  const [fundingOverlay, setFundingOverlay] =
    useState<FundingOverlayState | null>(null);
  const fundingAccountIdentityRef = useRef(info.accountIdentity);

  useEffect(() => {
    if (fundingAccountIdentityRef.current === info.accountIdentity) {
      return;
    }
    fundingAccountIdentityRef.current = info.accountIdentity;
    setFundingOverlay(null);
  }, [info.accountIdentity]);
  const openKline = useCallback(() => setKlineOpen(true), []);
  const closeKline = useCallback(() => setKlineOpen(false), []);
  const closeFundingOverlay = useCallback(() => setFundingOverlay(null), []);
  const openDeposit = useCallback(
    () => setFundingOverlay({ mode: 'deposit', targetAsset: 'USDC' }),
    [],
  );
  const openWithdraw = useCallback(
    () => setFundingOverlay({ mode: 'withdraw', targetAsset: 'USDC' }),
    [],
  );
  const openDepositFromFunding = useCallback(
    () => setFundingOverlay({ mode: 'deposit', targetAsset: 'USDC' }),
    [],
  );
  const openSwap = useCallback((targetAsset: PerpsQuoteAsset) => {
    setFundingOverlay({ mode: 'swap', targetAsset });
  }, []);
  const openMarketSelector = useCallback(
    () => marketSelectorRef.current?.present(),
    [],
  );
  const toggleHideOtherSymbols = useCallback(
    () => setHideOtherSymbols(value => !value),
    [setHideOtherSymbols],
  );
  const { gap, orderBookWidth, tradeWidth } = useMemo(
    () => getPerpsProColumnLayout(width),
    [width],
  );
  const orderBookColumnStyle = useMemo<ViewStyle>(
    () => ({ width: orderBookWidth }),
    [orderBookWidth],
  );
  const tradeColumnStyle = useMemo<ViewStyle>(
    () => ({ width: tradeWidth }),
    [tradeWidth],
  );
  const columnsStyle = useMemo<ViewStyle>(() => ({ gap }), [gap]);
  const isMarketLoading =
    !scene.currentMarket &&
    (scene.marketDataStatus === 'idle' ||
      scene.marketDataStatus === 'loading' ||
      scene.isResolvingMarket);
  const renderScrollLeadIn = useCallback(
    () => (
      <View style={styles.scrollLeadIn} testID="perps-pro-scroll-lead-in" />
    ),
    [styles.scrollLeadIn],
  );

  const rows = useMemo<PerpsProSceneRow[]>(() => {
    const result: PerpsProSceneRow[] = [
      { key: 'trade', type: 'trade' },
      { key: 'info-tabs', type: 'info-tabs' },
    ];

    if (info.activeInfoTab === 'account') {
      if (info.accountState === 'ready') {
        result.push({ key: 'account-summary', type: 'account-summary' });
        if (info.account.assets.length > 0) {
          result.push(
            ...info.account.assets.map(asset => ({
              asset,
              key: `account-asset:${asset.key}`,
              type: 'account-asset' as const,
            })),
          );
        }
      } else {
        result.push({
          key: 'account-state',
          state: info.accountState,
          type: 'account-state',
        });
      }
      return result;
    }

    if (info.activeInfoTab === 'positions') {
      result.push({ key: 'positions-controls', type: 'positions-controls' });
      result.push(
        ...info.positions.map(position => ({
          key: `position:${info.accountIdentity}:${position.key}`,
          position,
          type: 'position' as const,
        })),
      );
      return result;
    }

    result.push({
      key: 'open-orders-controls',
      type: 'open-orders-controls',
    });
    result.push(
      ...info.openOrders.map(order => ({
        key: `open-order:${info.accountIdentity}:${order.key}`,
        order,
        type: 'open-order' as const,
      })),
    );
    return result;
  }, [
    info.account,
    info.accountIdentity,
    info.accountState,
    info.activeInfoTab,
    info.openOrders,
    info.positions,
  ]);

  const renderItem = useCallback<ListRenderItem<PerpsProSceneRow>>(
    ({ item }) => {
      switch (item.type) {
        case 'trade':
          if (scene.currentMarket) {
            return (
              <View style={[styles.columns, columnsStyle]}>
                <View style={orderBookColumnStyle}>
                  <PerpsProRealtimeOrderBook
                    enabled={scene.realtimeEnabled}
                    market={scene.currentMarket}
                    onSelectTickOption={scene.selectTickOption}
                    precision={scene.precision}
                    selectedTickOption={scene.selectedTickOption}
                    tickOptions={scene.tickOptions}
                  />
                </View>
                <View style={tradeColumnStyle}>
                  <PerpsProTradeSkeleton
                    leverage={
                      activeAsset.activeAssetData?.leverage.value ??
                      scene.currentMarket.marketData.maxLeverage
                    }
                    marginMode={
                      scene.currentMarket.marketData.onlyIsolated
                        ? 'isolated'
                        : activeAsset.activeAssetData?.leverage.type ??
                          'isolated'
                    }
                    quoteAsset={scene.currentMarket.quoteAsset}
                  />
                </View>
              </View>
            );
          }
          if (isMarketLoading) {
            return (
              <PerpsProSceneSkeleton
                gap={gap}
                orderBookWidth={orderBookWidth}
                tradeWidth={tradeWidth}
              />
            );
          }
          return (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {t('page.perps.pro.common.unavailable')}
              </Text>
              {scene.marketDataStatus === 'error' ? (
                <Pressable
                  accessibilityLabel={t('page.perps.pro.common.retry')}
                  accessibilityRole="button"
                  onPress={scene.retryMarketData}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>
                    {t('page.perps.pro.common.retry')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        case 'info-tabs':
          return (
            <PerpsProInfoTabs
              activeTab={info.activeInfoTab}
              historyEnabled={
                historyEnabled && info.accountState !== 'noAccount'
              }
              onChange={tab => info.setActiveInfoTab(tab)}
              onHistoryPress={onOpenHistory}
              openOrdersCount={info.allOpenOrdersCount}
              positionsCount={info.allPositionsCount}
            />
          );
        case 'account-state':
          return (
            <PerpsProAccountState
              onDeposit={openDeposit}
              onRetry={info.retryAccount}
              state={item.state}
            />
          );
        case 'account-summary':
          return (
            <PerpsProAccountSummary
              account={info.account}
              onDeposit={openDeposit}
              onWithdraw={openWithdraw}
            />
          );
        case 'account-asset':
          return (
            <PerpsProAccountAssetRow asset={item.asset} onSwap={openSwap} />
          );
        case 'positions-controls':
          return (
            <PerpsProPositionsControls
              hideOtherSymbols={info.hideOtherSymbols}
              onToggleHideOtherSymbols={toggleHideOtherSymbols}
            />
          );
        case 'position':
          return (
            <PerpsProPositionCard
              accountIdentity={info.accountIdentity}
              onClose={positionActions.openCloseEditor}
              onEditLeverage={positionActions.openLeverageEditor}
              position={item.position}
            />
          );
        case 'open-orders-controls':
          return (
            <PerpsProOpenOrdersControls
              basicCount={info.openOrderCounts.basic}
              category={info.openOrderCategory}
              conditionalCount={info.openOrderCounts.conditional}
              hideOtherSymbols={info.hideOtherSymbols}
              isCancelAllPending={cancelOrders.isCancelAllPending}
              onCancelAll={() =>
                cancelOrders.confirmCancelAll(
                  info.openOrderCommandCandidates,
                  info.openOrderCategory,
                )
              }
              onSetCategory={info.setOpenOrderCategory}
              onToggleHideOtherSymbols={toggleHideOtherSymbols}
            />
          );
        case 'open-order':
          return (
            <PerpsProOpenOrderCard
              cancelPending={cancelOrders.isOrderPending(item.order.oid)}
              onCancel={cancelOrders.confirmCancelOrder}
              order={item.order}
            />
          );
      }
    },
    [
      activeAsset.activeAssetData?.leverage.type,
      activeAsset.activeAssetData?.leverage.value,
      columnsStyle,
      cancelOrders,
      gap,
      info,
      historyEnabled,
      isMarketLoading,
      onOpenHistory,
      openDeposit,
      openSwap,
      openWithdraw,
      orderBookColumnStyle,
      orderBookWidth,
      scene,
      positionActions.openLeverageEditor,
      positionActions.openCloseEditor,
      styles,
      t,
      toggleHideOtherSymbols,
      tradeColumnStyle,
      tradeWidth,
    ],
  );

  return (
    <>
      <View style={styles.container}>
        <Animated.FlatList
          ListHeaderComponent={renderScrollLeadIn}
          contentContainerStyle={styles.scrollContent}
          data={rows}
          initialNumToRender={8}
          keyExtractor={item => item.key}
          keyboardShouldPersistTaps="handled"
          onScroll={headerCollapse.onScroll}
          renderItem={renderItem}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          testID="perps-pro-scroll"
        />
        <Animated.View
          style={[
            styles.headerClip,
            {
              opacity: headerCollapse.headerOpacity,
              transform: [{ translateY: headerCollapse.headerTranslateY }],
            },
          ]}
          testID="perps-pro-header-overlay">
          <PerpsProHeader
            isModeSwitching={isModeSwitching}
            onSwitchToSimple={onSwitchToSimple}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.marketOverlay,
            {
              transform: [{ translateY: headerCollapse.marketTranslateY }],
            },
          ]}
          testID="perps-pro-market-overlay">
          {isMarketLoading ? (
            <PerpsProMarketBarSkeleton />
          ) : (
            <PerpsProMarketBar
              market={scene.currentMarket}
              onOpenKline={openKline}
              onPress={openMarketSelector}
            />
          )}
        </Animated.View>
      </View>
      <PerpsProMarketSelector
        currentMarketKey={scene.currentMarket?.marketKey ?? null}
        onSelect={scene.selectMarket}
        ref={marketSelectorRef}
      />
      {klineOpen && scene.currentMarket ? (
        <PerpsProKlineSheet
          enabled={scene.klineEnabled}
          market={scene.currentMarket}
          onClose={closeKline}
        />
      ) : null}
      {fundingOverlay ? (
        <PerpsProFundingOverlay
          mode={fundingOverlay.mode}
          onClose={closeFundingOverlay}
          onOpenDeposit={openDepositFromFunding}
          targetAsset={fundingOverlay.targetAsset}
        />
      ) : null}
      <PerpsProCancelConfirmationModal
        confirmation={cancelOrders.confirmation}
        onCancel={cancelOrders.dismissConfirmation}
        onConfirm={cancelOrders.confirmCancellation}
      />
      <PerpsProLeverageSheet
        currentLeverage={positionActions.leverageEditor?.position.leverage ?? 1}
        maxLeverage={positionActions.leverageEditor?.position.maxLeverage ?? 1}
        onClose={positionActions.closeLeverageEditor}
        onConfirm={positionActions.updateLeverage}
        pending={positionActions.leveragePending}
        visible={!!positionActions.leverageEditor}
      />
      {positionActions.closeEditor ? (
        <PerpsProClosePositionSheet
          market={positionActions.closeEditor.market}
          onClose={positionActions.closeCloseEditor}
          onReview={positionActions.reviewClose}
          position={positionActions.closeEditor.position}
          visible={!positionActions.closeReview}
        />
      ) : null}
      {positionActions.closeEditor && positionActions.closeReview ? (
        <PerpsProCloseConfirmationSheet
          draft={positionActions.closeReview}
          market={positionActions.closeEditor.market}
          onClose={positionActions.cancelCloseReview}
          onConfirm={positionActions.confirmClose}
          onToggleSkipLimit={() =>
            positionActions.setSkipLimitConfirmation(value => !value)
          }
          pending={positionActions.closePending}
          position={positionActions.closeEditor.position}
          skipLimitConfirmation={positionActions.skipLimitConfirmation}
          visible
        />
      ) : null}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  headerClip: {
    height: PERPS_PRO_HEADER_HEIGHT,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  marketOverlay: {
    height: PERPS_PRO_MARKET_BAR_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  scroll: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollContent: {
    backgroundColor: colors2024['neutral-bg-1'],
    flexGrow: 1,
    paddingBottom: 32,
  },
  scrollLeadIn: {
    height: PERPS_PRO_SCENE_LEAD_IN_HEIGHT,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    height: 516,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 16,
  },
  retryText: {
    color: colors2024['blue-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
}));
