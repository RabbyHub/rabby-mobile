import React from 'react';
import { act, render } from '@testing-library/react-native';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import {
  perpsStore,
  type PositionAndOpenOrder,
  type MarketData,
} from '@/hooks/perps/usePerpsStore';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { PerpsPositionSection } from './PerpsPositionSection';
import { PerpsLimitOrderItem } from './PerpsLimitOrdersSection/PerpsLimitOrderItem';
import { useHomeLimitOrders } from '../hooks/useLimitOrders';
import { Text } from '@/components/Typography';

const mockPositionRender = jest.fn();
const mockOrderRender = jest.fn();
const mockLeverageMap = {};
const mockLeverageRead = jest.fn();

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    marketDataMap: {},
    openOrders: [],
  })),
}));
jest.mock('@/hooks/perps/useActiveAssetDataCache', () => ({
  useActiveAssetDataMap: (coins: string[]) => {
    mockLeverageRead(coins);
    return mockLeverageMap;
  },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (value: unknown) => value,
}));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ push: jest.fn() }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: require('react-native').View,
  Circle: require('react-native').View,
  Path: require('react-native').View,
}));
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/utils/number', () => ({
  formatUsdValue: String,
  splitNumberByStep: String,
}));
jest.mock('@/utils/perps', () => ({
  computeFilledPct: () => 0,
  computeMarginUsage: () => 0,
  isLimitOrder: (order: OpenOrder) => !order.isTrigger,
}));
jest.mock('./PerpsPositionSection/PerpsPositionItem', () => ({
  PerpsPositionItem: ({ marketData }: { marketData: MarketData }) => {
    mockPositionRender();
    return require('react').createElement(
      require('react-native').Text,
      null,
      `position:${marketData.markPx}`,
    );
  },
}));
jest.mock('./PerpsDisplayCoinName', () => ({
  PerpsDisplayCoinName: ({ item }: { item: MarketData }) => {
    mockOrderRender();
    return require('react').createElement(
      require('react-native').Text,
      null,
      `order:${item.markPx}`,
    );
  },
}));

const order = {
  coin: 'BTC',
  oid: 1,
  side: 'B',
  sz: '1',
  origSz: '1',
  limitPx: '100',
  isTrigger: false,
} as OpenOrder;
const positions = [
  { position: { coin: 'BTC', marginUsed: '100' }, openOrders: [] },
] as unknown as PositionAndOpenOrder[];
const btc = (markPx: string) => ({ name: 'BTC', markPx } as MarketData);

function HomeOrdersCount() {
  const rows = useHomeLimitOrders();
  return <Text>{`orders:${rows.length}`}</Text>;
}

it('pauses retained position/order display publication and catches up without changing source updates', () => {
  perpsStore.setState({
    marketDataMap: { BTC: btc('100') },
    openOrders: [order],
  });
  mockPositionRender.mockClear();
  mockOrderRender.mockClear();
  mockLeverageRead.mockClear();
  const scope = createStoreActivityScope({
    active: true,
    label: 'retained-simple',
  });
  const screen = render(
    <StoreActivityProvider scope={scope}>
      <PerpsPositionSection
        positionAndOpenOrders={positions}
        handleShowRiskPopup={jest.fn()}
        handleCloseRiskPopup={jest.fn()}
        handleActionApproveStatus={jest.fn()}
        onCloseAllPositions={jest.fn()}
      />
      <PerpsLimitOrderItem
        order={order}
        leverage={null}
        marginUsage={0}
        onPress={jest.fn()}
      />
      <HomeOrdersCount />
    </StoreActivityProvider>,
  );
  expect(screen.getByText('position:100')).toBeTruthy();
  expect(screen.getByText('order:100')).toBeTruthy();
  expect(screen.getByText('orders:1')).toBeTruthy();
  act(() => scope.setActive(false));
  expect(mockLeverageRead).toHaveBeenLastCalledWith([]);
  const positionRenders = mockPositionRender.mock.calls.length;
  const orderRenders = mockOrderRender.mock.calls.length;
  for (let index = 1; index <= 12; index++) {
    act(() =>
      perpsStore.setState({ marketDataMap: { BTC: btc(String(100 + index)) } }),
    );
  }
  act(() =>
    perpsStore.setState({
      openOrders: [order, { ...order, oid: 2, coin: 'ETH' }],
    }),
  );
  expect(perpsStore.getState().marketDataMap.BTC.markPx).toBe('112');
  expect(perpsStore.getState().openOrders).toHaveLength(2);
  expect(screen.getByText('position:100')).toBeTruthy();
  expect(screen.getByText('order:100')).toBeTruthy();
  expect(screen.getByText('orders:1')).toBeTruthy();
  expect(mockPositionRender).toHaveBeenCalledTimes(positionRenders);
  expect(mockOrderRender).toHaveBeenCalledTimes(orderRenders);
  act(() => scope.setActive(true));
  expect(screen.getByText('position:112')).toBeTruthy();
  expect(screen.getByText('order:112')).toBeTruthy();
  expect(screen.getByText('orders:2')).toBeTruthy();
  expect(mockLeverageRead).toHaveBeenLastCalledWith(['BTC', 'ETH']);
  expect(mockPositionRender).toHaveBeenCalledTimes(positionRenders + 1);
  expect(mockOrderRender).toHaveBeenCalledTimes(orderRenders + 1);
  screen.unmount();
  scope.dispose();
});
