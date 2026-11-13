import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';
import { useMemoizedFn } from 'ahooks';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { preloadSimpleChart } from '@/hooks/perps/candles/preloadSimpleChart';
import { PerpsMarketItem } from './PerpsMarketItem';

// Keep the real memoized row and PerpsDisplayCoinName. Peripheral rendering,
// formatting and chart preloading are outside this component's update contract.
const mockRenderAvatar = jest.fn();

jest.mock('@/components', () => ({
  AssetAvatar: () => {
    mockRenderAvatar();
    return null;
  },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components2024/Favorite', () => ({ FavoriteTag: () => null }));
jest.mock('@/assets2024/icons/home/favorite.svg', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({ colors2024: {}, isLight: true }),
    colors2024: {},
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));
jest.mock('@/utils/perps', () => ({ formatPerpsCoin: (coin: string) => coin }));
jest.mock('@/utils/number', () => ({ splitNumberByStep: String }));
jest.mock('@/screens/Home/utils/price', () => ({ formatUsdValueKMB: String }));
jest.mock('@/hooks/perps/candles/preloadSimpleChart', () => ({
  preloadSimpleChart: jest.fn(),
}));

const market = (overrides: Partial<MarketData> = {}): MarketData => ({
  index: 0,
  name: 'BTC',
  displayName: 'Bitcoin',
  logoUrl: '',
  quoteAsset: 'USDC',
  dexId: '',
  maxLeverage: 20,
  minLeverage: 1,
  maxUsdValueSize: '100000',
  maintenanceMarginTiers: [],
  szDecimals: 2,
  pxDecimals: 2,
  dayBaseVlm: '1',
  dayNtlVlm: '200',
  funding: '0',
  markPx: '100',
  midPx: '100',
  openInterest: '1',
  oraclePx: '100',
  premium: '0',
  prevDayPx: '80',
  ...overrides,
});

describe('PerpsMarketItem visible data memoization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates a display-name-only metadata change through the real name child', () => {
    const item = market();
    const onPress = jest.fn();
    const screen = render(<PerpsMarketItem item={item} onPress={onPress} />);
    expect(screen.getByText('Bitcoin')).toBeTruthy();

    screen.rerender(
      <PerpsMarketItem
        item={{ ...item, displayName: 'Bitcoin updated' }}
        onPress={onPress}
      />,
    );
    expect(screen.queryByText('Bitcoin')).toBeNull();
    expect(screen.getByText('Bitcoin updated')).toBeTruthy();
    expect(screen.getByText('$100')).toBeTruthy();
    expect(screen.getByText('/USDC')).toBeTruthy();
    expect(mockRenderAvatar).toHaveBeenCalledTimes(2);

    screen.rerender(
      <PerpsMarketItem item={{ ...item, displayName: '' }} onPress={onPress} />,
    );
    expect(screen.queryByText('Bitcoin updated')).toBeNull();
    expect(screen.getByText('BTC')).toBeTruthy();
  });

  it.each([
    {
      field: 'markPx',
      value: '110',
      price: '$110',
      change: '+37.50%',
      volume: '200',
    },
    {
      field: 'prevDayPx',
      value: '50',
      price: '$100',
      change: '+100.00%',
      volume: '200',
    },
    {
      field: 'dayNtlVlm',
      value: '300',
      price: '$100',
      change: '+25.00%',
      volume: '300',
    },
  ] as const)(
    'updates the visible $field value without changing row identity',
    testCase => {
      const item = market();
      const screen = render(<PerpsMarketItem item={item} />);
      screen.rerender(
        <PerpsMarketItem
          item={{ ...item, [testCase.field]: testCase.value }}
        />,
      );
      expect(screen.getByText('Bitcoin')).toBeTruthy();
      expect(screen.getByText(testCase.price)).toBeTruthy();
      expect(screen.getByText(testCase.change)).toBeTruthy();
      expect(screen.getByText(`VOL: ${testCase.volume}`)).toBeTruthy();
      expect(mockRenderAvatar).toHaveBeenCalledTimes(2);
    },
  );

  it('uses the latest externally stable callback even when the row skips a render', () => {
    function RowHost({
      item,
      onSelect,
    }: {
      item: MarketData;
      onSelect: () => void;
    }) {
      // HomeMarketQuote provides this same stable callback contract.
      const onPress = useMemoizedFn(onSelect);
      return <PerpsMarketItem item={item} onPress={onPress} />;
    }
    const item = market();
    const first = jest.fn();
    const latest = jest.fn();
    const screen = render(<RowHost item={item} onSelect={first} />);
    const row = screen.UNSAFE_getByType(TouchableOpacity);
    fireEvent(row, 'pressIn');
    expect(preloadSimpleChart).toHaveBeenLastCalledWith('BTC');
    expect(first).not.toHaveBeenCalled();
    fireEvent.press(row);
    expect(first).toHaveBeenCalledTimes(1);

    screen.rerender(
      <RowHost item={{ ...item, funding: '0.1' }} onSelect={latest} />,
    );
    expect(mockRenderAvatar).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.UNSAFE_getByType(TouchableOpacity));
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledTimes(1);
    expect(preloadSimpleChart).toHaveBeenCalledTimes(3);
    expect(preloadSimpleChart).toHaveBeenLastCalledWith('BTC');
  });
});
