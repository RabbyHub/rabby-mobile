import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { L2Book, WsActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import React from 'react';
import { View } from 'react-native';

import type {
  PerpsProTradeController,
  usePerpsProTrade,
} from './usePerpsProTrade';
import { buildPerpsProMarketDescriptor } from '../model/market';
import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';

const mockTradeInputs = jest.fn();
const mockTradeMount = jest.fn();
const mockTradeUnmount = jest.fn();
const mockFormProps = jest.fn();
const mockConfirmationProps = jest.fn();
const mockOrderBookProps = jest.fn();
const mockPlacementContext = React.createContext('scene');
const mockSceneChildrenRender = jest.fn();
const mockGetActiveAssetData = jest.fn();
const mockAssetSubscriptions: {
  callback: (data: WsActiveAssetData) => void;
  coin: string;
  address: string;
  unsubscribe: jest.Mock;
}[] = [];
const mockSubscriptions: {
  callback: (book: L2Book) => void;
  coin: string;
  unsubscribe: jest.Mock;
}[] = [];
const mockWs = {
  on: jest.fn(),
  off: jest.fn(),
  subscribeToActiveAssetCtx: jest.fn(),
  subscribeToActiveAssetData: jest.fn(
    (
      coin: string,
      address: string,
      callback: (data: WsActiveAssetData) => void,
    ) => {
      const unsubscribe = jest.fn();
      mockAssetSubscriptions.push({ callback, coin, address, unsubscribe });
      return { unsubscribe };
    },
  ),
  subscribeToL2Book: jest.fn(
    ({ coin }: { coin: string }, callback: (book: L2Book) => void) => {
      const unsubscribe = jest.fn();
      mockSubscriptions.push({ callback, coin, unsubscribe });
      return { unsubscribe };
    },
  ),
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      ws: mockWs,
      info: { getActiveAssetData: mockGetActiveAssetData },
    }),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    currentPerpsAccount: null,
    marketData: [],
    marketDataMap: {},
  })),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({ colors2024: {} }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../components/common/triggerPerpsProLightHaptic', () => ({
  triggerPerpsProLightHaptic: jest.fn(),
}));

jest.mock('../components/loading/PerpsProSceneSkeleton', () => ({
  PerpsProSceneSkeleton: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'trade-skeleton',
    }),
}));

jest.mock('./usePerpsProTrade', () => ({
  usePerpsProTrade: function useTrade(
    props: Parameters<typeof usePerpsProTrade>[0],
  ) {
    const ReactModule = require('react') as typeof React;
    const [amount, setAmount] = ReactModule.useState('');
    const [review, setReview] = ReactModule.useState<object | null>(null);
    const [skipConfirmation, setSkipConfirmation] = ReactModule.useState(false);
    ReactModule.useEffect(() => {
      mockTradeMount();
      return () => mockTradeUnmount();
    }, []);
    mockTradeInputs(props);
    return {
      amountUnit: 'quote',
      closeReview: () => setReview(null),
      confirmReview: jest.fn(),
      estimatedLiquidation: null,
      form: { amount, bboEnabled: false, orderType: 'market' },
      getOrderBookPriceIntent: () => ({ type: 'tradePrice' }),
      market: props.market,
      pending: false,
      requestReview: () => setReview({ marketKey: props.market?.marketKey }),
      review,
      setAmount,
      setSkipConfirmation,
      skipConfirmation,
      tpSl: { focusedLeg: null },
    };
  },
}));

jest.mock('../components/trade/PerpsProTradeForm', () => ({
  PerpsProTradeForm: function Form(props: {
    controller: PerpsProTradeController;
  }) {
    const ReactModule = require('react') as typeof React;
    mockFormProps(props, ReactModule.useContext(mockPlacementContext));
    return ReactModule.createElement(require('react-native').View, {
      testID: 'trade-form',
    });
  },
}));

jest.mock('../components/trade/PerpsProOrderConfirmationSheet', () => ({
  PerpsProOrderConfirmationSheet: function Confirmation(props: object) {
    mockConfirmationProps(
      props,
      (require('react') as typeof React).useContext(mockPlacementContext),
    );
    return null;
  },
}));

jest.mock('./PerpsProRealtimeOrderBook', () => ({
  PerpsProRealtimeOrderBook: (props: object) => {
    mockOrderBookProps(props);
    return null;
  },
}));

import {
  type PerpsProTradePanelHandle,
  PerpsProTradeConfirmationSlot,
  PerpsProTradePanelOwner,
  PerpsProTradePanelSlot,
} from './PerpsProTradePanelOwner';

let fixtureId = 0;
let accountAddress: string;
const activeAssetData = (
  coin = 'BTC',
  user = accountAddress,
): WsActiveAssetData => ({
  availableToTrade: ['100', '100'],
  coin,
  leverage: { type: 'cross', value: 10 },
  markPx: '100',
  maxTradeSzs: ['100', '100'],
  user,
});

