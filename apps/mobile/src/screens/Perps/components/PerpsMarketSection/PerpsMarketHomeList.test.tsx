import React, { Profiler } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  FlatList,
  Pressable as HeaderPressable,
  RefreshControl,
  View,
} from 'react-native';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import {
  PerpsMarketHomeList,
  type PerpsMarketHomeListRef,
} from './PerpsMarketHomeList';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';

const mockNavigationListeners = {
  focus: new Set<() => void>(),
  blur: new Set<() => void>(),
};
const mockNavigation = {
  focused: true,
  isFocused: () => mockNavigation.focused,
  addListener: (event: 'focus' | 'blur', listener: () => void) => {
    mockNavigationListeners[event].add(listener);
    return () => mockNavigationListeners[event].delete(listener);
  },
};
const mockTranslate = (key: string) => key;
let mockLanguage = 'en';
const mockRenderMarketItem = jest.fn();
const mockRenderCategory = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useIsFocused: () =>
    require('react').useSyncExternalStore((listener: () => void) => {
      const focus = mockNavigation.addListener('focus', listener);
      const blur = mockNavigation.addListener('blur', listener);
      return () => {
        focus();
        blur();
      };
    }, mockNavigation.isFocused),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));
jest.mock('@/hooks/lang', () => ({
  useAppLanguage: () => ({ currentLanguage: mockLanguage }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }) => ({
    styles: getStyle.getStyles({ colors2024: {}, isLight: true }),
  }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  // Exercise real Zustand subscriptions with a bounded market fixture. Native
  // Perps services and network convergence are outside this component contract.
  perpsStore: require('zustand').create(() => ({
    marketData: [],
    marketDataMap: {},
    favoriteMarkets: [],
    categories: [],
    unrelated: 0,
  })),
}));
jest.mock('./PerpsMarketItem', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsMarketItem: ({ item, rank, onPress }) => {
      mockRenderMarketItem(item);
      return ReactModule.createElement(
        Pressable,
        { onPress, testID: `market-${rank ?? 'unranked'}-${item.name}` },
        ReactModule.createElement(
          Text,
          null,
          `${item.name}:${item.markPx}:${rank ?? 'unranked'}`,
        ),
      );
    },
  };
});
jest.mock('./PerpsCategorySectionHeader', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    PerpsCategorySectionHeader: ({ cfg }) => {
      mockRenderCategory(cfg);
      return ReactModule.createElement(
        Text,
        { testID: `category-${cfg.id}` },
        cfg.label,
      );
    },
  };
});

type MarketFixture = {
  marketData: MarketData[];
  marketDataMap: Record<string, MarketData>;
  favoriteMarkets: string[];
  categories: {
    id: string;
    name: string;
    translations?: Record<string, string>;
  }[];
  unrelated: number;
};
const mockStore = perpsStore as unknown as UseBoundStore<
  StoreApi<MarketFixture>
>;

// Production publishes the array and by-name index atomically. Preserve that
// contract in this component fixture without importing native Perps services.
function publish(partial: Partial<MarketFixture>) {
  mockStore.setState({
    ...partial,
    ...(partial.marketData
      ? {
          marketDataMap: Object.fromEntries(
            partial.marketData.map(item => [item.name, item]),
          ),
        }
      : {}),
  });
}

const market = (
  name: string,
  markPx: string,
  dayNtlVlm: string,
  categoryId = 'crypto',
) => ({ name, markPx, dayNtlVlm, categoryId } as MarketData);

function setFocused(focused: boolean) {
  act(() => {
    mockNavigation.focused = focused;
    mockNavigationListeners[focused ? 'focus' : 'blur'].forEach(listener =>
      listener(),
    );
  });
}

