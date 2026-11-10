import { Text } from '@/components/Typography';
import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';
import { useActiveAssetSubscription } from '@/hooks/perps/subscriptions/useActiveAssetSubscription';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  createContext,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Keyboard,
  Pressable,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { triggerPerpsProLightHaptic } from '../components/common/triggerPerpsProLightHaptic';
import { PerpsProSceneSkeleton } from '../components/loading/PerpsProSceneSkeleton';
import { PerpsProOrderConfirmationSheet } from '../components/trade/PerpsProOrderConfirmationSheet';
import { PerpsProTradeForm } from '../components/trade/PerpsProTradeForm';
import {
  getPerpsProColumnLayout,
  PERPS_PRO_MAIN_COLUMN_HEIGHT,
} from '../model/layout';
import type { PerpsProLeverageConfiguration } from '../model/leverage';
import type { PerpsProMarketDescriptor } from '../model/market';
import type { PerpsTickOption } from '../model/orderBook';
import type { PerpsProOrderBookPriceIntent } from '../model/orderBookPriceIntent';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';
import { usePerpsProBboBook } from './usePerpsProBboBook';
import type { PerpsProLeverageUpdateRequest } from './usePerpsProLeverageUpdate';
import { usePerpsProTrade } from './usePerpsProTrade';
import { usePerpsProLiveMarket } from './usePerpsProLiveMarket';

// Only these two leaf slots consume high-frequency trade output. The owner
// stays mounted before the tab preference hydrates; neither Scene nor its
// native list needs to subscribe to the trade controller.
const PanelContext = createContext<React.ReactNode>(null);
const ConfirmationContext = createContext<React.ReactNode>(null);

export const PerpsProTradePanelSlot = React.memo(
  function PerpsProTradePanelSlot() {
    return useContext(PanelContext);
  },
);

export const PerpsProTradeConfirmationSlot = React.memo(
  function PerpsProTradeConfirmationSlot() {
    return useContext(ConfirmationContext);
  },
);

type PerpsProTradePanelOwnerProps = React.PropsWithChildren<{
  sceneActive?: boolean;
  accountLeverageConfiguration: PerpsProLeverageConfiguration | null;
  activeAssetSubscriptionEnabled: boolean;
  addFundsMode: 'deposit' | 'swap';
  executionActive: boolean;
  isMarketLoading: boolean;
  leveragePending: boolean;
  market: PerpsProMarketDescriptor | null;
  marketDataFailed: boolean;
  onAddFunds: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onRetryMarketData: () => void;
  onSelectTickOption: (option: PerpsTickOption) => void;
  orderBookSubscriptionEnabled: boolean;
  orderBookViewportVisible?: boolean;
  precision: PerpsBookPrecision | null;
  realtimeEnabled: boolean;
  ref?: React.Ref<PerpsProTradePanelHandle>;
  selectedTickOption: PerpsTickOption | null;
  tickOptions: PerpsTickOption[];
  tradeConfigurationReady: boolean;
  updateLeverageRequest: (
    request: PerpsProLeverageUpdateRequest,
  ) => Promise<boolean>;
  width: number;
  zeroAddressLeverageBaseline: PerpsProLeverageConfiguration | null;
}>;

// The scene shares one leverage request lock with position actions. It only
// needs the refresh command, not the account feed's high-frequency snapshots.
export type PerpsProTradePanelHandle = {
  refreshActiveAssetData: () => Promise<unknown>;
};

