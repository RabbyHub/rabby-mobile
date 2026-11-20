import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import type {
  MarketData,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { PerpsPositionItem } from './PerpsPositionItem';

const mockAvatarRender = jest.fn();

// Real memoized Item, coin-name child and liquidation tag; only peripheral
// rendering/formatting boundaries are fake. No native gesture/FPS claim.
jest.mock('@/components', () => ({
  AssetAvatar: props => {
    mockAvatarRender(props);
    return null;
  },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value}`,
  splitNumberByStep: String,
}));
jest.mock('@/utils/perps', () => ({ formatPerpsCoin: (coin: string) => coin }));
jest.mock('@/assets2024/icons/perps/IconArrowRightCC.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconTipsLightCC.svg', () => () => null);

const position = (overrides: Partial<PositionAndOpenOrder['position']> = {}) =>
  ({
    coin: 'BTC',
    marginUsed: '100',
    unrealizedPnl: '5',
    returnOnEquity: '0.05',
    liquidationPx: '80',
    entryPx: '90',
    leverage: { type: 'cross', value: 5 },
    ...overrides,
  } as PositionAndOpenOrder['position']);
const market = (overrides: Partial<MarketData> = {}) =>
  ({
    name: 'BTC',
    displayName: 'Bitcoin',
    logoUrl: 'btc.png',
    quoteAsset: 'USDC',
    markPx: '100',
    ...overrides,
  } as MarketData);
const order = (
  orderType: string,
  triggerPx: string,
  overrides: Partial<OpenOrder> = {},
) =>
  ({
    coin: 'BTC',
    oid: 1,
    orderType,
    triggerPx,
    isTrigger: true,
    isPositionTpsl: true,
    reduceOnly: true,
    ...overrides,
  } as OpenOrder);
const props = () => ({
  item: position(),
  marketData: market(),
  openOrders: [] as OpenOrder[],
  onPress: jest.fn(),
  onShowRiskPopup: jest.fn(),
});

describe('PerpsPositionItem memo and business presentation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips equal props without freezing full position, open orders or event callbacks', () => {
    const initial = props();
    const screen = render(<PerpsPositionItem {...initial} />);
    const renders = mockAvatarRender.mock.calls.length;
    screen.rerender(<PerpsPositionItem {...initial} />);
    expect(mockAvatarRender).toHaveBeenCalledTimes(renders);

    screen.rerender(
      <PerpsPositionItem
        {...initial}
        item={position({
          marginUsed: '200',
          unrealizedPnl: '-9',
          leverage: { type: 'isolated', value: 10, rawUsd: '200' },
        })}
      />,
    );
    expect(screen.getByText('$200')).toBeTruthy();
    expect(screen.getByText('-$9')).toBeTruthy();
    expect(screen.getByText('Long 10x')).toBeTruthy();
    expect(
      screen.getByText('page.perpsDetail.PerpsPosition.isolated'),
    ).toBeTruthy();

    const next = { ...initial, onPress: jest.fn(), onShowRiskPopup: jest.fn() };
    screen.rerender(<PerpsPositionItem {...next} />);
    fireEvent.press(screen.getByText('Bitcoin'));
    fireEvent.press(screen.getByText('20.00%'));
    expect(next.onPress).toHaveBeenCalledTimes(1);
    expect(next.onShowRiskPopup).toHaveBeenCalledWith('BTC');
    expect(initial.onPress).not.toHaveBeenCalled();
    expect(initial.onShowRiskPopup).not.toHaveBeenCalled();
  });

  it.each([
    ['markPx', '200', '60.00%'],
    ['displayName', 'Bitcoin renamed', 'Bitcoin renamed'],
    ['name', 'BTC renamed', 'BTC renamed'],
    ['quoteAsset', 'USDT', '/USDT'],
  ] as const)(
    'renders a %s change through real display children',
    (field, value, expected) => {
      const initial = props();
      // Empty displayName exercises the name fallback independently.
      if (field === 'name') {
        initial.marketData = market({ displayName: '' });
      }
      const screen = render(<PerpsPositionItem {...initial} />);
      screen.rerender(
        <PerpsPositionItem
          {...initial}
          marketData={{ ...initial.marketData, [field]: value }}
        />,
      );
      expect(screen.getByText(expected)).toBeTruthy();
    },
  );

  it('updates the logo and handles missing, appearing and removed metadata', () => {
    const initial = props();
    const screen = render(
      <PerpsPositionItem {...initial} marketData={undefined} />,
    );
    expect(screen.getByText('BTC')).toBeTruthy();
    expect(screen.getByText('/USDC')).toBeTruthy();
    expect(screen.queryByText('20.00%')).toBeNull();
    expect(mockAvatarRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ logo: '' }),
    );
    screen.rerender(<PerpsPositionItem {...initial} />);
    expect(screen.getByText('Bitcoin')).toBeTruthy();
    expect(screen.getByText('20.00%')).toBeTruthy();
    screen.rerender(
      <PerpsPositionItem
        {...initial}
        marketData={market({ logoUrl: 'new.png' })}
      />,
    );
    expect(mockAvatarRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ logo: 'new.png' }),
    );
    screen.rerender(<PerpsPositionItem {...initial} marketData={undefined} />);
    expect(screen.getByText('BTC')).toBeTruthy();
    expect(screen.queryByText('20.00%')).toBeNull();
  });

  it('uses the first qualifying TP/SL with every original flag required', () => {
    const initial = props();
    const orders = [
      order('Take Profit Market', '111', { isTrigger: false }),
      order('Take Profit Market', '112', { isPositionTpsl: false }),
      order('Take Profit Market', '113', { reduceOnly: false }),
      order('Take Profit Limit', '114'),
      order('Take Profit Market', '120'),
      order('Take Profit Market', '130'),
      order('Stop Market', '81', { isTrigger: false }),
      order('Stop Market', '82', { isPositionTpsl: false }),
      order('Stop Market', '83', { reduceOnly: false }),
      order('Stop Limit', '84'),
      order('Stop Market', '85'),
      order('Stop Market', '86'),
    ];
    const screen = render(
      <PerpsPositionItem {...initial} openOrders={orders} />,
    );
    expect(screen.getByText('$120')).toBeTruthy();
    expect(screen.getByText('$85')).toBeTruthy();
    for (const value of [
      '111',
      '112',
      '113',
      '114',
      '130',
      '81',
      '82',
      '83',
      '84',
      '86',
    ]) {
      expect(screen.queryByText(`$${value}`)).toBeNull();
    }
    expect(screen.queryByText('20.00%')).toBeNull();
    screen.rerender(
      <PerpsPositionItem
        {...initial}
        openOrders={[order('Take Profit Market', '140')]}
      />,
    );
    expect(screen.getByText('$140')).toBeTruthy();
    expect(screen.queryByText('$120')).toBeNull();
    expect(screen.queryByText('$85')).toBeNull();
    expect(screen.getByText('20.00%')).toBeTruthy();
    fireEvent.press(screen.getByText('20.00%'));
    expect(initial.onShowRiskPopup).toHaveBeenCalledWith('BTC');
  });

  it('keeps zero-trigger truthiness and reads the latest raw coin for risk actions', () => {
    const initial = props();
    const screen = render(
      <PerpsPositionItem
        {...initial}
        openOrders={[
          order('Take Profit Market', '0'),
          order('Stop Market', '0'),
        ]}
      />,
    );
    expect(screen.queryByText('$0')).toBeNull();
    expect(screen.getByText('20.00%')).toBeTruthy();
    screen.rerender(
      <PerpsPositionItem
        {...initial}
        item={position({ coin: 'xyz:BTC', liquidationPx: '120' })}
      />,
    );
    expect(screen.getByText('Short 5x')).toBeTruthy();
    fireEvent.press(screen.getByText('20.00%'));
    expect(initial.onShowRiskPopup).toHaveBeenLastCalledWith('xyz:BTC');
  });
});
