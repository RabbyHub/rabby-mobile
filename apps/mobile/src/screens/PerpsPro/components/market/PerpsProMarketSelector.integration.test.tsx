import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockBottomSheetFlatListProps = jest.fn();
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockScrollToOffset = jest.fn();

jest.mock('@/assets/icons/dapp/icon-star-full.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets/icons/dapp/icon-star.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProSortArrowDown.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProSortArrowUp.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        {
          children,
          onDismiss,
        }: {
          children: React.ReactNode;
          onDismiss?: () => void;
        },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          dismiss: () => {
            mockDismiss();
            onDismiss?.();
          },
          present: mockPresent,
        }));
        return ReactModule.createElement(
          View,
          { testID: 'market-selector-sheet' },
          children,
        );
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/components2024/SearchBar', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    NextSearchBar: ({
      onChangeText,
      value,
    }: {
      onChangeText: (value: string) => void;
      value: string;
    }) =>
      ReactModule.createElement(TextInput, {
        onChangeText,
        testID: 'market-search',
        value,
      }),
  };
});

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const { create } = require('zustand');
  const createMarketData = (index: number) => {
    const name = `MARKET${String(index).padStart(3, '0')}`;
    return {
      brief: `Market ${index}`,
      categoryId: index < 20 ? 'layer-one' : undefined,
      dayBaseVlm: String(index + 1),
      dayNtlVlm: String(index + 1),
      dexId: '',
      displayName: name,
      funding: '0.0001',
      index,
      logoUrl: `https://example.test/${name}.png`,
      markPx: String(index + 100),
      maxLeverage: 20,
      maxUsdValueSize: '1000000',
      midPx: String(index + 100),
      minLeverage: 1,
      name,
      openInterest: '1',
      oraclePx: String(index + 100),
      premium: '0',
      prevDayPx: String(index + 99),
      pxDecimals: 2,
      quoteAsset: 'USDC',
      szDecimals: 2,
    };
  };
  const marketData = Array.from({ length: 296 }, (_, index) =>
    createMarketData(index),
  );
  const buildMarketDataMap = (items: ReturnType<typeof createMarketData>[]) =>
    Object.fromEntries(items.map(item => [item.name, item]));
  const initialState = {
    categories: [
      {
        id: 'layer-one',
        is_disable: false,
        name: 'Layer 1',
        priority: 1,
      },
    ],
    favoriteMarkets: ['MARKET000', 'MARKET001'],
    marketData,
    marketDataMap: buildMarketDataMap(marketData),
    marketDataStatus: 'success',
  };
  const perpsStore = create(() => initialState);

  return {
    __updateMarket: (
      canonicalCoin: string,
      patch: Partial<ReturnType<typeof createMarketData>>,
    ) => {
      perpsStore.setState((state: typeof initialState) => {
        const nextMarketData = state.marketData.map(item =>
          item.name === canonicalCoin ? { ...item, ...patch } : item,
        );
        return {
          marketData: nextMarketData,
          marketDataMap: buildMarketDataMap(nextMarketData),
        };
      }, false);
    },
    addFavoriteMarket: jest.fn(),
    perpsStore,
    removeFavoriteMarket: jest.fn(),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { FlatList, TouchableOpacity } = require('react-native');

  return {
    BottomSheetFlatList: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        mockBottomSheetFlatListProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          scrollToOffset: mockScrollToOffset,
        }));
        return ReactModule.createElement(FlatList, {
          ...props,
          testID: 'perps-pro-market-flat-list',
        });
      },
    ),
    TouchableOpacity,
  };
});

jest.mock('@shopify/flash-list', () => {
  throw new Error('Selector integration must not load FlashList');
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { pair?: string }) =>
      options?.pair ? `${key}:${options.pair}` : key,
  }),
}));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: require('react-native').ScrollView,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock('./PerpsProMarketLogo', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketLogo: ({
      logoUrl,
      marketKey,
    }: {
      logoUrl: string;
      marketKey: string;
    }) =>
      ReactModule.createElement(View, {
        accessibilityLabel: `${marketKey}:${logoUrl}`,
      }),
  };
});

const { PerpsProMarketSelector } =
  require('./PerpsProMarketSelector') as typeof import('./PerpsProMarketSelector');
type PerpsProMarketSelectorHandle =
  import('./PerpsProMarketSelector').PerpsProMarketSelectorHandle;