const createMarketData = (coin = 'BTC'): MarketData => ({
  name: coin,
  displayName: coin,
  dexId: '',
  index: 0,
  logoUrl: '',
  markPx: '100',
  midPx: '101',
  prevDayPx: '90',
  dayBaseVlm: '100',
  dayNtlVlm: '10000',
  funding: '0',
  openInterest: '10',
  oraclePx: '100',
  premium: '0',
  maxLeverage: 40,
  minLeverage: 1,
  maxUsdValueSize: '1000000',
  maintenanceMarginTiers: [],
  pxDecimals: 2,
  szDecimals: 3,
  onlyIsolated: false,
  quoteAsset: 'USDC',
});

const market = (coin = 'BTC') =>
  buildPerpsProMarketDescriptor(createMarketData(coin));

const publishMarkets = (items: MarketData[]) =>
  perpsStore.setState({
    marketData: items,
    marketDataMap: Object.fromEntries(items.map(item => [item.name, item])),
  });

const createProps = (): React.ComponentProps<
  typeof PerpsProTradePanelOwner
> => ({
  accountLeverageConfiguration: null,
  activeAssetSubscriptionEnabled: true,
  addFundsMode: 'deposit',
  executionActive: true,
  isMarketLoading: false,
  leveragePending: false,
  market: market(),
  marketDataFailed: false,
  onAddFunds: jest.fn(),
  onLayout: jest.fn(),
  onRetryMarketData: jest.fn(),
  onSelectTickOption: jest.fn(),
  orderBookSubscriptionEnabled: true,
  precision: null,
  realtimeEnabled: true,
  selectedTickOption: null,
  tickOptions: [],
  tradeConfigurationReady: true,
  updateLeverageRequest: jest.fn(async () => true),
  width: 393,
  zeroAddressLeverageBaseline: null,
});

const panelAndConfirmation = (
  <>
    <mockPlacementContext.Provider value="list-header">
      <PerpsProTradePanelSlot />
    </mockPlacementContext.Provider>
    <PerpsProTradeConfirmationSlot />
  </>
);

