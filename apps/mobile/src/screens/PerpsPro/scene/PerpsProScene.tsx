import { Text } from '@/components/Typography';
import type { PerpsQuoteAsset } from '@/constant/perps';
import { useTheme2024 } from '@/hooks/theme';
import { useActiveAssetSubscription } from '@/hooks/perps/subscriptions/useActiveAssetSubscription';
import {
  PERPS_REGION_ALERT_HEADER_SPACING,
  PERPS_REGION_ALERT_HORIZONTAL_MARGIN,
  PerpsRegionAlert,
  type PerpsRegionAlertLayout,
} from '@/screens/Perps/components/PerpsRegionAlert';
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
  Keyboard,
  Pressable,
  useWindowDimensions,
  View,
  type AppStateStatus,
  type FlatList,
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
import { PerpsProEmptyState } from '../components/common/PerpsProEmptyState';
import { PerpsProFieldExplanationProvider } from '../components/common/PerpsProFieldExplanationProvider';
import {
  PerpsProSheetGlobalEdgeTarget,
  PerpsProSheetNavigationBoundary,
  usePerpsProSheetNavigationHost,
} from '../components/common/PerpsProSheetNavigationGuard';
import { usePerpsProDismissKeyboard } from '../components/common/usePerpsProDismissKeyboard';
import { PerpsProHeader } from '../components/header/PerpsProHeader';
import { PerpsProAccountSelectorLayer } from '../components/header/PerpsProAccountSelectorLayer';
import { usePerpsProHeaderCollapse } from '../components/header/usePerpsProHeaderCollapse';
import { PERPS_PRO_HEADER_HEIGHT } from '../components/header/constants';
import { PerpsProInfoTabs } from '../components/info/PerpsProInfoTabs';
import {
  createPerpsProInfoTabsTranslateY,
  getPerpsProPopulatedInfoSectionBottomPadding,
  getPerpsProInfoSectionMinimumContentHeight,
  getPerpsProInfoTabsNaturalAnchor,
  PERPS_PRO_INFO_TABS_HEIGHT,
  PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT,
} from '../components/info/perpsProInfoTabsSticky';
import {
  PerpsProMarketBarSkeleton,
  PerpsProSceneSkeleton,
} from '../components/loading/PerpsProSceneSkeleton';
import {
  PERPS_PRO_MARKET_BAR_HEIGHT,
  PerpsProMarketBar,
} from '../components/market/PerpsProMarketBar';
import {
  createPerpsProMarketTranslateY,
  createPerpsProRestrictedMarketTranslateY,
  getPerpsProMarketNaturalAnchor,
} from '../components/market/perpsProMarketSticky';
import {
  PerpsProMarketSelector,
  type PerpsProMarketSelectorHandle,
} from '../components/market/PerpsProMarketSelector';
import { PerpsProOpenOrderCard } from '../components/open-orders/PerpsProOpenOrderCard';
import { PerpsProBasicOrderEditSheet } from '../components/open-orders/PerpsProBasicOrderEditSheet';
import { PerpsProConditionalOrderEditSheet } from '../components/open-orders/PerpsProConditionalOrderEditSheet';
import { PerpsProOpenOrderEditConfirmationSheet } from '../components/open-orders/PerpsProOpenOrderEditConfirmationSheet';
import { PerpsProCancelConfirmationModal } from '../components/open-orders/PerpsProCancelConfirmationModal';
import { PerpsProOpenOrdersControls } from '../components/open-orders/PerpsProOpenOrdersControls';
import { PerpsProPositionCard } from '../components/positions/PerpsProPositionCard';
import { PerpsProCloseAllConfirmationModal } from '../components/positions/PerpsProCloseAllConfirmationModal';
import { PerpsProCloseConfirmationSheet } from '../components/positions/PerpsProCloseConfirmationSheet';
import { PerpsProClosePositionSheet } from '../components/positions/PerpsProClosePositionSheet';
import { PerpsProLeverageSheet } from '../components/positions/PerpsProLeverageSheet';
import { PerpsProManageMarginSheet } from '../components/positions/PerpsProManageMarginSheet';
import { PerpsProPositionTpSlConfirmationSheet } from '../components/positions/PerpsProPositionTpSlConfirmationSheet';
import { PerpsProPositionTpSlSheet } from '../components/positions/PerpsProPositionTpSlSheet';
import { PerpsProPositionsControls } from '../components/positions/PerpsProPositionsControls';
import { PerpsProOrderConfirmationSheet } from '../components/trade/PerpsProOrderConfirmationSheet';
import { PerpsProTradeForm } from '../components/trade/PerpsProTradeForm';
import { resolvePerpsProTradeAddFundsAction } from '../model/addFunds';
import type { PerpsAccountAssetRow } from '../model/account';
import {
  getPerpsProColumnLayout,
  PERPS_PRO_MAIN_COLUMN_HEIGHT,
} from '../model/layout';
import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import { isMatchingPartialTpSlPosition } from '../model/openOrderEdit';
import type { PerpsPositionViewModel } from '../model/position';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';
import {
  type PerpsProAccountPanelState,
  usePerpsProInfoPanel,
} from './usePerpsProInfoPanel';
import { usePerpsProScene } from './usePerpsProScene';
import { usePerpsProCancelOrders } from './usePerpsProCancelOrders';
import { usePerpsProOpenOrderEdit } from './usePerpsProOpenOrderEdit';
import { usePerpsProCloseAll } from './usePerpsProCloseAll';
import { usePerpsProBboBook } from './usePerpsProBboBook';
import { usePerpsProPositionActions } from './usePerpsProPositionActions';
import { usePerpsProPositionTpSl } from './usePerpsProPositionTpSl';
import { usePerpsProLeverageUpdate } from './usePerpsProLeverageUpdate';
import { usePerpsProManageMargin } from './usePerpsProManageMargin';
import { usePerpsProTrade } from './usePerpsProTrade';
import { usePerpsProTransfer } from './usePerpsProTransfer';
import { usePerpsFundingHistoryJournal } from '@/hooks/perps/funding/usePerpsFundingHistoryJournal';

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
  | { key: 'positions-empty'; type: 'positions-empty' }
  | { key: string; position: PerpsPositionViewModel; type: 'position' }
  | { key: 'open-orders-controls'; type: 'open-orders-controls' }
  | { key: 'open-orders-empty'; type: 'open-orders-empty' }
  | { key: string; order: PerpsOpenOrderViewModel; type: 'open-order' };

