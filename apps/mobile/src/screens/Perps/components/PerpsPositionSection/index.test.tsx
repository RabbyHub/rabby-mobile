import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RootNames } from '@/constant/layout';
import {
  perpsStore,
  type MarketData,
  type PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { PerpsPositionSection } from './index';

const mockItemRender = jest.fn();
const mockTitleRender = jest.fn();
const mockItemMount = jest.fn();
const mockItemUnmount = jest.fn();
const mockPush = jest.fn();
const mockNavigation = { push: mockPush };
const mockMemoizedCallbacks: Array<() => unknown> = [];

// Component coverage: Section and its row selector/activity boundary are real.
// The source store is a stateful fixture and Item is intentionally NOT memoized,
// so broad Section/row publication cannot hide behind an additional item memo.
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({ marketDataMap: {} })),
}));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => mockNavigation,
}));
jest.mock('ahooks', () => {
  const actual = jest.requireActual('ahooks');
  return {
    ...actual,
    useMemoizedFn: fn => {
      const callback = actual.useMemoizedFn(fn);
      mockMemoizedCallbacks.push(callback);
      return callback;
    },
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) =>
    require('react').useMemo(() => {
      const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
      return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
    }, [getStyle]),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));
jest.mock('@/components/Typography', () => ({
  Text: props => {
    if (props.children === 'page.perps.positions') {
      mockTitleRender();
    }
    return require('react').createElement(require('react-native').Text, props);
  },
}));
jest.mock('./PerpsPositionItem', () => ({
  PerpsPositionItem: function Item(props) {
    const ReactModule = require('react');
    const { Text, View, TouchableOpacity } = require('react-native');
    const coin = props.item.coin;
    mockItemRender(props);
    ReactModule.useEffect(() => {
      mockItemMount(coin);
      return () => mockItemUnmount(coin);
    }, [coin]);
    return ReactModule.createElement(
      View,
      { testID: `position:${coin}` },
      ReactModule.createElement(
        TouchableOpacity,
        { onPress: props.onPress },
        ReactModule.createElement(
          Text,
          null,
          `${coin}:${props.item.marginUsed}`,
        ),
      ),
      ReactModule.createElement(
        TouchableOpacity,
        { onPress: () => props.onShowRiskPopup(coin) },
        ReactModule.createElement(Text, null, `risk:${coin}`),
      ),
      ReactModule.createElement(
        Text,
        null,
        `mark:${coin}:${props.marketData?.markPx ?? 'missing'}`,
      ),
    );
  },
}));

const market = (
  name: string,
  overrides: Partial<MarketData> = {},
): MarketData =>
  ({
    name,
    displayName: name,
    logoUrl: `${name}.png`,
    quoteAsset: 'USDC',
    markPx: '100',
    midPx: '101',
    ...overrides,
  } as MarketData);
const row = (coin: string, marginUsed = '100'): PositionAndOpenOrder =>
  ({
    position: { coin, marginUsed },
    openOrders: [],
  } as unknown as PositionAndOpenOrder);
const callbacks = () => ({
  handleShowRiskPopup: jest.fn(),
  handleCloseRiskPopup: jest.fn(),
  handleActionApproveStatus: jest.fn().mockResolvedValue(undefined),
  onCloseAllPositions: jest.fn().mockResolvedValue(undefined),
});
const lastItem = (coin: string) =>
  mockItemRender.mock.calls
    .filter(([props]) => props.item.coin === coin)
    .at(-1)?.[0];
const itemRenders = (coin: string) =>
  mockItemRender.mock.calls.filter(([props]) => props.item.coin === coin)
    .length;