const { resetPerpsProMarketSessionForTests } =
  require('../../session/perpsProMarketSession') as typeof import('../../session/perpsProMarketSession');
const { __updateMarket, removeFavoriteMarket } = jest.requireMock(
  '@/hooks/perps/usePerpsStore',
) as {
  __updateMarket: (
    canonicalCoin: string,
    patch: Record<string, unknown>,
  ) => void;
  removeFavoriteMarket: jest.Mock;
};

const getLatestListProps = () =>
  mockBottomSheetFlatListProps.mock.calls[
    mockBottomSheetFlatListProps.mock.calls.length - 1
  ][0];

describe('PerpsProMarketSelector integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetPerpsProMarketSessionForTests();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('keeps the real virtualized list operable through full-catalog sorting and filtering', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const selectorRef = React.createRef<PerpsProMarketSelectorHandle>();
    render(
      <PerpsProMarketSelector
        currentMarketKey="hyperliquid::MARKET000"
        onClose={onClose}
        onSelect={onSelect}
        ref={selectorRef}
      />,
    );

    expect(mockPresent).not.toHaveBeenCalled();
    act(() => {
      selectorRef.current?.present();
    });
    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(getLatestListProps().data).toHaveLength(296);
    expect(
      screen.getAllByLabelText(/page\.perps\.pro\.marketSelector\.select:/)
        .length,
    ).toBeLessThanOrEqual(10);

    const nameSortControl = screen.getByTestId('perps-pro-market-sort-name');
    const volumeSortControl = screen.getByTestId(
      'perps-pro-market-sort-volume',
    );
    const sequence = [
      nameSortControl,
      nameSortControl,
      volumeSortControl,
      volumeSortControl,
    ];

    for (let index = 0; index < 20; index += 1) {
      act(() => {
        fireEvent.press(sequence[index % sequence.length]);
      });
      act(() => {
        jest.runOnlyPendingTimers();
      });

      expect(getLatestListProps().data).toHaveLength(296);
      expect(
        screen.getAllByLabelText(/page\.perps\.pro\.marketSelector\.select:/)
          .length,
      ).toBeLessThanOrEqual(10);
    }

    expect(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.select:MARKET000USDC',
      ).props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.removeFavorite:MARKET000USDC',
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        'hyperliquid::MARKET000:https://example.test/MARKET000.png',
      ),
    ).toBeTruthy();
    expect(screen.getByText('100.00')).toBeTruthy();
    expect(screen.getByText('+1.01%')).toBeTruthy();

    const listRenderCountBeforeMarkUpdate =
      mockBottomSheetFlatListProps.mock.calls.length;
    const slotsBeforeMarkUpdate = getLatestListProps().data;
    act(() => {
      __updateMarket('MARKET000', { markPx: '150' });
    });
    expect(mockBottomSheetFlatListProps).toHaveBeenCalledTimes(
      listRenderCountBeforeMarkUpdate,
    );
    expect(getLatestListProps().data).toBe(slotsBeforeMarkUpdate);
    expect(screen.getByText('150.00')).toBeTruthy();
    expect(screen.getByText('+51.52%')).toBeTruthy();

    fireEvent(
      screen.getByTestId('perps-pro-market-flat-list'),
      'scrollEndDrag',
      {
        nativeEvent: {
          contentSize: {
            height: 70 * 296,
            width: 320,
          },
          contentOffset: {
            x: 0,
            y: 70 * 120,
          },
          layoutMeasurement: {
            height: 560,
            width: 320,
          },
        },
      },
    );
    act(() => {
      fireEvent.press(nameSortControl);
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(mockScrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 0,
    });

    act(() => {
      fireEvent.press(
        screen.getByText('page.perps.pro.marketSelector.favorites'),
      );
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getLatestListProps().data).toHaveLength(2);

    fireEvent.press(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.removeFavorite:MARKET000USDC',
      ),
      { stopPropagation: jest.fn() },
    );
    expect(removeFavoriteMarket).toHaveBeenCalledWith('MARKET000');

    act(() => {
      fireEvent.press(screen.getByText('page.perps.pro.marketSelector.all'));
    });
    act(() => {
      fireEvent.changeText(screen.getByTestId('market-search'), 'MARKET295');
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(getLatestListProps().data).toHaveLength(1);

    fireEvent.press(
      screen.getByLabelText(
        'page.perps.pro.marketSelector.select:MARKET295USDC',
      ),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalCoin: 'MARKET295',
        marketKey: 'hyperliquid::MARKET295',
      }),
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