describe('PerpsProTradePanelOwner component boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptions.length = 0;
    mockAssetSubscriptions.length = 0;
    mockGetActiveAssetData.mockReset();
    mockGetActiveAssetData.mockImplementation(async (coin, address) =>
      activeAssetData(coin, address),
    );
    accountAddress = `0x${String(++fixtureId).padStart(40, '0')}`;
    perpsStore.setState({
      currentPerpsAccount: { address: accountAddress } as never,
    });
    publishMarkets([createMarketData(), createMarketData('ETH')]);
  });

  it('keeps real active-asset publications and refreshes inside one persistent owner', async () => {
    function SceneChildren() {
      mockSceneChildrenRender();
      return panelAndConfirmation;
    }
    const ref = React.createRef<PerpsProTradePanelHandle>();
    const view = render(
      <PerpsProTradePanelOwner {...createProps()} ref={ref}>
        <SceneChildren />
      </PerpsProTradePanelOwner>,
    );
    const childRenders = mockSceneChildrenRender.mock.calls.length;
    const refresh = ref.current!.refreshActiveAssetData;
    expect(mockAssetSubscriptions).toHaveLength(1);
    expect(mockAssetSubscriptions[0]).toMatchObject({
      coin: 'BTC',
      address: accountAddress,
    });
    expect(mockWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
    expect(mockTradeInputs.mock.lastCall?.[0].refreshActiveAssetData).toBe(
      refresh,
    );

    const update: WsActiveAssetData = {
      ...activeAssetData(),
      availableToTrade: ['25', '30'],
    };
    act(() => mockAssetSubscriptions[0].callback(update));
    expect(mockTradeInputs.mock.lastCall?.[0].activeAssetData).toBe(update);
    expect(mockSceneChildrenRender).toHaveBeenCalledTimes(childRenders);
    expect(mockAssetSubscriptions).toHaveLength(1);
    expect(ref.current!.refreshActiveAssetData).toBe(refresh);

    const refreshed: WsActiveAssetData = {
      ...activeAssetData(),
      maxTradeSzs: ['3', '4'],
    };
    mockGetActiveAssetData.mockResolvedValueOnce(refreshed);
    await act(async () => {
      await expect(refresh()).resolves.toBe(refreshed);
    });
    expect(mockGetActiveAssetData).toHaveBeenCalledWith('BTC', accountAddress);
    expect(mockTradeInputs.mock.lastCall?.[0].activeAssetData).toBe(refreshed);
    expect(mockSceneChildrenRender).toHaveBeenCalledTimes(childRenders);
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(ref.current).toBeNull();
    expect(mockAssetSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('refreshes the current coin and account through the same handle and rejects old-scope frames', async () => {
    const props = createProps();
    const ref = React.createRef<PerpsProTradePanelHandle>();
    const view = render(
      <PerpsProTradePanelOwner {...props} ref={ref}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    const refresh = ref.current!.refreshActiveAssetData;
    const btcSubscription = mockAssetSubscriptions[0];
    view.rerender(
      <PerpsProTradePanelOwner {...props} market={market('ETH')} ref={ref}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(btcSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockAssetSubscriptions).toHaveLength(2);
    const ethSubscription = mockAssetSubscriptions[1];
    const ethData = activeAssetData('ETH');
    act(() => ethSubscription.callback(ethData));
    act(() => btcSubscription.callback(activeAssetData()));
    expect(mockTradeInputs.mock.lastCall?.[0].activeAssetData).toBe(ethData);

    const nextAddress = `0x${String(++fixtureId).padStart(40, '0')}`;
    act(() => {
      perpsStore.setState({
        currentPerpsAccount: { address: nextAddress } as never,
      });
    });
    expect(ethSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockAssetSubscriptions).toHaveLength(3);
    expect(mockAssetSubscriptions[2]).toMatchObject({
      coin: 'ETH',
      address: nextAddress,
    });
    const nextAccountData = activeAssetData('ETH', nextAddress);
    act(() => mockAssetSubscriptions[2].callback(nextAccountData));
    act(() => ethSubscription.callback(ethData));
    expect(mockTradeInputs.mock.lastCall?.[0].activeAssetData).toBe(
      nextAccountData,
    );
    expect(ref.current!.refreshActiveAssetData).toBe(refresh);
    await act(async () => {
      await expect(refresh()).resolves.toEqual(nextAccountData);
    });
    expect(mockGetActiveAssetData).toHaveBeenLastCalledWith('ETH', nextAddress);
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    expect(mockWs.subscribeToActiveAssetCtx).not.toHaveBeenCalled();
    view.unmount();
    expect(mockAssetSubscriptions[2].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('gates the account feed independently of trade readiness and live-market availability', () => {
    publishMarkets([]);
    const props = createProps();
    const view = render(
      <PerpsProTradePanelOwner
        {...props}
        activeAssetSubscriptionEnabled={false}
        executionActive={false}
        realtimeEnabled={false}
        tradeConfigurationReady={false}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(mockAssetSubscriptions).toHaveLength(0);
    view.rerender(
      <PerpsProTradePanelOwner
        {...props}
        activeAssetSubscriptionEnabled
        executionActive={false}
        realtimeEnabled={false}
        tradeConfigurationReady={false}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(mockAssetSubscriptions).toHaveLength(1);
    expect(mockAssetSubscriptions[0].coin).toBe('BTC');
    expect(mockTradeInputs.mock.lastCall?.[0].market).toBeNull();
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mockAssetSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('publishes current prices and risk metadata inside the owner without rendering scene children', () => {
    function SceneChildren() {
      mockSceneChildrenRender();
      return panelAndConfirmation;
    }
    render(
      <PerpsProTradePanelOwner {...createProps()}>
        <SceneChildren />
      </PerpsProTradePanelOwner>,
    );
    const originalChildRenders = mockSceneChildrenRender.mock.calls.length;
    const updated: MarketData = {
      ...createMarketData(),
      displayName: 'Bitcoin',
      markPx: '123',
      midPx: '124',
      maxLeverage: 5,
      maxUsdValueSize: '500',
      onlyIsolated: true,
      marginMode: 'noCross',
      maintenanceMarginTiers: [
        {
          lowerBound: '0',
          maxLeverage: 5,
          maintenanceDeduction: '0',
          maintenanceMarginRate: '0.1',
        },
      ],
    };
    act(() => publishMarkets([updated, createMarketData('ETH')]));

    expect(mockTradeInputs.mock.lastCall?.[0].market.marketData).toBe(updated);
    expect(mockTradeInputs.mock.lastCall?.[0].market).toMatchObject({
      canonicalCoin: 'BTC',
      displayBase: 'Bitcoin',
      price: 123,
    });
    expect(mockOrderBookProps.mock.lastCall?.[0].market.marketData).toBe(
      updated,
    );
    expect(mockSceneChildrenRender).toHaveBeenCalledTimes(originalChildRenders);
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions).toHaveLength(1);
  });

  it('uses array metadata while the map converges and clears a disappeared market', () => {
    const props = createProps();
    render(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    const fallback = { ...createMarketData(), markPx: '110' };
    act(() =>
      perpsStore.setState({ marketData: [fallback], marketDataMap: {} }),
    );
    expect(mockTradeInputs.mock.lastCall?.[0].market.marketData).toBe(fallback);
    act(() => publishMarkets([]));
    expect(mockTradeInputs.mock.lastCall?.[0].market).toBeNull();
    expect(screen.queryByTestId('trade-form')).toBeNull();
    act(() => publishMarkets([fallback]));
    expect(mockTradeInputs.mock.lastCall?.[0].market.marketData).toBe(fallback);
    expect(screen.getByTestId('trade-form')).toBeOnTheScreen();
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
  });

  it('keeps controller state alive without a panel slot and renders the confirmation at its original boundary', () => {
    const props = createProps();
    const view = render(
      <PerpsProTradePanelOwner {...props}>
        <PerpsProTradeConfirmationSlot />
      </PerpsProTradePanelOwner>,
    );
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions).toHaveLength(1);
    expect(screen.queryByTestId('trade-form')).toBeNull();

    view.rerender(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    act(() => mockFormProps.mock.lastCall?.[0].controller.setAmount('123'));
    act(() => mockFormProps.mock.lastCall?.[0].controller.requestReview('buy'));
    expect(mockFormProps.mock.lastCall?.[0].controller.form.amount).toBe('123');
    expect(mockFormProps.mock.lastCall?.[1]).toBe('list-header');
    expect(mockConfirmationProps.mock.lastCall?.[1]).toBe('scene');
    expect(mockConfirmationProps.mock.lastCall?.[0].command).toEqual({
      marketKey: 'hyperliquid::BTC',
    });

    view.rerender(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
        <View testID="another-tab" />
      </PerpsProTradePanelOwner>,
    );
    expect(mockFormProps.mock.lastCall?.[0].controller.form.amount).toBe('123');
    expect(mockConfirmationProps.mock.lastCall?.[0].command).toEqual({
      marketKey: 'hyperliquid::BTC',
    });
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    expect(mockTradeUnmount).not.toHaveBeenCalled();
    expect(mockSubscriptions).toHaveLength(1);
    view.unmount();
    expect(mockTradeUnmount).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('preserves the owner through unavailable/loading markets and rejects late old-market BBO frames', () => {
    const props = createProps();
    const view = render(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    const firstSubscription = mockSubscriptions[0];
    view.rerender(
      <PerpsProTradePanelOwner {...props} isMarketLoading market={null}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(screen.getByTestId('trade-skeleton')).toBeOnTheScreen();
    expect(mockTradeInputs.mock.lastCall?.[0]).toMatchObject({
      bboStatus: 'idle',
      market: null,
    });
    view.rerender(
      <PerpsProTradePanelOwner {...props} market={market('ETH')}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    act(() =>
      firstSubscription.callback({ coin: 'BTC', levels: [[], []], time: 1 }),
    );
    expect(mockTradeInputs.mock.lastCall?.[0]).toMatchObject({
      bboBook: null,
      bboStatus: 'loading',
      market: { canonicalCoin: 'ETH' },
    });
    expect(firstSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscriptions[1].coin).toBe('ETH');
    expect(mockTradeMount).toHaveBeenCalledTimes(1);
    expect(mockTradeUnmount).not.toHaveBeenCalled();
  });

  it('passes execution and publication gates independently without delaying either', () => {
    const props = createProps();
    const view = render(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    view.rerender(
      <PerpsProTradePanelOwner
        {...props}
        executionActive={false}
        realtimeEnabled={false}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(mockTradeInputs.mock.lastCall?.[0]).toMatchObject({
      bboStatus: 'idle',
      executionActive: false,
    });
    expect(mockOrderBookProps.mock.lastCall?.[0]).toMatchObject({
      enabled: true,
      publicationEnabled: false,
    });
    expect(mockSubscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    view.rerender(
      <PerpsProTradePanelOwner {...props}>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(mockTradeInputs.mock.lastCall?.[0]).toMatchObject({
      bboStatus: 'loading',
      executionActive: true,
    });
    expect(mockSubscriptions).toHaveLength(2);
  });

  it('retains the retry and add-funds callbacks as leaf actions', () => {
    const props = createProps();
    const view = render(
      <PerpsProTradePanelOwner {...props} market={null} marketDataFailed>
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'page.perps.pro.common.retry' }),
    );
    expect(props.onRetryMarketData).toHaveBeenCalledTimes(1);
    view.rerender(
      <PerpsProTradePanelOwner {...props} addFundsMode="swap">
        {panelAndConfirmation}
      </PerpsProTradePanelOwner>,
    );
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      addFundsMode: 'swap',
      configurationReady: true,
      onAddFunds: props.onAddFunds,
    });
    act(() => mockFormProps.mock.lastCall?.[0].onAddFunds());
    expect(props.onAddFunds).toHaveBeenCalledTimes(1);
  });
});
