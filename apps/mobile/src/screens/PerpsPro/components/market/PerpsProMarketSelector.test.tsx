import { act, fireEvent, render, screen } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockBottomSheetModalProps = jest.fn();
const mockMarketListProps = jest.fn();
const mockScrollToTopIfNeeded = jest.fn();
const mockMarkDismissed = jest.fn();
const mockMarkPresent = jest.fn();
const mockMakeBottomSheetProps = jest.fn(() => ({}));
const mockPagerSetPage = jest.fn();
const mockPagerSetPageWithoutAnimation = jest.fn();
let mockSelectorIsIOS = true;

jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockSelectorIsIOS;
  },
}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: { View: ReactNative.View },
    Easing: { bezier: jest.fn(() => jest.fn()) },
    ReduceMotion: { System: 'system' },
    cancelAnimation: jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    withTiming: (target: number) => target,
  };
});

jest.mock('./PerpsProMarketPager', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketPager: ReactModule.forwardRef(
      (
        {
          children,
          onPagePreview,
          onPageSelected,
          ...props
        }: {
          children: React.ReactNode;
          onPagePreview: (position: number | null) => void;
          onPageSelected: (position: number) => void;
        },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          setPage: mockPagerSetPage,
          setPageWithoutAnimation: mockPagerSetPageWithoutAnimation,
        }));
        return ReactModule.createElement(
          View,
          { ...props, onPagePreview, onPageSelected },
          children,
        );
      },
    ),
  };
});

jest.mock('@/assets2024/icons/perps/PerpsProSortArrowDown.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'sort-arrow-down',
    });
});

