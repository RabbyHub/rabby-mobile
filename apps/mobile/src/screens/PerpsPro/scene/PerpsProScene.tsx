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
  AppState,
  Pressable,
  useWindowDimensions,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProAccountAssetRow } from '../components/account/PerpsProAccountAssetRow';
import { PerpsProAccountState } from '../components/account/PerpsProAccountState';
import { PerpsProAccountSummary } from '../components/account/PerpsProAccountSummary';
import { PerpsProTransferSheet } from '../components/account/PerpsProTransferSheet';
import {
  PerpsProFundingOverlay,
  type PerpsProFundingMode,
} from '../components/account/PerpsProFundingOverlay';
import { PerpsProKlineSheet } from '../components/chart/PerpsProKlineSheet';
import { PerpsProFieldExplanationProvider } from '../components/common/PerpsProFieldExplanationProvider';
import { usePerpsProDismissKeyboard } from '../components/common/usePerpsProDismissKeyboard';
import { PerpsProHeader } from '../components/header/PerpsProHeader';
import { PerpsProAccountSelectorLayer } from '../components/header/PerpsProAccountSelectorLayer';
import { usePerpsProHeaderCollapse } from '../components/header/usePerpsProHeaderCollapse';
import { PERPS_PRO_HEADER_HEIGHT } from '../components/header/constants';
import { PerpsProInfoTabs } from '../components/info/PerpsProInfoTabs';
import { createPerpsProInfoTabsTranslateY } from '../components/info/perpsProInfoTabsSticky';
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
import { PerpsProCloseAllConfirmationModal } from '../components/positions/PerpsProCloseAllConfirmationModal';
import { PerpsProCloseConfirmationSheet } from '../components/positions/PerpsProCloseConfirmationSheet';
import { PerpsProClosePositionSheet } from '../components/positions/PerpsProClosePositionSheet';
import { PerpsProLeverageSheet } from '../components/positions/PerpsProLeverageSheet';
import { PerpsProPositionsControls } from '../components/positions/PerpsProPositionsControls';
import { PerpsProOrderConfirmationSheet } from '../components/trade/PerpsProOrderConfirmationSheet';
import { PerpsProTradeForm } from '../components/trade/PerpsProTradeForm';
import type { PerpsAccountAssetRow } from '../model/account';
import {
  getPerpsProColumnLayout,
  PERPS_PRO_MAIN_COLUMN_HEIGHT,
} from '../model/layout';
import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import type { PerpsPositionViewModel } from '../model/position';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';
import {
  type PerpsProAccountPanelState,
  usePerpsProInfoPanel,
} from './usePerpsProInfoPanel';
import { usePerpsProScene } from './usePerpsProScene';
import { usePerpsProCancelOrders } from './usePerpsProCancelOrders';
import { usePerpsProCloseAll } from './usePerpsProCloseAll';
import { usePerpsProBboBook } from './usePerpsProBboBook';
import { usePerpsProPositionActions } from './usePerpsProPositionActions';
import { usePerpsProLeverageUpdate } from './usePerpsProLeverageUpdate';
import { usePerpsProTrade } from './usePerpsProTrade';
import { usePerpsProTransfer } from './usePerpsProTransfer';

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
  const leverageUpdate = usePerpsProLeverageUpdate({
    refreshActiveAssetData: activeAsset.refreshActiveAssetData,
  });
  const bboBook = usePerpsProBboBook({
    coin: scene.currentMarket?.canonicalCoin ?? '',
    enabled: scene.realtimeEnabled,
  });
  const trade = usePerpsProTrade({
    activeAssetData: activeAsset.activeAssetData,
    bboBook: bboBook.book,
    bboPrices: bboBook.prices,
    bboSessionKey: bboBook.sessionKey,
    bboStatus: bboBook.status,
    executionActive: scene.executionActive && !isModeSwitching,
    leveragePending: leverageUpdate.pending,
    market: scene.currentMarket,
    zeroAddressLeverageBaseline: scene.zeroAddressLeverageBaseline,
    refreshActiveAssetData: activeAsset.refreshActiveAssetData,
    updateLeverageRequest: leverageUpdate.update,
  });
  const info = usePerpsProInfoPanel(scene.currentMarket?.canonicalCoin ?? '');
  const positionActions = usePerpsProPositionActions({
    accountIdentity: info.accountIdentity,
    leveragePending: leverageUpdate.pending,
    updateLeverageRequest: leverageUpdate.update,
  });
  const cancelOrders = usePerpsProCancelOrders();
  const closeAll = usePerpsProCloseAll(info.accountIdentity);
  const transfer = usePerpsProTransfer(info.accountIdentity);
  const { setHideOtherSymbols } = info;
  const headerCollapse = usePerpsProHeaderCollapse();
  const marketSelectorRef = useRef<PerpsProMarketSelectorHandle>(null);
  const [klineOpen, setKlineOpen] = useState(false);
  const [klineActivated, setKlineActivated] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const [fundingOverlay, setFundingOverlay] =
    useState<FundingOverlayState | null>(null);
  const [mainColumnHeight, setMainColumnHeight] = useState(
    PERPS_PRO_MAIN_COLUMN_HEIGHT,
  );
  const [tradeRowHeight, setTradeRowHeight] = useState(
    PERPS_PRO_MAIN_COLUMN_HEIGHT + 8,
  );
  const fundingAccountIdentityRef = useRef(info.accountIdentity);

  useEffect(() => {
    if (fundingAccountIdentityRef.current === info.accountIdentity) {
      return;
    }
    fundingAccountIdentityRef.current = info.accountIdentity;
    setFundingOverlay(null);
  }, [info.accountIdentity]);
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  const openKline = useCallback(() => {
    setKlineActivated(true);
    setKlineOpen(true);
  }, []);
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
    () => dismissKeyboardThen(() => marketSelectorRef.current?.present()),
    [dismissKeyboardThen],
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
  const updateMainColumnHeight = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.max(
      PERPS_PRO_MAIN_COLUMN_HEIGHT,
      Math.ceil(event.nativeEvent.layout.height),
    );
    setMainColumnHeight(current =>
      Math.abs(current - measured) > 1 ? measured : current,
    );
  }, []);
  const updateTradeRowHeight = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.ceil(event.nativeEvent.layout.height);
    if (measured <= 0) {
      return;
    }
    setTradeRowHeight(current =>
      Math.abs(current - measured) > 1 ? measured : current,
    );
  }, []);
  const infoTabsTranslateY = useMemo(
    () =>
      createPerpsProInfoTabsTranslateY({
        anchorY: PERPS_PRO_SCENE_LEAD_IN_HEIGHT + tradeRowHeight,
        marketBarHeight: PERPS_PRO_MARKET_BAR_HEIGHT,
        marketTranslateY: headerCollapse.marketTranslateY,
        scrollY: headerCollapse.scrollY,
      }),
    [headerCollapse.marketTranslateY, headerCollapse.scrollY, tradeRowHeight],
  );
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
              <View
                onLayout={updateTradeRowHeight}
                style={[styles.columns, columnsStyle]}>
                <View style={orderBookColumnStyle}>
                  <PerpsProRealtimeOrderBook
                    amountUnit={trade.amountUnit}
                    enabled={scene.realtimeEnabled}
                    height={mainColumnHeight}
                    market={scene.currentMarket}
                    onSelectTickOption={scene.selectTickOption}
                    onSelectPrice={
                      trade.form.orderType === 'limit' && !trade.form.bboEnabled
                        ? price =>
                            trade.selectManualLimitPrice(
                              price,
                              scene.currentMarket!.marketKey,
                            )
                        : undefined
                    }
                    precision={scene.precision}
                    selectedTickOption={scene.selectedTickOption}
                    tickOptions={scene.tickOptions}
                  />
                </View>
                <View
                  onLayout={updateMainColumnHeight}
                  style={tradeColumnStyle}>
                  <PerpsProTradeForm
                    controller={trade}
                    onDeposit={openDeposit}
                  />
                </View>
              </View>
            );
          }
          if (isMarketLoading) {
            return (
              <View onLayout={updateTradeRowHeight}>
                <PerpsProSceneSkeleton
                  gap={gap}
                  orderBookWidth={orderBookWidth}
                  tradeWidth={tradeWidth}
                />
              </View>
            );
          }
          return (
            <View onLayout={updateTradeRowHeight} style={styles.empty}>
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
            <View
              style={styles.infoTabsSpacer}
              testID="perps-pro-info-tabs-spacer"
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
            <PerpsProAccountAssetRow
              asset={item.asset}
              onSwap={openSwap}
              onTransfer={transfer.open}
            />
          );
        case 'positions-controls':
          return (
            <PerpsProPositionsControls
              actionDisabled={info.allPositionsCount === 0}
              actionPending={closeAll.pending}
              hideOtherSymbols={info.hideOtherSymbols}
              onCloseAll={closeAll.requestCloseAll}
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
              amountUnit={trade.amountUnit}
              cancelPending={cancelOrders.isOrderPending(item.order.oid)}
              onCancel={cancelOrders.confirmCancelOrder}
              order={item.order}
            />
          );
      }
    },
    [
      columnsStyle,
      cancelOrders,
      closeAll.pending,
      closeAll.requestCloseAll,
      gap,
      info,
      isMarketLoading,
      mainColumnHeight,
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
      trade,
      transfer.open,
      updateMainColumnHeight,
      updateTradeRowHeight,
    ],
  );

  return (
    <PerpsProFieldExplanationProvider>
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
        <Animated.View
          style={[
            styles.infoTabsOverlay,
            { transform: [{ translateY: infoTabsTranslateY }] },
          ]}
          testID="perps-pro-info-tabs-overlay">
          <PerpsProInfoTabs
            activeTab={info.activeInfoTab}
            historyEnabled={historyEnabled && info.accountState !== 'noAccount'}
            onChange={tab => info.setActiveInfoTab(tab)}
            onHistoryPress={onOpenHistory}
            openOrdersCount={info.allOpenOrdersCount}
            positionsCount={info.allPositionsCount}
          />
        </Animated.View>
      </View>
      <PerpsProMarketSelector
        currentMarketKey={scene.currentMarket?.marketKey ?? null}
        onClose={scene.cancelPendingMarketSelection}
        onPrefetch={scene.prefetchMarket}
        onSelect={scene.selectMarket}
        ref={marketSelectorRef}
      />
      <PerpsProAccountSelectorLayer />
      {scene.currentMarket ? (
        <PerpsProKlineSheet
          enabled={
            klineActivated && scene.klineEnabled && appState === 'active'
          }
          market={scene.currentMarket}
          onClose={closeKline}
          preloadEnabled={scene.klineEnabled && appState === 'active'}
          visible={klineOpen}
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
      <PerpsProTransferSheet
        available={transfer.editor?.available ?? '0'}
        onClose={transfer.close}
        onConfirm={transfer.confirm}
        pending={transfer.pending}
        visible={!!transfer.editor}
      />
      <PerpsProCancelConfirmationModal
        confirmation={cancelOrders.confirmation}
        onCancel={cancelOrders.dismissConfirmation}
        onConfirm={cancelOrders.confirmCancellation}
      />
      <PerpsProCloseAllConfirmationModal
        confirmation={closeAll.confirmation}
        onCancel={closeAll.dismissConfirmation}
        onConfirm={closeAll.confirmCloseAll}
      />
      <PerpsProLeverageSheet
        currentLeverage={positionActions.leverageEditor?.position.leverage ?? 1}
        maxLeverage={positionActions.leverageEditor?.position.maxLeverage ?? 1}
        onClose={positionActions.closeLeverageEditor}
        onConfirm={positionActions.updateLeverage}
        pending={leverageUpdate.pending}
        visible={!!positionActions.leverageEditor}
      />
      {positionActions.closeEditor ? (
        <PerpsProClosePositionSheet
          amountUnit={trade.amountUnit}
          market={positionActions.closeEditor.market}
          onClose={positionActions.closeCloseEditor}
          onReview={positionActions.reviewClose}
          position={positionActions.closeEditor.position}
          coveredByReview={!!positionActions.closeReview}
          visible
        />
      ) : null}
      {positionActions.closeEditor && positionActions.closeReview ? (
        <PerpsProCloseConfirmationSheet
          amountUnit={trade.amountUnit}
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
      <PerpsProOrderConfirmationSheet
        command={trade.review}
        estimatedLiquidation={trade.estimatedLiquidation}
        market={trade.market}
        onClose={trade.closeReview}
        onConfirm={trade.confirmReview}
        onToggleSkip={() => trade.setSkipConfirmation(value => !value)}
        pending={trade.pending}
        skipConfirmation={trade.skipConfirmation}
      />
    </PerpsProFieldExplanationProvider>
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
  infoTabsOverlay: {
    height: 34,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  infoTabsSpacer: { height: 34 },
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
    alignItems: 'flex-start',
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