export const PerpsProTradePanelOwner = React.memo(
  function PerpsProTradePanelOwner({
    sceneActive = true,
    accountLeverageConfiguration,
    activeAssetSubscriptionEnabled,
    addFundsMode,
    children,
    executionActive,
    isMarketLoading,
    leveragePending,
    market: marketDescriptor,
    marketDataFailed,
    onAddFunds,
    onLayout,
    onRetryMarketData,
    onSelectTickOption,
    orderBookSubscriptionEnabled,
    orderBookViewportVisible = true,
    precision,
    realtimeEnabled,
    ref,
    selectedTickOption,
    tickOptions,
    tradeConfigurationReady,
    updateLeverageRequest,
    width,
    zeroAddressLeverageBaseline,
  }: PerpsProTradePanelOwnerProps) {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const market = usePerpsProLiveMarket(marketDescriptor?.canonicalCoin ?? '');
    const { activeAssetData, refreshActiveAssetData } =
      useActiveAssetSubscription(marketDescriptor?.canonicalCoin ?? '', {
        contextEnabled: false,
        enabled: activeAssetSubscriptionEnabled,
      });
    useImperativeHandle(ref, () => ({ refreshActiveAssetData }), [
      refreshActiveAssetData,
    ]);
    const bboBook = usePerpsProBboBook({
      coin: market?.canonicalCoin ?? '',
      enabled: realtimeEnabled && tradeConfigurationReady,
    });
    const trade = usePerpsProTrade({
      accountLeverageConfiguration,
      activeAssetData,
      bboBook: bboBook.book,
      bboPrices: bboBook.prices,
      bboSessionKey: bboBook.sessionKey,
      bboStatus: bboBook.status,
      executionActive,
      leveragePending,
      market,
      tradeConfigurationReady,
      zeroAddressLeverageBaseline,
      refreshActiveAssetData,
      updateLeverageRequest,
    });
    const [mainColumnHeight, setMainColumnHeight] = useState(
      PERPS_PRO_MAIN_COLUMN_HEIGHT,
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
    const getOrderBookPriceIntent = trade.getOrderBookPriceIntent;
    const startOrderBookPriceIntent = useCallback(() => {
      const intent = getOrderBookPriceIntent();
      if (intent.type === 'dismissKeyboard') {
        Keyboard.dismiss();
      }
      return intent;
    }, [getOrderBookPriceIntent]);
    const selectOrderBookPrice = trade.selectOrderBookPrice;
    const marketKey = market?.marketKey;
    const selectCurrentMarketPrice = useCallback(
      (price: string | null, intent: PerpsProOrderBookPriceIntent) => {
        if (marketKey == null) {
          return;
        }
        const outcome = selectOrderBookPrice(price, marketKey, intent);
        if (outcome === 'accepted' || outcome === 'invalidPrice') {
          triggerPerpsProLightHaptic();
        }
      },
      [marketKey, selectOrderBookPrice],
    );
    const supportsTradePriceSelection =
      (trade.form.orderType === 'limit' && !trade.form.bboEnabled) ||
      trade.form.orderType === 'conditional';
    const supportsFocusedTpSlInteraction = trade.tpSl.focusedLeg != null;
    const orderBookPriceInteractionEnabled =
      tradeConfigurationReady &&
      (supportsTradePriceSelection || supportsFocusedTpSlInteraction);

    const panel = market ? (
      <View onLayout={onLayout}>
        <View style={[styles.columns, columnsStyle]}>
          <View style={orderBookColumnStyle}>
            <PerpsProRealtimeOrderBook
              sceneActive={sceneActive}
              amountUnit={trade.amountUnit}
              enabled={orderBookSubscriptionEnabled}
              height={mainColumnHeight}
              market={market}
              onSelectTickOption={onSelectTickOption}
              onSelectPrice={
                orderBookPriceInteractionEnabled
                  ? selectCurrentMarketPrice
                  : undefined
              }
              onSelectPriceIntentStart={startOrderBookPriceIntent}
              precision={precision}
              publicationEnabled={realtimeEnabled}
              viewportVisible={orderBookViewportVisible}
              selectedTickOption={selectedTickOption}
              tickOptions={tickOptions}
            />
          </View>
          <View onLayout={updateMainColumnHeight} style={tradeColumnStyle}>
            <PerpsProTradeForm
              sceneActive={sceneActive}
              addFundsMode={addFundsMode}
              configurationReady={tradeConfigurationReady}
              controller={trade}
              onAddFunds={onAddFunds}
            />
          </View>
        </View>
      </View>
    ) : isMarketLoading ? (
      <View onLayout={onLayout}>
        <PerpsProSceneSkeleton
          gap={gap}
          orderBookWidth={orderBookWidth}
          tradeWidth={tradeWidth}
        />
      </View>
    ) : (
      <View onLayout={onLayout} style={styles.empty}>
        <Text style={styles.emptyText}>
          {t('page.perps.pro.common.unavailable')}
        </Text>
        {marketDataFailed ? (
          <Pressable
            accessibilityLabel={t('page.perps.pro.common.retry')}
            accessibilityRole="button"
            onPress={onRetryMarketData}
            style={styles.retryButton}>
            <Text style={styles.retryText}>
              {t('page.perps.pro.common.retry')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
    const confirmation = (
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
    );

    return (
      <PanelContext.Provider value={panel}>
        <ConfirmationContext.Provider value={confirmation}>
          {children}
        </ConfirmationContext.Provider>
      </PanelContext.Provider>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  columns: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    paddingHorizontal: 16,
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
    fontWeight: '700',
    lineHeight: 18,
  },
}));
