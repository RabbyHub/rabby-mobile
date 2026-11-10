import React, { Profiler } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsMarketHomeList } from './PerpsMarketHomeList';
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
const mockRenderMarketItem = jest.fn();

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
  useAppLanguage: () => ({ currentLanguage: 'en' }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: { card: {} } }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  // Exercise real Zustand subscriptions with a bounded market fixture. Native
  // Perps services and network convergence are outside this component contract.
  perpsStore: require('zustand').create(() => ({
    marketData: [],
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
    PerpsCategorySectionHeader: ({ cfg }) =>
      ReactModule.createElement(
        Text,
        { testID: `category-${cfg.id}` },
        cfg.label,
      ),
  };
});

type MarketFixture = {
  marketData: MarketData[];
  favoriteMarkets: string[];
  categories: { id: string; name: string; translations?: { en: string } }[];
  unrelated: number;
};
const mockStore = perpsStore as unknown as UseBoundStore<
  StoreApi<MarketFixture>
>;

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
    mockNavigation.focused = true;
    mockNavigationListeners.focus.clear();
    mockNavigationListeners.blur.clear();
    mockRenderMarketItem.mockClear();
    mockStore.setState({
      marketData: [market('BTC', '100', '20'), market('ETH', '10', '10')],
      favoriteMarkets: [],
      categories: [],
      unrelated: 0,
    });
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
      mockStore.setState({
        marketData: [market('BTC', '101', '20'), market('ETH', '11', '10')],
      });
    });
    expect(screen.getByText('BTC:101:1')).toBeTruthy();

    setFocused(false);
    const beforeHiddenUpdates = onRender.mock.calls.length;
    for (let tick = 1; tick <= 12; tick++) {
      act(() => {
        mockStore.setState({
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
    act(() => mockStore.setState({ unrelated: 1 }));
    expect(onRender).toHaveBeenCalledTimes(beforeUnrelatedUpdate);
  });

  it('publishes latest hidden favorites and translated category membership on focus', () => {
    const screen = render(<PerpsMarketHomeList onItemPress={jest.fn()} />);
    setFocused(false);
    act(() => {
      mockStore.setState({ favoriteMarkets: ['btc'] });
    });
    act(() => {
      mockStore.setState({
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
    expect(screen.getByText('Crypto latest')).toBeTruthy();
    // ETH appears in favorites and its category; BTC only in its category.
    expect(screen.getAllByText('ETH:10:unranked')).toHaveLength(2);
    expect(screen.getAllByText('BTC:100:unranked')).toHaveLength(1);
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
        mockStore.setState({ marketData: [market('SOL', '30', '50')] });
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
    act(() => mockStore.setState({ marketData: [market('BTC', '200', '20')] }));
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    // A focused route cannot wake a retained, hidden Simple page.
    setFocused(false);
    setFocused(true);
    expect(screen.getByText('BTC:100:1')).toBeTruthy();
    act(() => parentScope.setActive(true));
    expect(screen.getByText('BTC:200:1')).toBeTruthy();
    setFocused(false);
    act(() => mockStore.setState({ marketData: [market('BTC', '300', '20')] }));
    act(() => parentScope.setActive(false));
    act(() => parentScope.setActive(true));
    expect(screen.getByText('BTC:200:1')).toBeTruthy();
    setFocused(true);
    expect(screen.getByText('BTC:300:1')).toBeTruthy();
    screen.unmount();
    parentScope.dispose();
  });
});