function updateMarket(coin: string, patch: Partial<MarketData>) {
  perpsStore.setState(state => ({
    marketDataMap: {
      ...state.marketDataMap,
      [coin]: { ...state.marketDataMap[coin], ...patch },
    },
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMemoizedCallbacks.length = 0;
  perpsStore.setState({
    marketDataMap: {
      BTC: market('BTC'),
      ETH: market('ETH'),
      SOL: market('SOL'),
    },
  });
});
afterEach(() => jest.restoreAllMocks());

describe('PerpsPositionSection row-local market subscription', () => {
  it('updates BTC alone without rerendering ETH or the section header', () => {
    const screen = render(
      <PerpsPositionSection
        positionAndOpenOrders={[row('BTC'), row('ETH')]}
        {...callbacks()}
      />,
    );
    const btcRenders = itemRenders('BTC');
    const ethRenders = itemRenders('ETH');
    const titles = mockTitleRender.mock.calls.length;
    for (const markPx of ['102', '103', '104']) {
      act(() => updateMarket('BTC', { markPx }));
    }
    expect(screen.getByText('mark:BTC:104')).toBeTruthy();
    expect(screen.getByText('mark:ETH:100')).toBeTruthy();
    expect(itemRenders('BTC')).toBe(btcRenders + 3);
    expect(itemRenders('ETH')).toBe(ethRenders);
    expect(mockTitleRender).toHaveBeenCalledTimes(titles);
  });

  it('ignores unrelated markets, mid price and equal selected-field object replacements', () => {
    render(
      <PerpsPositionSection
        positionAndOpenOrders={[row('BTC'), row('ETH')]}
        {...callbacks()}
      />,
    );
    const renders = mockItemRender.mock.calls.length;
    const titles = mockTitleRender.mock.calls.length;
    act(() => updateMarket('SOL', { markPx: '999' }));
    act(() => updateMarket('BTC', { midPx: '999', funding: '0.001' }));
    act(() =>
      updateMarket('ETH', { ...perpsStore.getState().marketDataMap.ETH }),
    );
    expect(mockItemRender).toHaveBeenCalledTimes(renders);
    expect(mockTitleRender).toHaveBeenCalledTimes(titles);
  });

  it.each([
    ['markPx', '123'],
    ['logoUrl', 'new.png'],
    ['name', 'BTC canonical'],
    ['displayName', 'Bitcoin'],
    ['quoteAsset', 'USDT'],
  ] as const)(
    'publishes a %s change while keeping full position and orders references',
    (field, value) => {
      const position = row('BTC');
      render(
        <PerpsPositionSection
          positionAndOpenOrders={[position, row('ETH')]}
          {...callbacks()}
        />,
      );
      const ethRenders = itemRenders('ETH');
      act(() => updateMarket('BTC', { [field]: value }));
      expect(lastItem('BTC').marketData[field]).toBe(value);
      expect(lastItem('BTC').item).toBe(position.position);
      expect(lastItem('BTC').openOrders).toBe(position.openOrders);
      expect(Object.keys(lastItem('BTC').marketData).sort()).toEqual(
        ['name', 'displayName', 'logoUrl', 'quoteAsset', 'markPx'].sort(),
      );
      expect(itemRenders('ETH')).toBe(ethRenders);
    },
  );

  it('handles missing, newly loaded and removed market metadata without dropping the position', () => {
    perpsStore.setState({ marketDataMap: {} });
    const screen = render(
      <PerpsPositionSection
        positionAndOpenOrders={[row('BTC')]}
        {...callbacks()}
      />,
    );
    expect(screen.getByText('mark:BTC:missing')).toBeTruthy();
    expect(lastItem('BTC').marketData).toBeUndefined();
    act(() => perpsStore.setState({ marketDataMap: { BTC: market('BTC') } }));
    expect(screen.getByText('mark:BTC:100')).toBeTruthy();
    act(() => perpsStore.setState({ marketDataMap: {} }));
    expect(screen.getByText('mark:BTC:missing')).toBeTruthy();
    fireEvent.press(screen.getByText('BTC:100'));
    expect(mockPush).toHaveBeenLastCalledWith(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: { market: 'BTC' },
    });
  });

  it('sorts by numeric margin and preserves coin identity across reorder, dex names and duplicates', () => {
    const props = callbacks();
    const btc = row('BTC', '9');
    const eth = row('ETH', '20');
    const dex = row('xyz:BTC', '100');
    const duplicate = row('xyz:BTC', '3');
    const screen = render(
      <PerpsPositionSection
        positionAndOpenOrders={[btc, eth, dex, duplicate]}
        {...props}
      />,
    );
    expect(
      screen.getAllByTestId(/^position:/).map(item => item.props.testID),
    ).toEqual([
      'position:xyz:BTC',
      'position:ETH',
      'position:BTC',
      'position:xyz:BTC',
    ]);
    const mounts = mockItemMount.mock.calls.length;
    screen.rerender(
      <PerpsPositionSection
        positionAndOpenOrders={[
          { ...btc, position: { ...btc.position, marginUsed: '200' } },
          eth,
          dex,
          duplicate,
        ]}
        {...props}
      />,
    );
    expect(
      screen.getAllByTestId(/^position:/).map(item => item.props.testID),
    ).toEqual([
      'position:BTC',
      'position:xyz:BTC',
      'position:ETH',
      'position:xyz:BTC',
    ]);
    expect(mockItemMount).toHaveBeenCalledTimes(mounts);
    expect(mockItemUnmount).not.toHaveBeenCalled();
    for (const [label, coin] of [
      ['BTC:200', 'BTC'],
      ['ETH:20', 'ETH'],
      ['xyz:BTC:100', 'xyz:BTC'],
      ['xyz:BTC:3', 'xyz:BTC'],
    ]) {
      fireEvent.press(screen.getByText(label));
      expect(mockPush).toHaveBeenLastCalledWith(RootNames.StackTransaction, {
        screen: RootNames.PerpsMarketDetail,
        params: { market: coin },
      });
    }
  });

  it('keeps equal-margin order stable and refreshes risk callbacks instead of freezing them', () => {
    const positions = [row('ETH'), row('BTC')];
    const props = callbacks();
    const screen = render(
      <PerpsPositionSection positionAndOpenOrders={positions} {...props} />,
    );
    expect(
      screen.getAllByTestId(/^position:/).map(item => item.props.testID),
    ).toEqual(['position:ETH', 'position:BTC']);
    const nextRisk = jest.fn();
    screen.rerender(
      <PerpsPositionSection
        positionAndOpenOrders={positions}
        {...props}
        handleShowRiskPopup={nextRisk}
      />,
    );
    fireEvent.press(screen.getByText('risk:BTC'));
    expect(nextRisk).toHaveBeenCalledWith('BTC');
    expect(props.handleShowRiskPopup).not.toHaveBeenCalled();
  });

  it('renders nothing when positions are absent or become empty', () => {
    const props = callbacks();
    const screen = render(<PerpsPositionSection {...props} />);
    expect(screen.toJSON()).toBeNull();
    screen.rerender(
      <PerpsPositionSection {...props} positionAndOpenOrders={[row('BTC')]} />,
    );
    expect(screen.getByText('page.perps.positions')).toBeTruthy();
    screen.rerender(
      <PerpsPositionSection {...props} positionAndOpenOrders={[]} />,
    );
    expect(screen.toJSON()).toBeNull();
  });
});

describe('PerpsPositionSection Close All authorization', () => {
  it('does not confirm or close if the approval callback rejects', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rejected = new Error('approval rejected');
    const props = callbacks();
    props.handleActionApproveStatus.mockRejectedValue(rejected);
    render(
      <PerpsPositionSection {...props} positionAndOpenOrders={[row('BTC')]} />,
    );
    // Section owns the first memoized callback; its children render afterward.
    // Observe the actual callback's rejection directly, since the unchanged
    // native onPress wrapper discards its Promise. This does not claim the UI
    // event path handles that rejection or swallow it in production.
    await act(async () => {
      await expect(mockMemoizedCallbacks[0]()).rejects.toBe(rejected);
    });
    expect(props.handleActionApproveStatus).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(props.onCloseAllPositions).not.toHaveBeenCalled();
  });

  it('waits for approval, then confirms before invoking the latest close callback', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let approve!: () => void;
    const props = callbacks();
    props.handleActionApproveStatus.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          approve = resolve;
        }),
    );
    const positions = [row('BTC')];
    const screen = render(
      <PerpsPositionSection {...props} positionAndOpenOrders={positions} />,
    );
    const latestClose = jest.fn().mockResolvedValue(undefined);
    screen.rerender(
      <PerpsPositionSection
        {...props}
        positionAndOpenOrders={positions}
        onCloseAllPositions={latestClose}
      />,
    );
    fireEvent.press(screen.getByText('page.perps.closeAll'));
    expect(props.handleActionApproveStatus).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
    expect(props.onCloseAllPositions).not.toHaveBeenCalled();
    await act(async () => {
      approve();
    });
    expect(alert).toHaveBeenCalledWith(
      'page.perps.closeAllConfirmTitle',
      'page.perps.closeAllConfirmMessage',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons[0].text).toBe('global.cancel');
    expect(buttons[0].onPress).toBeUndefined();
    expect(latestClose).not.toHaveBeenCalled();
    await act(async () => {
      await buttons[1].onPress?.();
    });
    expect(latestClose).toHaveBeenCalledTimes(1);
    expect(props.onCloseAllPositions).not.toHaveBeenCalled();
  });
});