interface FundingOverlayState {
  mode: PerpsProFundingMode;
  sourceAsset?: PerpsQuoteAsset;
  targetAsset: PerpsQuoteAsset;
}

const PERPS_PRO_SCENE_BASE_LEAD_IN_HEIGHT =
  PERPS_PRO_HEADER_HEIGHT + PERPS_PRO_MARKET_BAR_HEIGHT;
const PERPS_PRO_REGION_ALERT_BOTTOM_SPACING = 4;

const isReusableRegionAlertLayout = ({
  containerWidth,
  layout,
}: {
  containerWidth: number;
  layout: PerpsRegionAlertLayout | null | undefined;
}) => {
  if (!layout || layout.height <= 0 || layout.width <= 0) {
    return false;
  }
  const expectedWidth =
    containerWidth - PERPS_REGION_ALERT_HORIZONTAL_MARGIN * 2;
  return Math.abs(layout.width - expectedWidth) <= 1;
};

export const PerpsProScene: React.FC<{
  historyEnabled?: boolean;
  initialRegionAlertLayout?: PerpsRegionAlertLayout | null;
  isModeSwitching: boolean;
  onOpenHistory?: (hasPendingFunding: boolean) => void;
  onSwitchToSimple: () => void;
}> = ({
  historyEnabled = false,
  initialRegionAlertLayout = null,
  isModeSwitching,
  onOpenHistory = () => undefined,
  onSwitchToSimple,
}) => {
  const { width } = useWindowDimensions();
  const { styles } = useTheme2024({ getStyle });
  usePerpsProSheetNavigationHost();
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
    enabled: scene.realtimeEnabled && scene.tradeConfigurationReady,
  });
  const trade = usePerpsProTrade({
    accountLeverageConfiguration: scene.accountLeverageConfiguration,
    activeAssetData: activeAsset.activeAssetData,
    bboBook: bboBook.book,
    bboPrices: bboBook.prices,
    bboSessionKey: bboBook.sessionKey,
    bboStatus: bboBook.status,
    executionActive: scene.executionActive && !isModeSwitching,
    leveragePending: leverageUpdate.pending,
    market: scene.currentMarket,
    tradeConfigurationReady: scene.tradeConfigurationReady,
    zeroAddressLeverageBaseline: scene.zeroAddressLeverageBaseline,
    refreshActiveAssetData: activeAsset.refreshActiveAssetData,
    updateLeverageRequest: leverageUpdate.update,
  });
  const info = usePerpsProInfoPanel(scene.currentMarket?.canonicalCoin ?? '');
  usePerpsFundingHistoryJournal({ enabled: scene.fundingHistoryEnabled });
  const positionActions = usePerpsProPositionActions({
    accountIdentity: info.accountIdentity,
    leveragePending: leverageUpdate.pending,
    updateLeverageRequest: leverageUpdate.update,
  });
  const manageMargin = usePerpsProManageMargin();
  const positionTpSl = usePerpsProPositionTpSl(
    info.accountIdentity,
    trade.amountUnit,
  );
  const cancelOrders = usePerpsProCancelOrders();
  const openOrderEdit = usePerpsProOpenOrderEdit(
    info.accountIdentity,
    trade.amountUnit,
  );
  const openOpenOrderEdit = openOrderEdit.open;
  const closeAll = usePerpsProCloseAll(info.accountIdentity);
  const transfer = usePerpsProTransfer(info.accountIdentity);
  const { setHideOtherSymbols } = info;
  const headerCollapse = usePerpsProHeaderCollapse();
  const marketSelectorRef = useRef<PerpsProMarketSelectorHandle>(null);
  const scrollRef = useRef<FlatList<PerpsProSceneRow>>(null);
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
  const [measuredRegionAlertLayout, setMeasuredRegionAlertLayout] =
    useState<PerpsRegionAlertLayout | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const fundingAccountIdentityRef = useRef(info.accountIdentity);

  useEffect(() => {
    if (fundingAccountIdentityRef.current === info.accountIdentity) {
      return;
    }
    fundingAccountIdentityRef.current = info.accountIdentity;
    setFundingOverlay(null);
  }, [info.accountIdentity]);
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  const consumeOrderBookPriceIntent = useCallback(() => {
    if (!trade.tpSl.focusedLeg) return false;
    Keyboard.dismiss();
    return true;
  }, [trade.tpSl.focusedLeg]);
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
    setFundingOverlay(
      targetAsset === 'USDC'
        ? { mode: 'swap', sourceAsset: 'USDC', targetAsset }
        : { mode: 'swap', targetAsset },
    );
  }, []);
  const tradeAddFundsAction = useMemo(
    () =>
      resolvePerpsProTradeAddFundsAction({
        accountMode: info.account.mode,
        quoteAsset: scene.currentMarket?.quoteAsset ?? 'USDC',
      }),
    [info.account.mode, scene.currentMarket?.quoteAsset],
  );
  const openTradeAddFunds = useCallback(
    () => setFundingOverlay(tradeAddFundsAction),
    [tradeAddFundsAction],
  );
  const openMarketSelector = useCallback(
    () => dismissKeyboardThen(() => marketSelectorRef.current?.present()),
    [dismissKeyboardThen],
  );
  const selectMarketByCoin = scene.selectMarketByCoin;
  const selectCardMarket = useCallback(
    async (coin: string) => {
      const selected = await selectMarketByCoin(coin);
      if (selected) {
        scrollRef.current?.scrollToOffset({ animated: true, offset: 0 });
      }
      return selected;
    },
    [selectMarketByCoin],
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
  const updateRegionAlertLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    const measuredWidth = Math.ceil(event.nativeEvent.layout.width);
    if (height <= 0 || measuredWidth <= 0) {
      return;
    }
    setMeasuredRegionAlertLayout(current => {
      if (
        current &&
        Math.abs(current.height - height) <= 1 &&
        Math.abs(current.width - measuredWidth) <= 1
      ) {
        return current;
      }
      return { height, width: measuredWidth };
    });
  }, []);
  const updateScrollViewportHeight = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.ceil(event.nativeEvent.layout.height);
    if (measured <= 0) {
      return;
    }
    setScrollViewportHeight(current =>
      Math.abs(current - measured) > 1 ? measured : current,
    );
  }, []);
  const showRegionAlert = !trade.hasPermission;
  const reusableMeasuredRegionAlertLayout = isReusableRegionAlertLayout({
    containerWidth: width,
    layout: measuredRegionAlertLayout,
  })
    ? measuredRegionAlertLayout
    : null;
  const reusableInitialRegionAlertLayout = isReusableRegionAlertLayout({
    containerWidth: width,
    layout: initialRegionAlertLayout,
  })
    ? initialRegionAlertLayout
    : null;
  const regionAlertLayout =
    reusableMeasuredRegionAlertLayout ?? reusableInitialRegionAlertLayout;
  const regionAlertExtent = showRegionAlert
    ? PERPS_REGION_ALERT_HEADER_SPACING +
      (regionAlertLayout?.height ?? 0) +
      PERPS_PRO_REGION_ALERT_BOTTOM_SPACING
    : 0;
  const positionedOverlaysReady = !showRegionAlert || !!regionAlertLayout;
  const sceneLeadInHeight =
    PERPS_PRO_SCENE_BASE_LEAD_IN_HEIGHT + regionAlertExtent;
  const infoTabsNaturalAnchor = getPerpsProInfoTabsNaturalAnchor({
    leadInHeight: sceneLeadInHeight,
    tradeRowHeight,
  });
  const scrollContentMinimumHeightStyle = useMemo<ViewStyle | null>(
    () =>
      scrollViewportHeight > 0
        ? {
            minHeight: getPerpsProInfoSectionMinimumContentHeight({
              infoTabsNaturalAnchor,
              marketBarHeight: PERPS_PRO_MARKET_BAR_HEIGHT,
              viewportHeight: scrollViewportHeight,
            }),
          }
        : null,
    [infoTabsNaturalAnchor, scrollViewportHeight],
  );
  const hasVisibleInfoRows =
    (info.activeInfoTab === 'account' && info.accountState === 'ready') ||
    (info.activeInfoTab === 'positions' &&
      !info.positionsEmpty &&
      info.positions.length > 0) ||
    (info.activeInfoTab === 'openOrders' &&
      !info.openOrdersEmpty &&
      info.openOrders.length > 0);
  const scrollContentTrailingSpaceStyle = useMemo<ViewStyle | null>(
    () =>
      hasVisibleInfoRows && scrollViewportHeight > 0
        ? {
            paddingBottom: getPerpsProPopulatedInfoSectionBottomPadding({
              marketBarHeight: PERPS_PRO_MARKET_BAR_HEIGHT,
              viewportHeight: scrollViewportHeight,
            }),
          }
        : null,
    [hasVisibleInfoRows, scrollViewportHeight],
  );
  const marketTranslateY = useMemo(
    () =>
      showRegionAlert
        ? createPerpsProRestrictedMarketTranslateY({
            headerMarketTranslateY: headerCollapse.marketTranslateY,
            regionAlertExtent,
          })
        : createPerpsProMarketTranslateY({
            headerMarketTranslateY: headerCollapse.marketTranslateY,
            naturalAnchorY: getPerpsProMarketNaturalAnchor({
              headerHeight: PERPS_PRO_HEADER_HEIGHT,
              regionAlertExtent: 0,
            }),
            scrollY: headerCollapse.scrollY,
          }),
    [
      headerCollapse.marketTranslateY,
      headerCollapse.scrollY,
      regionAlertExtent,
      showRegionAlert,
    ],
  );
  const regionAlertLeadInStyle = useMemo<ViewStyle | null>(
    () => (showRegionAlert ? { height: regionAlertExtent } : null),
    [regionAlertExtent, showRegionAlert],
  );
  const infoTabsTranslateY = useMemo(
    () =>
      createPerpsProInfoTabsTranslateY({
        anchorY: infoTabsNaturalAnchor,
        marketBarHeight: PERPS_PRO_MARKET_BAR_HEIGHT,
        marketTranslateY,
        scrollY: headerCollapse.scrollY,
      }),
    [headerCollapse.scrollY, marketTranslateY, infoTabsNaturalAnchor],
  );
  const openHistory = useCallback(
    () => onOpenHistory(info.pendingFundingCount > 0),
    [info.pendingFundingCount, onOpenHistory],
  );
  const isMarketLoading =
    !scene.currentMarket &&
    (scene.marketDataStatus === 'idle' ||
      scene.marketDataStatus === 'loading' ||
      scene.isResolvingMarket);
  const renderScrollLeadIn = useCallback(
    () => (
      <View testID="perps-pro-scroll-lead-in">
        <View
          style={styles.headerLeadInSpacer}
          testID="perps-pro-header-lead-in-spacer"
        />
        {showRegionAlert ? (
          <View
            style={regionAlertLeadInStyle}
            testID="perps-pro-region-alert-slot"
          />
        ) : null}
        <View
          style={styles.marketLeadInSpacer}
          testID="perps-pro-market-lead-in-spacer"
        />
      </View>
    ),
    [
      regionAlertLeadInStyle,
      showRegionAlert,
      styles.headerLeadInSpacer,
      styles.marketLeadInSpacer,
    ],
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
      if (info.positionsEmpty) {
        result.push({ key: 'positions-empty', type: 'positions-empty' });
        return result;
      }
      result.push({ key: 'positions-controls', type: 'positions-controls' });
      if (info.positions.length === 0) {
        result.push({ key: 'positions-empty', type: 'positions-empty' });
      } else {
        result.push(
          ...info.positions.map(position => ({
            key: `position:${info.accountIdentity}:${position.key}`,
            position,
            type: 'position' as const,
          })),
        );
      }
      return result;
    }

    if (info.openOrdersEmpty) {
      result.push({ key: 'open-orders-empty', type: 'open-orders-empty' });
      return result;
    }
    result.push({ key: 'open-orders-controls', type: 'open-orders-controls' });
    if (info.openOrders.length === 0) {
      result.push({ key: 'open-orders-empty', type: 'open-orders-empty' });
    } else {
      result.push(
        ...info.openOrders.map(order => ({
          key: `open-order:${info.accountIdentity}:${order.key}`,
          order,
          type: 'open-order' as const,
        })),
      );
    }
    return result;
  }, [
    info.account,
    info.accountIdentity,
    info.accountState,
    info.activeInfoTab,
    info.openOrders,
    info.openOrdersEmpty,
    info.positions,
    info.positionsEmpty,
  ]);
  const positionsByCoin = useMemo(
    () => new Map(info.positions.map(position => [position.coin, position])),
    [info.positions],
  );

  const renderItem = useCallback<ListRenderItem<PerpsProSceneRow>>(
    ({ item }) => {
      switch (item.type) {
        case 'trade':
          if (scene.currentMarket) {
            return (
              <View onLayout={updateTradeRowHeight}>
                <View style={[styles.columns, columnsStyle]}>
                  <View style={orderBookColumnStyle}>
                    <PerpsProRealtimeOrderBook
                      amountUnit={trade.amountUnit}
                      enabled={scene.orderBookSubscriptionEnabled}
                      height={mainColumnHeight}
                      market={scene.currentMarket}
                      onSelectTickOption={scene.selectTickOption}
                      onSelectPrice={
                        scene.tradeConfigurationReady &&
                        ((trade.form.orderType === 'limit' &&
                          !trade.form.bboEnabled) ||
                          trade.form.orderType === 'conditional')
                          ? price =>
                              trade.selectOrderBookPrice(
                                price,
                                scene.currentMarket!.marketKey,
                              )
                          : undefined
                      }
                      onSelectPriceIntentStart={consumeOrderBookPriceIntent}
                      precision={scene.precision}
                      publicationEnabled={scene.realtimeEnabled}
                      selectedTickOption={scene.selectedTickOption}
                      tickOptions={scene.tickOptions}
                    />
                  </View>
                  <View
                    onLayout={updateMainColumnHeight}
                    style={tradeColumnStyle}>
                    <PerpsProTradeForm
                      addFundsMode={tradeAddFundsAction.mode}
                      configurationReady={scene.tradeConfigurationReady}
                      controller={trade}
                      onAddFunds={openTradeAddFunds}
                    />
                  </View>
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
        case 'positions-empty':
          return (
            <PerpsProEmptyState
              message={t('page.perps.pro.positions.empty')}
              testID="perps-pro-positions-empty"
            />
          );
        case 'position':
          return (
            <PerpsProPositionCard
              accountIdentity={info.accountIdentity}
              onClose={positionActions.openCloseEditor}
              onEditLeverage={positionActions.openLeverageEditor}
              onEditTpSl={positionTpSl.open}
              onManageMargin={manageMargin.open}
              onPressMarket={selectCardMarket}
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
        case 'open-orders-empty':
          return (
            <PerpsProEmptyState
              message={t('page.perps.pro.openOrders.empty')}
              testID="perps-pro-open-orders-empty"
            />
          );
        case 'open-order': {
          const editPosition = positionsByCoin.get(item.order.coin) ?? null;
          return (
            <PerpsProOpenOrderCard
              amountUnit={trade.amountUnit}
              cancelPending={cancelOrders.isOrderPending(item.order.oid)}
              editEnabled={
                item.order.editKind === 'basicLimit' ||
                isMatchingPartialTpSlPosition(item.order, editPosition)
              }
              onCancel={cancelOrders.confirmCancelOrder}
              onEdit={order => openOpenOrderEdit(order, editPosition)}
              onPressMarket={selectCardMarket}
              order={item.order}
            />
          );
        }
      }
    },
    [
      columnsStyle,
      cancelOrders,
      closeAll.pending,
      closeAll.requestCloseAll,
      consumeOrderBookPriceIntent,
      gap,
      info,
      isMarketLoading,
      mainColumnHeight,
      manageMargin.open,
      openDeposit,
      openTradeAddFunds,
      openSwap,
      openWithdraw,
      orderBookColumnStyle,
      orderBookWidth,
      scene,
      positionActions.openLeverageEditor,
      positionActions.openCloseEditor,
      positionTpSl.open,
      openOpenOrderEdit,
      positionsByCoin,
      selectCardMarket,
      styles,
      t,
      toggleHideOtherSymbols,
      tradeColumnStyle,
      tradeWidth,
      trade,
      tradeAddFundsAction.mode,
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
          contentContainerStyle={[
            styles.scrollContent,
            scrollContentMinimumHeightStyle,
            scrollContentTrailingSpaceStyle,
          ]}
          data={rows}
          initialNumToRender={8}
          keyExtractor={item => item.key}
          keyboardShouldPersistTaps="handled"
          onLayout={updateScrollViewportHeight}
          onScroll={headerCollapse.onScroll}
          ref={scrollRef}
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
            showBottomDivider
          />
        </Animated.View>
        {showRegionAlert ? (
          <Animated.View
            style={[
              styles.regionAlertOverlay,
              {
                transform: [{ translateY: headerCollapse.marketTranslateY }],
              },
            ]}
            testID="perps-pro-region-alert-overlay">
            <PerpsRegionAlert
              bottomSpacing={PERPS_PRO_REGION_ALERT_BOTTOM_SPACING}
              onLayout={updateRegionAlertLayout}
              topSpacing={PERPS_REGION_ALERT_HEADER_SPACING}
            />
          </Animated.View>
        ) : null}
        {positionedOverlaysReady ? (
          <>
            <Animated.View
              style={[
                styles.marketOverlay,
                {
                  transform: [{ translateY: marketTranslateY }],
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
                historyEnabled={
                  historyEnabled && info.accountState !== 'noAccount'
                }
                onChange={tab => info.setActiveInfoTab(tab)}
                onHistoryPress={openHistory}
                openOrdersCount={info.allOpenOrdersCount}
                pendingFundingCount={info.pendingFundingCount}
                positionsCount={info.allPositionsCount}
              />
            </Animated.View>
          </>
        ) : null}
      </View>
      <PerpsProMarketSelector
        currentMarketKey={scene.currentMarket?.marketKey ?? null}
        onClose={scene.cancelPendingMarketSelection}
        onPrefetch={scene.prefetchMarket}
        onRealtimeIntentCancel={scene.cancelMarketRealtimeIntent}
        onRealtimeIntentStart={scene.startMarketRealtimeIntent}
        onSelect={scene.selectMarket}
        ref={marketSelectorRef}
      />
      <PerpsProAccountSelectorLayer />
      {scene.currentMarket ? (
        <PerpsProSheetNavigationBoundary
          active={klineOpen}
          dismiss={closeKline}>
          <PerpsProKlineSheet
            enabled={
              klineActivated && scene.klineEnabled && appState === 'active'
            }
            market={scene.currentMarket}
            onClose={closeKline}
            preloadEnabled={scene.klineEnabled && appState === 'active'}
            visible={klineOpen}
          />
        </PerpsProSheetNavigationBoundary>
      ) : null}
      {fundingOverlay ? (
        <PerpsProSheetNavigationBoundary
          active
          dismiss={closeFundingOverlay}
          edgeDismissible={false}>
          <PerpsProFundingOverlay
            mode={fundingOverlay.mode}
            onClose={closeFundingOverlay}
            onOpenDeposit={openDepositFromFunding}
            sourceAsset={fundingOverlay.sourceAsset}
            targetAsset={fundingOverlay.targetAsset}
          />
        </PerpsProSheetNavigationBoundary>
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
      {openOrderEdit.editor?.category === 'basic' ? (
        <PerpsProBasicOrderEditSheet
          coveredByReview={!!openOrderEdit.review}
          editor={openOrderEdit.editor}
          onClose={openOrderEdit.close}
          onReview={openOrderEdit.requestBasicReview}
          visible
        />
      ) : null}
      {openOrderEdit.editor?.category === 'conditional' ? (
        <PerpsProConditionalOrderEditSheet
          coveredByReview={!!openOrderEdit.review}
          editor={openOrderEdit.editor}
          onClose={openOrderEdit.close}
          onReview={openOrderEdit.requestConditionalReview}
          position={
            positionsByCoin.get(openOrderEdit.editor.order.coin) ??
            openOrderEdit.editor.position
          }
          visible
        />
      ) : null}
      {openOrderEdit.editor ? (
        <PerpsProOpenOrderEditConfirmationSheet
          editor={openOrderEdit.editor}
          onClose={openOrderEdit.closeReview}
          onConfirm={openOrderEdit.confirm}
          onToggleSkipConfirmation={openOrderEdit.toggleSkipConfirmation}
          pending={openOrderEdit.pending}
          review={openOrderEdit.review}
          skipConfirmation={openOrderEdit.skipConfirmation}
        />
      ) : null}
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
      {manageMargin.editor && manageMargin.view ? (
        <PerpsProManageMarginSheet
          dirty={manageMargin.dirty}
          draft={manageMargin.draft}
          onBeginEditing={manageMargin.beginEditing}
          onChangeDraft={manageMargin.changeDraft}
          onClose={manageMargin.close}
          onConfirm={manageMargin.confirm}
          onSelectTarget={manageMargin.selectTarget}
          pending={manageMargin.pending}
          view={manageMargin.view}
          visible
        />
      ) : null}
      {positionTpSl.editor ? (
        <PerpsProPositionTpSlSheet
          amountUnit={positionTpSl.editor.amountUnit}
          cancelingOids={positionTpSl.cancelingOids}
          confirmedCancelledOids={positionTpSl.confirmedCancelledOids}
          coveredByReview={!!positionTpSl.review}
          defaultTab={positionTpSl.editor.defaultTab}
          market={positionTpSl.editor.market}
          onCancelOrder={positionTpSl.cancelOrder}
          onClose={positionTpSl.close}
          onReview={positionTpSl.requestReview}
          pending={positionTpSl.pending}
          position={
            info.positions.find(
              position => position.key === positionTpSl.editor?.position.key,
            ) ?? positionTpSl.editor.position
          }
          settlement={positionTpSl.settlement}
          visible
        />
      ) : null}
      {positionTpSl.editor ? (
        <PerpsProPositionTpSlConfirmationSheet
          amountUnit={positionTpSl.editor.amountUnit}
          market={positionTpSl.editor.market}
          onClose={positionTpSl.closeReview}
          onConfirm={positionTpSl.confirm}
          onToggleSkipConfirmation={positionTpSl.toggleSkipConfirmation}
          pending={positionTpSl.pending}
          position={
            info.positions.find(
              position => position.key === positionTpSl.editor?.position.key,
            ) ?? positionTpSl.editor.position
          }
          review={positionTpSl.review}
          skipConfirmation={positionTpSl.skipConfirmation}
        />
      ) : null}
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
      <PerpsProSheetGlobalEdgeTarget />
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
    zIndex: 4,
  },
  regionAlertOverlay: {
    left: 0,
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
    height: PERPS_PRO_INFO_TABS_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  infoTabsSpacer: { height: PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT },
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
  headerLeadInSpacer: { height: PERPS_PRO_HEADER_HEIGHT },
  marketLeadInSpacer: { height: PERPS_PRO_MARKET_BAR_HEIGHT },
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
    fontFamily: 'SF Pro',
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
    fontFamily: 'SF Pro',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
}));
