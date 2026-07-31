import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockUsePerpsProScene = jest.fn();
const mockMarketSelectorPresent = jest.fn();
const mockOrderBookRender = jest.fn();

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
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../components/account/PerpsProAccountSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProAccountSkeleton: () =>
      ReactModule.createElement(View, { testID: 'account-skeleton' }),
  };
});

jest.mock('../components/chart/PerpsProKlineSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProKlineSheet: () =>
      ReactModule.createElement(View, { testID: 'kline-sheet' }),
  };
});

jest.mock('../components/header/PerpsProHeader', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHeader: () =>
      ReactModule.createElement(View, { testID: 'pro-header' }),
  };
});

jest.mock('../components/header/usePerpsProHeaderCollapse', () => ({
  usePerpsProHeaderCollapse: () => ({
    headerHeight: 56,
    headerOpacity: 1,
    onScroll: jest.fn(),
  }),
}));

jest.mock('../components/loading/PerpsProSceneSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketBarSkeleton: () =>
      ReactModule.createElement(View, { testID: 'market-bar-skeleton' }),
    PerpsProSceneSkeleton: () =>
      ReactModule.createElement(View, { testID: 'scene-skeleton' }),
  };
});

jest.mock('../components/market/PerpsProMarketBar', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsProMarketBar: ({
      onOpenKline,
      onPress,
    }: {
      onOpenKline: () => void;
      onPress: () => void;
    }) =>
      ReactModule.createElement(
        ReactModule.Fragment,
        null,
        ReactModule.createElement(Pressable, {
          onPress,
          testID: 'market-bar',
        }),
        ReactModule.createElement(Pressable, {
          onPress: onOpenKline,
          testID: 'kline-trigger',
        }),
      ),
  };
});

jest.mock('../components/market/PerpsProMarketSelector', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProMarketSelector: ReactModule.forwardRef(
      (_props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: mockMarketSelectorPresent,
        }));
        return ReactModule.createElement(View, { testID: 'market-selector' });
      },
    ),
  };
});

jest.mock('../components/trade/PerpsProTradeSkeleton', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProTradeSkeleton: () =>
      ReactModule.createElement(View, { testID: 'trade-skeleton' }),
  };
});

jest.mock('./PerpsProRealtimeOrderBook', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProRealtimeOrderBook: () => {
      mockOrderBookRender();
      return ReactModule.createElement(View, {
        testID: 'realtime-order-book',
      });
    },
  };
});

jest.mock('./usePerpsProScene', () => ({
  usePerpsProScene: mockUsePerpsProScene,
}));

const { PerpsProScene } =
  require('./PerpsProScene') as typeof import('./PerpsProScene');

const createSceneState = (overrides: Record<string, unknown> = {}) => ({
  currentMarket: null,
  isResolvingMarket: false,
  klineEnabled: false,
  marketDataStatus: 'success',
  precision: null,
  realtimeEnabled: false,
  retryMarketData: jest.fn(),
  selectMarket: jest.fn(),
  selectTickOption: jest.fn(),
  selectedTickOption: null,
  tickOptions: [],
  ...overrides,
});

describe('PerpsProScene market loading states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the full skeleton while a ready catalogue resolves its market', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        isResolvingMarket: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('market-bar-skeleton')).toBeTruthy();
    expect(screen.getByTestId('scene-skeleton')).toBeTruthy();
    expect(screen.queryByText('page.perps.pro.common.unavailable')).toBeNull();
  });

  it('presents the prewarmed selector without rerendering the scene content', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          marketKey: 'hyperliquid::BTC',
          quoteAsset: 'USDC',
        },
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    expect(screen.getByTestId('market-selector')).toBeTruthy();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
    expect(mockMarketSelectorPresent).not.toHaveBeenCalled();
    const orderBookRendersBeforeOpen = mockOrderBookRender.mock.calls.length;

    fireEvent.press(screen.getByTestId('market-bar'));

    expect(mockMarketSelectorPresent).toHaveBeenCalledTimes(1);
    expect(mockOrderBookRender).toHaveBeenCalledTimes(
      orderBookRendersBeforeOpen,
    );
  });

  it('opens the K-line sheet from its dedicated market action', () => {
    mockUsePerpsProScene.mockReturnValue(
      createSceneState({
        currentMarket: {
          marketKey: 'hyperliquid::BTC',
          quoteAsset: 'USDC',
        },
        klineEnabled: true,
      }),
    );

    render(
      <PerpsProScene isModeSwitching={false} onSwitchToSimple={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('kline-trigger'));
    expect(screen.getByTestId('kline-sheet')).toBeTruthy();
    expect(screen.getByTestId('realtime-order-book')).toBeTruthy();
  });
});