describe('PerpsMarketHomeList activity', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    mockNavigation.focused = true;
    mockNavigationListeners.focus.clear();
    mockNavigationListeners.blur.clear();
    mockRenderMarketItem.mockClear();
    mockRenderCategory.mockClear();
    publish({
      marketData: [market('BTC', '100', '20'), market('ETH', '10', '10')],
      favoriteMarkets: [],
      categories: [],
      unrelated: 0,
    });
  });

  it('updates a quote without republishing list structure or rendering other rows', () => {
    const onItemPress = jest.fn();
    const screen = render(<PerpsMarketHomeList onItemPress={onItemPress} />);
    const listBefore = screen.UNSAFE_getByType(FlatList).props;
    const headerRenders = mockRenderCategory.mock.calls.length;
    mockRenderMarketItem.mockClear();
    const [btc, eth] = mockStore.getState().marketData;
    act(() => {
      publish({ marketData: [{ ...btc, markPx: '105' }, eth] });
    });

    const listAfter = screen.UNSAFE_getByType(FlatList).props;
    expect(listAfter.data).toBe(listBefore.data);
    expect(mockRenderCategory).toHaveBeenCalledTimes(headerRenders);
    expect(mockRenderMarketItem).toHaveBeenCalledTimes(1);
    expect(mockRenderMarketItem.mock.calls[0][0].name).toBe('BTC');
    expect(screen.getByText('BTC:105:1')).toBeTruthy();
    expect(screen.getByText('ETH:10:2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('market-1-BTC'));
    expect(onItemPress).toHaveBeenCalledWith('BTC');
  });

  it('removes deleted markets and publishes new membership with its current quote', () => {
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    act(() => {
      publish({ marketData: [market('SOL', '25', '200')] });
    });
    expect(screen.queryByText('BTC:100:1')).toBeNull();
    expect(screen.queryByText('ETH:10:2')).toBeNull();
    expect(screen.getByText('SOL:25:1')).toBeTruthy();
    act(() => publish({ marketData: [] }));
    expect(screen.queryByText('SOL:25:1')).toBeNull();
    expect(screen.UNSAFE_getByType(FlatList).props.data).toEqual([]);
  });

  it('catches up to only the final membership and quotes after hidden removals', () => {
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    setFocused(false);
    act(() => publish({ marketData: [market('SOL', '25', '200')] }));
    act(() => {
      publish({
        marketData: [market('DOGE', '5', '500'), market('SOL', '26', '200')],
      });
    });
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    expect(screen.queryByText('SOL:25:1')).toBeNull();
    mockRenderMarketItem.mockClear();
    setFocused(true);
    expect(screen.queryByText('BTC:100:1')).toBeNull();
    expect(screen.queryByText('ETH:10:2')).toBeNull();
    expect(screen.getByText('DOGE:5:1')).toBeTruthy();
    expect(screen.getByText('SOL:26:2')).toBeTruthy();
    expect(mockRenderMarketItem.mock.calls.map(([item]) => item.name)).toEqual([
      'DOGE',
      'SOL',
    ]);
  });

  it('uses a replacement press handler without changing the quote or membership', () => {
    const previousPress = jest.fn();
    const nextPress = jest.fn();
    const screen = render(<PerpsMarketHomeList onItemPress={previousPress} />);
    const rows = screen.UNSAFE_getByType(FlatList).props.data;
    screen.rerender(<PerpsMarketHomeList onItemPress={nextPress} />);
    expect(screen.UNSAFE_getByType(FlatList).props.data).toBe(rows);
    fireEvent.press(screen.getByTestId('market-1-BTC'));
    expect(previousPress).not.toHaveBeenCalled();
    expect(nextPress).toHaveBeenCalledWith('BTC');
  });

  it('updates translated category titles without changing market keys', () => {
    publish({
      marketData: [market('BTC', '100', '20')],
      categories: [
        {
          id: 'crypto',
          name: 'Crypto',
          translations: { en: 'Crypto EN', zh: 'Crypto ZH' },
        },
      ],
    });
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    const before = screen.UNSAFE_getByType(FlatList).props;
    const keys = before.data.map(before.keyExtractor);
    expect(screen.getByText('Crypto EN')).toBeTruthy();
    mockLanguage = 'zh';
    screen.rerender(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    expect(screen.queryByText('Crypto EN')).toBeNull();
    expect(screen.getByText('Crypto ZH')).toBeTruthy();
    const after = screen.UNSAFE_getByType(FlatList).props;
    expect(after.data.map(after.keyExtractor)).toEqual(keys);
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
  });

  it('pauses hidden ticker renders, keeps the source live, then catches up once', () => {
    const onRender = jest.fn();
    const onItemPress = jest.fn();
    const screen = render(
      <Profiler id="market-list" onRender={onRender}>
        <PerpsMarketHomeList onItemPress={onItemPress} />
      </Profiler>,
    );
    expect(screen.getByText('BTC:100:1')).toBeTruthy();

    act(() => {
      publish({
        marketData: [market('BTC', '101', '20'), market('ETH', '11', '10')],
      });
    });
    expect(screen.getByText('BTC:101:1')).toBeTruthy();

    setFocused(false);
    const beforeHiddenUpdates = onRender.mock.calls.length;
    for (let tick = 1; tick <= 12; tick++) {
      act(() => {
        publish({
          marketData: [
            market('BTC', String(101 + tick), '20'),
            market('ETH', String(11 + tick), '30'),
          ],
        });
      });
    }

    expect(mockStore.getState().marketData[0].markPx).toBe('113');
    expect(onRender).toHaveBeenCalledTimes(beforeHiddenUpdates);
    expect(screen.getByText('BTC:101:1')).toBeTruthy();

    const beforeCatchUp = mockRenderMarketItem.mock.calls.length;
    setFocused(true);
    // The route/parent activity wrapper itself re-renders, but each market
    // row consumes exactly one fresh snapshot, not the hidden price history.
    expect(mockRenderMarketItem).toHaveBeenCalledTimes(beforeCatchUp + 2);
    expect(screen.getByText('ETH:23:1')).toBeTruthy();
    expect(screen.getByText('BTC:113:2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('market-1-ETH'));
    expect(onItemPress).toHaveBeenCalledWith('ETH');

    const beforeUnrelatedUpdate = onRender.mock.calls.length;
    act(() => publish({ unrelated: 1 }));
    expect(onRender).toHaveBeenCalledTimes(beforeUnrelatedUpdate);
  });

  it('publishes latest hidden favorites and translated category membership on focus', () => {
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    setFocused(false);
    act(() => {
      publish({ favoriteMarkets: ['btc'] });
    });
    act(() => {
      publish({
        favoriteMarkets: ['eth'],
        categories: [
          {
            id: 'crypto',
            name: 'Crypto',
            translations: { en: 'Crypto latest' },
          },
        ],
      });
    });
    expect(screen.queryByTestId('category-favorite')).toBeNull();
    expect(screen.queryByTestId('category-crypto')).toBeNull();

    setFocused(true);
    expect(screen.getByTestId('category-favorite')).toBeTruthy();
    // Offscreen rows belong to the list data, not the initial native window.
    // ETH remains in both favorites and its category, with independent keys.
    expect(screen.UNSAFE_getByType(FlatList).props.data).toEqual([
      expect.objectContaining({
        type: 'category',
        cfg: expect.objectContaining({ id: 'favorite' }),
      }),
      expect.objectContaining({
        type: 'market',
        marketName: 'ETH',
        rank: undefined,
      }),
      expect.objectContaining({
        type: 'category',
        cfg: expect.objectContaining({ id: 'topVolume' }),
      }),
      expect.objectContaining({
        type: 'market',
        marketName: 'BTC',
        rank: 1,
      }),
      expect.objectContaining({
        type: 'market',
        marketName: 'ETH',
        rank: 2,
      }),
      expect.objectContaining({
        type: 'category',
        cfg: expect.objectContaining({ id: 'crypto', label: 'Crypto latest' }),
      }),
      expect.objectContaining({
        type: 'market',
        marketName: 'BTC',
        rank: undefined,
      }),
      expect.objectContaining({
        type: 'market',
        marketName: 'ETH',
        rank: undefined,
      }),
    ]);
  });

  it('starts covered without a live source subscription and removes listeners on unmount', () => {
    mockNavigation.focused = false;
    const originalSubscribe = mockStore.subscribe;
    const liveSubscriptions = new Set<() => void>();
    const subscribeSpy = jest
      .spyOn(mockStore, 'subscribe')
      .mockImplementation(listener => {
        const unsubscribe = originalSubscribe(listener);
        liveSubscriptions.add(unsubscribe);
        return () => {
          liveSubscriptions.delete(unsubscribe);
          unsubscribe();
        };
      });
    let screen: ReturnType<typeof render> | undefined;
    try {
      screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
      expect(liveSubscriptions.size).toBe(0);
      act(() => {
        publish({ marketData: [market('SOL', '30', '50')] });
      });
      expect(screen.queryByText('SOL:30:1')).toBeNull();

      setFocused(true);
      expect(liveSubscriptions.size).toBe(1);
      expect(screen.getByText('SOL:30:1')).toBeTruthy();
      setFocused(false);
      expect(liveSubscriptions.size).toBe(0);
      setFocused(true);
      expect(liveSubscriptions.size).toBe(1);

      screen.unmount();
      screen = undefined;
      expect(liveSubscriptions.size).toBe(0);
      expect(mockNavigationListeners.focus.size).toBe(0);
      expect(mockNavigationListeners.blur.size).toBe(0);
    } finally {
      screen?.unmount();
      subscribeSpy.mockRestore();
    }
  });

  it('honors the enclosing retained page as well as standalone route focus', () => {
    const parentScope = createStoreActivityScope({
      active: false,
      label: 'simple-page',
    });
    const screen = render(
      <StoreActivityProvider scope={parentScope}>
        <PerpsMarketHomeList onItemPress={jest.fn()} />
      </StoreActivityProvider>,
    );
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    act(() => publish({ marketData: [market('BTC', '200', '20')] }));
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    // A focused route cannot wake a retained, hidden Simple page.
    setFocused(false);
    setFocused(true);
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    act(() => parentScope.setActive(true));
    expect(screen.getByText('BTC:200:1')).toBeTruthy();
    setFocused(false);
    act(() => publish({ marketData: [market('BTC', '300', '20')] }));
    act(() => parentScope.setActive(false));
    act(() => parentScope.setActive(true));
    expect(screen.getByText('BTC:200:1')).toBeTruthy();
    setFocused(true);
    expect(screen.getByText('BTC:300:1')).toBeTruthy();
    screen.unmount();
    parentScope.dispose();
  });

  it('bounds the initial row window without dropping a large favorites collection', () => {
    const markets = Array.from({ length: 40 }, (_, index) =>
      market(`COIN${index}`, String(index + 1), String(100 - index)),
    );
    publish({
      marketData: markets,
      favoriteMarkets: markets.map(item => item.name),
    });
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    const list = screen.UNSAFE_getByType(FlatList);
    const mountedRows = screen.getAllByTestId(/^market-/);

    // Real RN FlatList is retained in this component test. This proves its
    // bounded initial React window, not native scrolling or frame performance.
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(1);
    expect(list.props.data).toHaveLength(47); // 40 favorites + 5 top + 2 headers.
    expect(list.props.initialNumToRender).toBeGreaterThan(0);
    expect(list.props.initialNumToRender).toBeLessThanOrEqual(12);
    expect(list.props.maxToRenderPerBatch).toBeLessThanOrEqual(12);
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThanOrEqual(
      list.props.initialNumToRender,
    );
    expect(screen.queryByTestId('market-unranked-COIN39')).toBeNull();
    expect(list.props.removeClippedSubviews).toBe(false);
  });

  it('preserves category order, per-group ranks and duplicate-market keys across ticker sorting', () => {
    publish({
      marketData: [market('BTC', '100', '20'), market('ETH', '10', '30')],
      favoriteMarkets: ['btc', 'eth'],
      categories: [
        { id: 'crypto', name: 'Crypto' },
        { id: 'empty', name: 'Empty' },
      ],
    });
    const onItemPress = jest.fn();
    const screen = render(<PerpsMarketHomeList onItemPress={onItemPress} />);
    const list = screen.UNSAFE_getByType(FlatList);
    const keys = list.props.data.map(list.props.keyExtractor);
    expect(keys).toEqual([
      '["favorite"]',
      '["favorite","ETH"]',
      '["favorite","BTC"]',
      '["topVolume"]',
      '["topVolume","ETH"]',
      '["topVolume","BTC"]',
      '["crypto"]',
      '["crypto","ETH"]',
      '["crypto","BTC"]',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(screen.queryByTestId('category-empty')).toBeNull();
    fireEvent.press(screen.getByTestId('market-unranked-ETH'));
    fireEvent.press(screen.getByTestId('market-1-ETH'));
    expect(onItemPress.mock.calls).toEqual([['ETH'], ['ETH']]);

    act(() =>
      publish({
        marketData: [market('BTC', '101', '40'), market('ETH', '11', '30')],
      }),
    );
    const updated = screen.UNSAFE_getByType(FlatList).props;
    expect(new Set(updated.data.map(updated.keyExtractor))).toEqual(
      new Set(keys),
    );
    expect(screen.getByText('BTC:101:1')).toBeTruthy();
    expect(updated.data[1]).toEqual(
      expect.objectContaining({
        key: '["favorite","BTC"]',
        first: true,
        last: false,
        rank: undefined,
      }),
    );
    expect(updated.data[2]).toEqual(
      expect.objectContaining({
        key: '["favorite","ETH"]',
        first: false,
        last: true,
      }),
    );
  });

  it('keeps the header mounted and its local state when prices and category membership change', () => {
    const mount = jest.fn();
    const unmount = jest.fn();
    function Header() {
      const [count, setCount] = React.useState(0);
      React.useEffect(() => {
        mount();
        return unmount;
      }, []);
      return (
        <HeaderPressable
          testID="list-header"
          accessibilityLabel={String(count)}
          onPress={() => setCount(value => value + 1)}
        />
      );
    }
    const header = <Header />;
    const screen = render(
      <PerpsMarketHomeList onItemPress={jest.fn()} listHeader={header} />,
    );
    const firstHeader = screen.getByTestId('list-header');
    fireEvent.press(firstHeader);
    act(() =>
      publish({
        marketData: [market('BTC', '102', '50'), market('ETH', '12', '30')],
        favoriteMarkets: ['eth'],
      }),
    );
    expect(screen.getByTestId('list-header')).toBe(firstHeader);
    expect(screen.getByTestId('list-header').props.accessibilityLabel).toBe(
      '1',
    );
    expect(screen.UNSAFE_getByType(FlatList).props.ListHeaderComponent).toBe(
      header,
    );
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
    screen.unmount();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it('retains an empty list header and footer and forwards scroll, refresh, styles and scrollToTop', () => {
    publish({ marketData: [], favoriteMarkets: ['missing'] });
    const ref = React.createRef<PerpsMarketHomeListRef>();
    const onScroll = jest.fn();
    const onRefresh = jest.fn();
    const style = { flex: 1, paddingHorizontal: 12 };
    const contentContainerStyle = { paddingTop: 2 };
    const refreshControl = (
      <RefreshControl refreshing={false} onRefresh={onRefresh} />
    );
    const scrollToOffset = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => {});
    try {
      const screen = render(
        <PerpsMarketHomeList
          ref={ref}
          onItemPress={jest.fn()}
          listHeader={<View testID="empty-list-header" />}
          style={style}
          contentContainerStyle={contentContainerStyle}
          onScroll={onScroll}
          refreshControl={refreshControl}
        />,
      );
      const list = screen.UNSAFE_getByType(FlatList);
      expect(list.props.data).toEqual([]);
      expect(screen.getByTestId('empty-list-header')).toBeOnTheScreen();
      expect(list.props.style).toBe(style);
      expect(list.props.contentContainerStyle).toBe(contentContainerStyle);
      expect(list.props.onScroll).toBe(onScroll);
      expect(list.props.refreshControl).toBe(refreshControl);
      expect(list.props.ListFooterComponent.props.style).toEqual({
        height: 40,
      });
      fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
      expect(onRefresh).toHaveBeenCalledTimes(1);
      act(() => ref.current?.scrollToTop());
      expect(scrollToOffset).toHaveBeenCalledTimes(1);
      expect(scrollToOffset).toHaveBeenCalledWith({
        offset: 0,
        animated: true,
      });
      screen.unmount();
      expect(ref.current).toBeNull();
    } finally {
      scrollToOffset.mockRestore();
    }
  });
});
