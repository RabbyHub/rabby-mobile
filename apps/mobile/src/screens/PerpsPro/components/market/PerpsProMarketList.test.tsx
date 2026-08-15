import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockBottomSheetFlatListProps = jest.fn();
const mockRowMount = jest.fn();
const mockRowUnmount = jest.fn();
const mockScrollToOffset = jest.fn();
let mockIsLight = true;

jest.mock('@/assets2024/singleHome/empty-token.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/singleHome/empty-token-dark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      isLight: mockIsLight,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { FlatList } = require('react-native');

  return {
    BottomSheetFlatList: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        mockBottomSheetFlatListProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          scrollToOffset: mockScrollToOffset,
        }));
        return ReactModule.createElement(FlatList, {
          ...props,
        });
      },
    ),
  };
});

jest.mock('@shopify/flash-list', () => {
  throw new Error('Perps Pro must not load FlashList on the Paper path');
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('./PerpsProMarketSlotRow', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');

  return {
    PerpsProMarketSlotRow: ({
      canonicalCoin,
      marketKey,
    }: {
      canonicalCoin: string;
      marketKey: string;
    }) => {
      ReactModule.useEffect(() => {
        mockRowMount();
        return () => mockRowUnmount();
      }, []);
      const displayBase = canonicalCoin.includes(':')
        ? canonicalCoin.split(':').slice(-1)[0]
        : canonicalCoin;

      return ReactModule.createElement(
        Text,
        {
          testID: `perps-pro-market-row-${displayBase}USDC`,
        },
        marketKey,
      );
    },
  };
});

const {
  buildPerpsProMarketSlotOrders,
  reconcilePerpsProMarketSelectorProjection,
} =
  require('../../model/marketSelectorProjection') as typeof import('../../model/marketSelectorProjection');
const {
  PerpsProMarketList,
}: typeof import('./PerpsProMarketList') = require('./PerpsProMarketList');
type PerpsProMarketListHandle =
  import('./PerpsProMarketList').PerpsProMarketListHandle;
type MarketData = import('@/hooks/perps/usePerpsStore').MarketData;

const createMarketData = (index: number): MarketData => ({
  dayBaseVlm: String(index + 1),
  dayNtlVlm: String((index + 1) * 1000),
  dexId: index % 2 === 0 ? '' : 'xyz',
  displayName: `MARKET${String(index).padStart(3, '0')}`,
  funding: '0.0001',
  index,
  logoUrl: '',
  markPx: String(index + 100),
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: String(index + 100),
  minLeverage: 1,
  name:
    index % 2 === 0
      ? `MARKET${String(index).padStart(3, '0')}`
      : `xyz:MARKET${String(index).padStart(3, '0')}`,
  openInterest: '1',
  oraclePx: String(index + 100),
  premium: '0',
  prevDayPx: String(index + 99),
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 2,
});

const marketData = Array.from({ length: 296 }, (_, index) =>
  createMarketData(index),
);
const projection = reconcilePerpsProMarketSelectorProjection(marketData);
const slotOrders = buildPerpsProMarketSlotOrders(projection, 'all', [], '');
const slots = slotOrders.name.asc;

const renderMarketList = (
  data: typeof slots,
  ref?: React.Ref<PerpsProMarketListHandle>,
  searchMode = false,
  marketDataStatus: import('@/hooks/perps/usePerpsStore').MarketDataStatus = 'success',
  currentMarketKey: string | null = null,
) => (
  <PerpsProMarketList
    bottomInset={0}
    currentMarketKey={currentMarketKey}
    data={data}
    favoriteSet={new Set()}
    marketDataStatus={marketDataStatus}
    onSelect={jest.fn()}
    onToggleFavorite={jest.fn()}
    pageTab={searchMode ? 'search' : 'all'}
    ref={ref}
    searchMode={searchMode}
  />
);

describe('PerpsProMarketList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsLight = true;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('uses stable physical slots with business row mapping and fixed layouts', () => {
    render(renderMarketList(slots));

    const props =
      mockBottomSheetFlatListProps.mock.calls[
        mockBottomSheetFlatListProps.mock.calls.length - 1
      ][0];
    expect(props.data).toHaveLength(296);
    expect(props.initialNumToRender).toBe(10);
    expect(props.maxToRenderPerBatch).toBe(8);
    expect(props.updateCellsBatchingPeriod).toBe(16);
    expect(props.windowSize).toBe(3);
    expect(props.getItemLayout(slots, 17)).toEqual({
      index: 17,
      length: 60,
      offset: 1020,
    });
    expect(props.keyExtractor(slots[17], 17)).toBe('slot:17');
    expect(props).not.toHaveProperty('focusHook');
    expect(props).not.toHaveProperty('drawDistance');
    expect(props).not.toHaveProperty('maintainVisibleContentPosition');
    expect(props).not.toHaveProperty('onScroll');
    expect(props).not.toHaveProperty('renderScrollComponent');

    const mountedRows = screen.getAllByTestId(/perps-pro-market-row-MARKET/);
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThanOrEqual(10);
    expect(
      screen.getAllByTestId('perps-pro-market-row-separator')[0].props.style,
    ).toEqual({ height: 4 });
  });

  it('preserves physical rows across 20 independent full-catalog reversals', () => {
    const { rerender } = render(renderMarketList(slots));
    const initialMountCount = mockRowMount.mock.calls.length;

    for (let index = 0; index < 20; index += 1) {
      const nextData =
        index % 2 === 0 ? slotOrders.name.desc : slotOrders.name.asc;
      act(() => {
        rerender(renderMarketList(nextData));
      });

      expect(
        screen.getAllByTestId(/perps-pro-market-row-MARKET/).length,
      ).toBeLessThanOrEqual(10);
      expect(mockRowMount).toHaveBeenCalledTimes(initialMountCount);
      expect(mockRowUnmount).not.toHaveBeenCalled();
    }
  });

  it('keeps current-market selection semantic without a persistent visual wrapper', () => {
    const { rerender } = render(
      renderMarketList(slots, undefined, false, 'success', slots[0].marketKey),
    );
    const renderCapturedRow = (index: number) => {
      const props =
        mockBottomSheetFlatListProps.mock.calls[
          mockBottomSheetFlatListProps.mock.calls.length - 1
        ][0];
      return props.renderItem({
        index,
        item: slots[index],
        separators: {
          highlight: jest.fn(),
          unhighlight: jest.fn(),
          updateProps: jest.fn(),
        },
      });
    };

    const initialSelectedRow = renderCapturedRow(0);
    expect(initialSelectedRow.props.marketKey).toBe(slots[0].marketKey);
    expect(initialSelectedRow.props.selected).toBe(true);
    expect(initialSelectedRow.props.style).toBeUndefined();

    rerender(
      renderMarketList(slots, undefined, false, 'success', slots[1].marketKey),
    );

    const previousRow = renderCapturedRow(0);
    const nextSelectedRow = renderCapturedRow(1);
    expect(previousRow.props.selected).toBe(false);
    expect(previousRow.props.style).toBeUndefined();
    expect(nextSelectedRow.props.marketKey).toBe(slots[1].marketKey);
    expect(nextSelectedRow.props.selected).toBe(true);
    expect(nextSelectedRow.props.style).toBeUndefined();
  });

  it('rebinds retained slots and only unmounts trailing slots when filtering', () => {
    const { rerender } = render(renderMarketList(slots));
    const initialMountCount = mockRowMount.mock.calls.length;
    const filteredSlots = [slotOrders.name.desc[0]];

    act(() => {
      rerender(renderMarketList(filteredSlots));
    });

    expect(mockRowMount).toHaveBeenCalledTimes(initialMountCount);
    expect(mockRowUnmount).toHaveBeenCalledTimes(initialMountCount - 1);
    expect(
      screen.getByTestId('perps-pro-market-row-MARKET295USDC'),
    ).toBeTruthy();
  });

  it('skips no-op top resets and issues one reset only after leaving the top', () => {
    const listRef = React.createRef<PerpsProMarketListHandle>();
    render(renderMarketList(slots, listRef));

    expect(listRef.current?.scrollToTopIfNeeded()).toBe(false);
    expect(mockScrollToOffset).not.toHaveBeenCalled();

    fireEvent(
      screen.getByTestId('perps-pro-market-flat-list-all'),
      'scrollEndDrag',
      {
        nativeEvent: {
          contentSize: {
            height: 60 * slots.length,
            width: 320,
          },
          contentOffset: {
            x: 0,
            y: 140,
          },
          layoutMeasurement: {
            height: 560,
            width: 320,
          },
        },
      },
    );

    act(() => {
      expect(listRef.current?.scrollToTopIfNeeded()).toBe(true);
    });
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockScrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 0,
    });

    expect(listRef.current?.scrollToTopIfNeeded()).toBe(false);
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('matches the search result inset and the approved light empty state', () => {
    render(renderMarketList([], undefined, true));

    const props =
      mockBottomSheetFlatListProps.mock.calls[
        mockBottomSheetFlatListProps.mock.calls.length - 1
      ][0];
    expect(props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingTop: 16 })]),
    );
    expect(
      screen.getByTestId('perps-pro-market-search-empty-light').props,
    ).toEqual(expect.objectContaining({ height: 126, width: 163 }));
    expect(
      screen.getByTestId('perps-pro-market-search-empty').props.style,
    ).toEqual(expect.objectContaining({ paddingTop: 64 }));
    expect(
      screen.getByText('page.perps.pro.marketSelector.empty').props.style,
    ).toEqual(
      expect.objectContaining({
        color: 'neutral-info',
        fontFamily: 'SF Pro',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
        marginTop: 12,
      }),
    );
  });

  it('uses the dark empty asset and preserves the loading state contract', () => {
    mockIsLight = false;
    const darkRender = render(renderMarketList([], undefined, true));
    expect(
      screen.getByTestId('perps-pro-market-search-empty-dark'),
    ).toBeTruthy();
    darkRender.unmount();

    render(renderMarketList([], undefined, true, 'loading'));
    expect(screen.queryByTestId('perps-pro-market-search-empty')).toBeNull();
    expect(
      screen.getByText('page.perps.pro.marketSelector.loading'),
    ).toBeTruthy();
  });
});