jest.mock('@/assets2024/icons/perps/PerpsProSortArrowUp.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'sort-arrow-up',
    });
});

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        props: {
          children: React.ReactNode;
          [key: string]: unknown;
        },
        ref: React.Ref<unknown>,
      ) => {
        const { children, ...modalProps } = props;
        mockBottomSheetModalProps(modalProps);
        ReactModule.useImperativeHandle(ref, () => ({
          dismiss: mockDismiss,
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

jest.mock('@/hooks/lang', () => ({
  useAppLanguage: () => ({ currentLanguage: 'en-US' }),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: (props: object) => mockMakeBottomSheetProps(props),
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

jest.mock('./PerpsProMarketSearchBar', () => {
  const ReactModule = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  return {
    PerpsProMarketSearchBar: ReactModule.forwardRef(
      (
        {
          onChangeText,
          onFocusChange,
          placeholder,
          style,
          value,
        }: {
          onChangeText: (value: string) => void;
          onFocusChange: (focused: boolean) => void;
          placeholder: string;
          style: object;
          value: string;
        },
        ref: React.Ref<unknown>,
      ) => {
        const [focused, setFocused] = ReactModule.useState(false);
        const focus = () => {
          setFocused(true);
          onFocusChange(true);
        };
        const blur = () => {
          setFocused(false);
          onFocusChange(false);
        };
        ReactModule.useImperativeHandle(ref, () => ({
          blur,
          clear: () => undefined,
          focus,
        }));
        return ReactModule.createElement(
          View,
          {
            accessibilityLabel: placeholder,
            style,
            testID: 'perps-pro-market-search-container',
          },
          ReactModule.createElement(TextInput, {
            onBlur: blur,
            onChangeText,
            onFocus: focus,
            testID: 'market-search',
            value,
          }),
          focused
            ? ReactModule.createElement(
                Pressable,
                {
                  onPress: () => {
                    onChangeText('');
                    blur();
                  },
                  testID: 'market-search-cancel',
                },
                ReactModule.createElement(Text, null, 'Cancel'),
              )
            : null,
        );
      },
    ),
  };
});

jest.mock('./usePerpsProMarketSelectorDismiss', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketSelectorDismissProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
    PerpsProMarketSelectorGestureContainer: ({
      children,
    }: {
      children: React.ReactNode;
    }) => ReactModule.createElement(View, null, children),
    usePerpsProMarketSelectorDismiss: ({
      windowHeight,
    }: {
      windowHeight: number;
    }) => ({
      markDismissed: mockMarkDismissed,
      markPresent: mockMarkPresent,
      stableWindowHeight: windowHeight,
    }),
  };
});

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const initialMarketData = [
    {
      dayBaseVlm: '100',
      dayNtlVlm: '1000000',
      categoryId: '',
      dexId: '',
      displayName: 'BTC',
      funding: '0.0001',
      index: 0,
      logoUrl: '',
      markPx: '64000',
      maxLeverage: 40,
      maxUsdValueSize: '1000000',
      midPx: '64000',
      minLeverage: 1,
      name: 'BTC',
      openInterest: '1',
      oraclePx: '64000',
      premium: '0',
      prevDayPx: '63000',
      pxDecimals: 0,
      quoteAsset: 'USDC',
      szDecimals: 5,
    },
    {
      dayBaseVlm: '200',
      dayNtlVlm: '2000000',
      categoryId: '',
      dexId: '',
      displayName: 'ETH',
      funding: '0.0002',
      index: 1,
      logoUrl: '',
      markPx: '3200',
      maxLeverage: 25,
      maxUsdValueSize: '1000000',
      midPx: '3200',
      minLeverage: 1,
      name: 'ETH',
      openInterest: '2',
      oraclePx: '3200',
      premium: '0',
      prevDayPx: '3100',
      pxDecimals: 1,
      quoteAsset: 'USDC',
      szDecimals: 4,
    },
    {
      dayBaseVlm: '50',
      dayNtlVlm: '500000',
      categoryId: '',
      dexId: '',
      displayName: 'SOL',
      funding: '0.0003',
      index: 2,
      logoUrl: '',
      markPx: '180',
      maxLeverage: 20,
      maxUsdValueSize: '1000000',
      midPx: '180',
      minLeverage: 1,
      name: 'SOL',
      openInterest: '3',
      oraclePx: '180',
      premium: '0',
      prevDayPx: '175',
      pxDecimals: 2,
      quoteAsset: 'USDC',
      szDecimals: 2,
    },
  ];
  const state = {
    categories: [] as Array<{
      id: string;
      is_disable: boolean;
      name: string;
      priority: number;
      translations: Record<string, string>;
    }>,
    favoriteMarkets: [],
    marketData: [...initialMarketData],
    marketDataMap: Object.fromEntries(
      initialMarketData.map(item => [item.name, item]),
    ),
    marketDataStatus: 'success',
  };
  const perpsStore = Object.assign(
    jest.fn((selector: (current: typeof state) => unknown) => selector(state)),
    {
      getState: () => state,
    },
  );

  return {
    __resetMarketData: () => {
      state.marketData = [...initialMarketData];
      state.marketDataMap = Object.fromEntries(
        state.marketData.map(item => [item.name, item]),
      );
    },
    __setMarketData: (marketData: typeof initialMarketData) => {
      state.marketData = marketData;
      state.marketDataMap = Object.fromEntries(
        marketData.map(item => [item.name, item]),
      );
    },
    __setFavoriteMarkets: (favoriteMarkets: string[]) => {
      state.favoriteMarkets = favoriteMarkets;
    },
    __setCategories: (categories: typeof state.categories) => {
      state.categories = categories;
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
  const { TouchableOpacity } = require('react-native');
  return {
    TouchableOpacity,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

jest.mock('./PerpsProMarketList', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    PerpsProMarketList: ReactModule.forwardRef(
      (
        props: {
          data: {
            canonicalCoin: string;
            marketKey: string;
            slotKey: string;
          }[];
          onSelect: (marketKey: string) => void;
          pageTab: string;
          renderProfile: 'active' | 'prepared';
        },
        ref: React.Ref<unknown>,
      ) => {
        mockMarketListProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          scrollToTopIfNeeded: mockScrollToTopIfNeeded,
        }));
        return ReactModule.createElement(
          View,
          {
            testID: `perps-pro-market-list-${props.pageTab}`,
          },
          props.data.slice(0, 10).map(slot => {
            const { perpsStore } = require('@/hooks/perps/usePerpsStore');
            const source =
              perpsStore.getState().marketDataMap[slot.canonicalCoin];
            const displayBase = source?.displayName.includes(':')
              ? source.displayName.split(':').slice(-1)[0]
              : source?.displayName;
            const displayPair = source
              ? `${displayBase}${source.quoteAsset}`
              : null;
            return displayPair
              ? ReactModule.createElement(
                  Pressable,
                  {
                    key: slot.slotKey,
                    onPress: () => props.onSelect(slot.marketKey),
                    testID: `market-row-${displayPair}`,
                  },
                  ReactModule.createElement(Text, null, displayPair),
                )
              : null;
          }),
        );
      },
    ),
  };
});

const { PerpsProMarketSelector } =
  require('./PerpsProMarketSelector') as typeof import('./PerpsProMarketSelector');
const { resetPerpsProMarketSessionForTests } =
  require('../../session/perpsProMarketSession') as typeof import('../../session/perpsProMarketSession');
type MarketData = import('@/hooks/perps/usePerpsStore').MarketData;
type PerpsProMarketSelectorHandle =
  import('./PerpsProMarketSelector').PerpsProMarketSelectorHandle;
const {
  __resetMarketData,
  __setCategories,
  __setFavoriteMarkets,
  __setMarketData,
} = jest.requireMock('@/hooks/perps/usePerpsStore') as {
  __resetMarketData: () => void;
  __setCategories: (
    categories: Array<{
      id: string;
      is_disable: boolean;
      name: string;
      priority: number;
      translations: Record<string, string>;
    }>,
  ) => void;
  __setFavoriteMarkets: (favoriteMarkets: string[]) => void;
  __setMarketData: (marketData: MarketData[]) => void;
};
const { perpsStore: mockPerpsStore } = jest.requireMock(
  '@/hooks/perps/usePerpsStore',
) as {
  perpsStore: {
    getState: () => {
      marketData: MarketData[];
      marketDataMap: Record<string, MarketData>;
    };
  };
};

const createAllTabMarketData = () =>
  Array.from({ length: 296 }, (_, index): MarketData => {
    const name = `MARKET${String(index).padStart(3, '0')}`;
    return {
      dayBaseVlm: String(index + 1),
      dayNtlVlm: String(index + 1),
      dexId: '',
      displayName: name,
      funding: '0.0001',
      index,
      logoUrl: '',
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
  });

const getRowsFromListProps = (props: {
  data: { canonicalCoin: string; marketKey: string }[];
}) =>
  props.data.map(slot => {
    const source = mockPerpsStore.getState().marketDataMap[slot.canonicalCoin];
    if (!source) {
      throw new Error(`Missing selector row for ${slot.marketKey}`);
    }
    const displayBase = source.displayName.includes(':')
      ? source.displayName.split(':').slice(-1)[0]
      : source.displayName;
    const volume = Number(source.dayNtlVlm);
    return {
      displayPair: `${displayBase}${source.quoteAsset}`,
      volume24h:
        source.dayNtlVlm !== '' && Number.isFinite(volume) && volume >= 0
          ? volume
          : null,
    };
  });

const getLatestMarketListProps = (pageTab: string = 'all') => {
  const call = [...mockMarketListProps.mock.calls]
    .reverse()
    .find(([props]) => props.pageTab === pageTab);
  if (!call) {
    throw new Error(`Missing rendered ${pageTab} market list`);
  }
  return call[0];
};

describe('PerpsProMarketSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectorIsIOS = true;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
    __resetMarketData();
    __setCategories([]);
    __setFavoriteMarkets([]);
    resetPerpsProMarketSessionForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prewarms while closed and presents synchronously only through its ref', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const selectorRef = React.createRef<PerpsProMarketSelectorHandle>();
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
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
    expect(mockMarkPresent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('market-selector-sheet')).toBeTruthy();
    expect(screen.getAllByTestId('sort-arrow-up')).toHaveLength(2);
    expect(screen.getAllByTestId('sort-arrow-down')).toHaveLength(2);

    fireEvent.press(screen.getByTestId('market-row-BTCUSDC'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalCoin: 'BTC',
        displayPair: 'BTCUSDC',
      }),
    );
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    const modalProps =
      mockBottomSheetModalProps.mock.calls[
        mockBottomSheetModalProps.mock.calls.length - 1
      ][0];
    act(() => {
      modalProps.onDismiss();
    });
    expect(mockMarkDismissed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mounts adjacent tab content and commits pager selection', () => {
    __setFavoriteMarkets(['BTC']);
    render(
      <PerpsProMarketSelector currentMarketKey={null} onSelect={jest.fn()} />,
    );

    expect(screen.getByTestId('perps-pro-market-list-all')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-market-list-favorites')).toBeTruthy();
    expect(getLatestMarketListProps('all').renderProfile).toBe('active');
    expect(getLatestMarketListProps('favorites').renderProfile).toBe(
      'prepared',
    );
    fireEvent.press(screen.getByTestId('perps-pro-market-tab-favorites'));
    expect(mockPagerSetPage).toHaveBeenCalledWith(0);
    expect(mockPagerSetPageWithoutAnimation).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pageSelected', 0);

    expect(
      screen.getByTestId('perps-pro-market-tab-favorites').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(getLatestMarketListProps('favorites').renderProfile).toBe('active');
    expect(getLatestMarketListProps('all').renderProfile).toBe('prepared');
  });

  it('keeps a distant page jump direct while requesting indicator motion', () => {
    __setCategories([
      {
        id: 'category-a',
        is_disable: false,
        name: 'Category A',
        priority: 0,
        translations: {},
      },
      {
        id: 'category-b',
        is_disable: false,
        name: 'Category B',
        priority: 1,
        translations: {},
      },
      {
        id: 'category-c',
        is_disable: false,
        name: 'Category C',
        priority: 2,
        translations: {},
      },
    ]);
    __setMarketData(
      mockPerpsStore.getState().marketData.map((market, index) => ({
        ...market,
        categoryId: `category-${String.fromCharCode(97 + index)}`,
      })),
    );
    render(
      <PerpsProMarketSelector currentMarketKey={null} onSelect={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-tab-category-c'));

    expect(mockPagerSetPage).not.toHaveBeenCalled();
    expect(mockPagerSetPageWithoutAnimation).toHaveBeenCalledWith(3, true);
    expect(
      screen.getByTestId('perps-pro-market-tab-category-c').props
        .accessibilityState,
    ).toEqual({ selected: true });
  });

  it('previews the swipe target without feeding it back into pager state', () => {
    __setFavoriteMarkets(['BTC']);
    render(
      <PerpsProMarketSelector currentMarketKey={null} onSelect={jest.fn()} />,
    );
    const pager = screen.getByTestId('perps-pro-market-pager');

    expect(pager.props.initialPage).toBe(1);
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(pager, 'pagePreview', 0);
    expect(
      screen.getByTestId('perps-pro-market-tab-favorites').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByTestId('perps-pro-market-pager').props.initialPage).toBe(
      1,
    );
    expect(mockPagerSetPage).not.toHaveBeenCalled();
    expect(mockPagerSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(getLatestMarketListProps('all').renderProfile).toBe('active');
    expect(getLatestMarketListProps('favorites').renderProfile).toBe(
      'prepared',
    );

    fireEvent(screen.getByTestId('market-search'), 'focus');
    expect(
      screen.queryByText('page.perps.pro.marketSelector.favorites'),
    ).toBeNull();
    expect(screen.queryByTestId('perps-pro-market-pager')).toBeNull();
    expect(getLatestMarketListProps('search').renderProfile).toBe('active');
    fireEvent.press(screen.getByTestId('market-search-cancel'));
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pagePreview', 1);
    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pagePreview', 0);
    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pageSelected', 0);
    expect(
      screen.getByTestId('perps-pro-market-tab-favorites').props
        .accessibilityState,
    ).toEqual({ selected: true });

    const modalProps =
      mockBottomSheetModalProps.mock.calls[
        mockBottomSheetModalProps.mock.calls.length - 1
      ][0];
    const indicatorPosition = screen.getByTestId('perps-pro-market-pager').props
      .indicatorPosition as { value: number };
    indicatorPosition.value = 0.25;
    act(() => {
      modalProps.onDismiss();
    });
    expect(mockPagerSetPageWithoutAnimation).toHaveBeenCalledWith(1);
    expect(indicatorPosition.value).toBe(1);
    expect(
      screen.getByTestId('perps-pro-market-tab-all').props.accessibilityState,
    ).toEqual({ selected: true });
  });

  it('prepares the following iOS neighbor at preview time for consecutive swipes', () => {
    __setFavoriteMarkets(['BTC']);
    __setCategories([
      {
        id: 'category-a',
        is_disable: false,
        name: 'Category A',
        priority: 0,
        translations: {},
      },
      {
        id: 'category-b',
        is_disable: false,
        name: 'Category B',
        priority: 1,
        translations: {},
      },
      {
        id: 'category-c',
        is_disable: false,
        name: 'Category C',
        priority: 2,
        translations: {},
      },
    ]);
    __setMarketData(
      mockPerpsStore.getState().marketData.map((market, index) => ({
        ...market,
        categoryId: `category-${String.fromCharCode(97 + index)}`,
      })),
    );
    render(
      <PerpsProMarketSelector currentMarketKey={null} onSelect={jest.fn()} />,
    );
    const pager = screen.getByTestId('perps-pro-market-pager');

    expect(pager.props.initialPage).toBe(1);
    expect(screen.getByTestId('perps-pro-market-list-category-a')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-market-list-category-b')).toBeNull();

    fireEvent(pager, 'pagePreview', 2);
    expect(screen.getByTestId('perps-pro-market-list-category-b')).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-market-list-favorites')).toBeNull();
    expect(screen.getByTestId('perps-pro-market-pager').props.initialPage).toBe(
      1,
    );
    expect(mockPagerSetPage).not.toHaveBeenCalled();
    expect(mockPagerSetPageWithoutAnimation).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pageSelected', 2);
    expect(
      screen.getByTestId('perps-pro-market-tab-category-a').props
        .accessibilityState,
    ).toEqual({ selected: true });
    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pagePreview', 3);
    expect(screen.getByTestId('perps-pro-market-list-category-c')).toBeTruthy();
  });

  it('keeps Android list preparation centered on the settled tab', () => {
    mockSelectorIsIOS = false;
    __setFavoriteMarkets(['BTC']);
    __setCategories([
      {
        id: 'category-a',
        is_disable: false,
        name: 'Category A',
        priority: 0,
        translations: {},
      },
      {
        id: 'category-b',
        is_disable: false,
        name: 'Category B',
        priority: 1,
        translations: {},
      },
    ]);
    __setMarketData(
      mockPerpsStore.getState().marketData.map((market, index) => ({
        ...market,
        categoryId: index === 0 ? 'category-a' : 'category-b',
      })),
    );
    render(
      <PerpsProMarketSelector currentMarketKey={null} onSelect={jest.fn()} />,
    );

    fireEvent(screen.getByTestId('perps-pro-market-pager'), 'pagePreview', 2);
    expect(screen.queryByTestId('perps-pro-market-list-category-b')).toBeNull();
  });

  it('keeps the selector open until an asynchronous market preparation commits', async () => {
    let resolveSelection!: (value: boolean) => void;
    const onSelect = jest.fn(
      () =>
        new Promise<boolean>(resolve => {
          resolveSelection = resolve;
        }),
    );
    render(
      <PerpsProMarketSelector
        currentMarketKey="hyperliquid::BTC"
        onSelect={onSelect}
      />,
    );

    fireEvent.press(screen.getByTestId('market-row-ETHUSDC'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalCoin: 'ETH' }),
    );
    expect(mockDismiss).not.toHaveBeenCalled();

    await act(async () => {
      resolveSelection(true);
      await Promise.resolve();
    });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('forwards bounded visible-row prefetch through the market list', () => {
    const onPrefetch = jest.fn();
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onPrefetch={onPrefetch}
        onSelect={jest.fn()}
      />,
    );

    const marketListProps = getLatestMarketListProps('all');
    marketListProps.onPrefetch('SUI');
    expect(onPrefetch).toHaveBeenCalledWith('SUI');
  });

  it('resets transient query and tab state on dismiss without resetting sort', () => {
    __setFavoriteMarkets(['BTC']);
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-sort-name'));
    fireEvent.press(screen.getByTestId('perps-pro-market-sort-name'));
    fireEvent.press(
      screen.getByText('page.perps.pro.marketSelector.favorites'),
    );
    fireEvent(screen.getByTestId('market-search'), 'focus');
    expect(
      getRowsFromListProps(
        mockMarketListProps.mock.calls[
          mockMarketListProps.mock.calls.length - 1
        ][0],
      ).map(market => market.displayPair),
    ).toEqual(['ETHUSDC', 'BTCUSDC', 'SOLUSDC']);
    fireEvent.changeText(screen.getByTestId('market-search'), 'usdc');

    expect(screen.queryByTestId('market-row-ETHUSDC')).toBeTruthy();
    expect(
      getRowsFromListProps(
        mockMarketListProps.mock.calls[
          mockMarketListProps.mock.calls.length - 1
        ][0],
      ).map(market => market.displayPair),
    ).toEqual(['ETHUSDC', 'BTCUSDC', 'SOLUSDC']);
    expect(
      screen.queryByText('page.perps.pro.marketSelector.favorites'),
    ).toBeNull();
    expect(screen.queryByTestId('perps-pro-market-column-header')).toBeNull();
    expect(screen.queryByTestId('perps-pro-market-sort-name')).toBeNull();
    expect(screen.queryByTestId('perps-pro-market-sort-volume')).toBeNull();
    expect(
      mockMarketListProps.mock.calls[
        mockMarketListProps.mock.calls.length - 1
      ][0].searchMode,
    ).toBe(true);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-search-results').props.style,
      ),
    ).toMatchObject({ flex: 1, paddingTop: 16 });

    const modalProps =
      mockBottomSheetModalProps.mock.calls[
        mockBottomSheetModalProps.mock.calls.length - 1
      ][0];
    act(() => {
      modalProps.onDismiss();
    });

    expect(screen.getByTestId('market-search').props.value).toBe('');
    const marketListProps = getLatestMarketListProps('all');
    expect(
      getRowsFromListProps(marketListProps).map(market => market.displayPair),
    ).toEqual(['SOLUSDC', 'ETHUSDC', 'BTCUSDC']);
    expect(marketListProps.searchMode).toBe(false);
    expect(screen.getByTestId('perps-pro-market-column-header')).toBeTruthy();
  });

  it('hides Favorites without an effective favorite and restores the prior tab after Cancel', () => {
    const emptyFavoritesRender = render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(
      screen.queryByText('page.perps.pro.marketSelector.favorites'),
    ).toBeNull();
    emptyFavoritesRender.unmount();

    __setFavoriteMarkets(['DELISTED']);
    const staleFavoritesRender = render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );
    expect(
      screen.queryByText('page.perps.pro.marketSelector.favorites'),
    ).toBeNull();
    staleFavoritesRender.unmount();

    __setFavoriteMarkets(['BTC']);
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );
    fireEvent.press(
      screen.getByText('page.perps.pro.marketSelector.favorites'),
    );
    fireEvent(screen.getByTestId('market-search'), 'focus');
    fireEvent.changeText(screen.getByTestId('market-search'), 'eth');

    expect(screen.queryByTestId('market-row-ETHUSDC')).toBeTruthy();
    fireEvent.press(screen.getByTestId('market-search-cancel'));

    const marketListProps = getLatestMarketListProps('favorites');
    expect(
      getRowsFromListProps(marketListProps).map(market => market.displayPair),
    ).toEqual(['BTCUSDC']);
    expect(
      screen.getByText('page.perps.pro.marketSelector.favorites'),
    ).toBeTruthy();
    expect(marketListProps.searchMode).toBe(false);
    expect(screen.getByTestId('perps-pro-market-column-header')).toBeTruthy();
  });

  it('matches the Figma header spacing and keeps 44pt gesture-aware sort targets', () => {
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const modalProps =
      mockBottomSheetModalProps.mock.calls[
        mockBottomSheetModalProps.mock.calls.length - 1
      ][0];
    expect(modalProps.enableContentPanningGesture).toBe(false);
    expect(modalProps.enablePanDownToClose).toBe(true);
    expect(modalProps.keyboardBehavior).toBe('extend');
    expect(modalProps.keyboardBlurBehavior).toBe('restore');
    expect(modalProps.android_keyboardInputMode).toBe('adjustPan');
    expect(modalProps.backdropProps.pressBehavior).toBe('close');
    expect(mockMakeBottomSheetProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ linearGradientType: 'bg1' }),
    );

    const sheetStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-selector-content').props.style,
    );
    expect(sheetStyle).toEqual(
      expect.objectContaining({
        flex: 1,
        paddingTop: 0,
      }),
    );
    const searchStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-search-container').props.style,
    );
    expect(searchStyle).toEqual(
      expect.objectContaining({
        marginLeft: 15,
        marginRight: 15,
        marginTop: 0,
      }),
    );

    const headerStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-column-header').props.style,
    );
    expect(headerStyle).toEqual(
      expect.objectContaining({
        height: 46,
        paddingTop: 2,
      }),
    );

    ['name', 'volume'].forEach(field => {
      const controlStyle = StyleSheet.flatten(
        screen.getByTestId(`perps-pro-market-sort-${field}`).props.style,
      );
      expect(controlStyle).toEqual(
        expect.objectContaining({
          height: 44,
          minWidth: 44,
          paddingTop: 16,
        }),
      );
    });
  });

  it('applies every rapid sort press against the latest atomic sort state', () => {
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const nameSortControl = screen.getByTestId('perps-pro-market-sort-name');
    act(() => {
      fireEvent.press(nameSortControl);
      fireEvent.press(nameSortControl);
    });

    const marketListProps =
      mockMarketListProps.mock.calls[
        mockMarketListProps.mock.calls.length - 1
      ][0];
    expect(
      getRowsFromListProps(marketListProps).map(market => market.displayPair),
    ).toEqual(['SOLUSDC', 'ETHUSDC', 'BTCUSDC']);
  });

  it('applies 20 independently committed Name/Vol presses to the full All catalog', () => {
    __setMarketData(createAllTabMarketData());
    render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const nameSortControl = screen.getByTestId('perps-pro-market-sort-name');
    const volumeSortControl = screen.getByTestId(
      'perps-pro-market-sort-volume',
    );
    const pressSequence = [
      nameSortControl,
      nameSortControl,
      volumeSortControl,
      volumeSortControl,
    ];
    const initialVolumeDescSlots = getLatestMarketListProps('all').data;
    let direction: 'asc' | 'desc' = 'desc';
    let field: 'name' | 'volume' = 'volume';

    for (let index = 0; index < 20; index += 1) {
      const control = pressSequence[index % pressSequence.length];
      const nextField = index % pressSequence.length < 2 ? 'name' : 'volume';
      const callsBeforePress = mockMarketListProps.mock.calls.length;

      act(() => {
        fireEvent.press(control);
      });

      if (field !== nextField) {
        field = nextField;
        direction = nextField === 'name' ? 'asc' : 'desc';
      } else {
        direction = direction === 'asc' ? 'desc' : 'asc';
      }

      expect(mockMarketListProps.mock.calls.length).toBeGreaterThan(
        callsBeforePress,
      );
      const marketListProps = getLatestMarketListProps('all');
      const volumes = getRowsFromListProps(marketListProps).map(
        market => market.volume24h,
      );
      const expectedVolumes = Array.from(
        { length: 296 },
        (_, marketIndex) => marketIndex + 1,
      );

      expect(marketListProps.data).toHaveLength(296);
      expect(
        marketListProps.data.map((slot: { slotKey: string }) => slot.slotKey),
      ).toEqual(
        Array.from({ length: 296 }, (_, slotIndex) => `slot:${slotIndex}`),
      );
      if (index % pressSequence.length === 2) {
        expect(marketListProps.data).toBe(initialVolumeDescSlots);
      }
      expect(volumes).toEqual(
        direction === 'asc' ? expectedVolumes : expectedVolumes.reverse(),
      );
    }
  });

  it('defers list resets until after data commit and cancels superseded frames', () => {
    const frames: FrameRequestCallback[] = [];
    const requestFrameSpy = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => {
        frames.push(callback);
        return frames.length;
      });
    const cancelFrameSpy = jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(jest.fn());

    const { unmount } = render(
      <PerpsProMarketSelector
        currentMarketKey={null}
        onClose={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const nameSortControl = screen.getByTestId('perps-pro-market-sort-name');
    act(() => {
      fireEvent.press(nameSortControl);
      fireEvent.press(nameSortControl);
    });

    expect(requestFrameSpy).toHaveBeenCalledTimes(2);
    expect(cancelFrameSpy).toHaveBeenCalledWith(1);
    expect(mockScrollToTopIfNeeded).not.toHaveBeenCalled();

    act(() => {
      frames[1](0);
    });
    expect(mockScrollToTopIfNeeded).toHaveBeenCalledTimes(1);

    unmount();
    requestFrameSpy.mockRestore();
    cancelFrameSpy.mockRestore();
  });

  it('keeps the downloaded sort glyphs free of web-only root display styles', () => {
    const assetDirectory = path.resolve(
      __dirname,
      '../../../../assets2024/icons/perps',
    );

    ['PerpsProSortArrowUp.svg', 'PerpsProSortArrowDown.svg'].forEach(file => {
      const source = fs.readFileSync(path.join(assetDirectory, file), 'utf8');
      expect(source).not.toContain('display: block');
      expect(source).toContain('fill="currentColor"');
    });
  });

  it('uses the approved English Search copy', () => {
    const localePath = path.resolve(
      __dirname,
      '../../../../assets/locales/en/messages.json',
    );
    const messages = JSON.parse(fs.readFileSync(localePath, 'utf8'));

    expect(messages.page.perps.pro.marketSelector.search).toBe('Search');
  });
});
