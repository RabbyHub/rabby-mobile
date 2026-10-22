import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import React from 'react';
import { View } from 'react-native';

import type {
  PerpsProTradeController,
  usePerpsProTrade,
} from './usePerpsProTrade';
import type { PerpsProMarket } from '../model/market';

const mockTradeInputs = jest.fn();
const mockTradeMount = jest.fn();
const mockTradeUnmount = jest.fn();
const mockFormProps = jest.fn();
const mockConfirmationProps = jest.fn();
const mockOrderBookProps = jest.fn();
const mockPlacementContext = React.createContext('scene');
const mockSubscriptions: {
  callback: (book: L2Book) => void;
  coin: string;
  unsubscribe: jest.Mock;
}[] = [];
const mockWs = {
  on: jest.fn(),
  off: jest.fn(),
  subscribeToL2Book: jest.fn(
    ({ coin }: { coin: string }, callback: (book: L2Book) => void) => {
      const unsubscribe = jest.fn();
      mockSubscriptions.push({ callback, coin, unsubscribe });
      return { unsubscribe };
    },
  ),
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: () => ({ ws: mockWs }) },
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
  PerpsProTradeConfirmationSlot,
  PerpsProTradePanelOwner,
  PerpsProTradePanelSlot,
} from './PerpsProTradePanelOwner';

const market = (coin = 'BTC') =>
  ({
    canonicalCoin: coin,
    marketKey: `hyperliquid::${coin}`,
    marketData: { maxLeverage: 40, onlyIsolated: false },
    quoteAsset: 'USDC',
  } as PerpsProMarket);

const createProps = (): React.ComponentProps<
  typeof PerpsProTradePanelOwner
> => ({
  accountLeverageConfiguration: null,
  activeAssetData: null,
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
  refreshActiveAssetData: jest.fn(async () => null),
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
