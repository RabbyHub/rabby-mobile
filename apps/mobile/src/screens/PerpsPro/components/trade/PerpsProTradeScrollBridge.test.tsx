import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, View } from 'react-native';

const mockScrollTo = jest.fn();
let mockScrollHandlers: Record<string, (event: any) => void> = {};

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      ScrollView: ReactNative.ScrollView,
      View: ReactNative.View,
    },
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedRef: () => {
      const ref = (component?: unknown) => {
        ref.current = component ?? null;
        return 0;
      };
      ref.current = null;
      return ref;
    },
    useAnimatedScrollHandler: (handlers: typeof mockScrollHandlers) => {
      mockScrollHandlers = handlers;
      return jest.fn();
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

import type { PerpsProInfoScrollBridgeController } from '../info/usePerpsProInfoScrollBridge';
import {
  getPerpsProInfoBridgeOffset,
  interruptPerpsProInfoScrollBridge,
} from '../info/usePerpsProInfoScrollBridge';
import { PerpsProTradeScrollBridge } from './PerpsProTradeScrollBridge';

const initialPlatform = Platform.OS;
const setPlatform = (platform: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: platform,
  });
};

const createController = () => {
  const shared = <T,>(value: T) => ({ value });
  return {
    activeIndex: shared(0),
    epoch: shared(0),
    pageGestureActive: shared(false),
    targets: [0, 1, 2].map(() => ({
      maxOffset: shared(300),
      offset: shared(100),
      ref: jest.fn(),
    })),
  } as unknown as PerpsProInfoScrollBridgeController;
};

describe('PerpsProTradeScrollBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrollHandlers = {};
    setPlatform('ios');
  });

  afterAll(() => setPlatform(initialPlatform as 'android' | 'ios'));

  it('keeps the iOS Trade under its existing native vertical scroll owner', () => {
    render(
      <PerpsProTradeScrollBridge controller={createController()} height={520}>
        <View testID="trade-content" />
      </PerpsProTradeScrollBridge>,
    );

    const bridge = screen.getByTestId('perps-pro-trade-scroll-bridge');
    expect(bridge.props.keyboardShouldPersistTaps).toBe('handled');
    expect(bridge.props.nestedScrollEnabled).toBe(true);
    expect(bridge.props.scrollEnabled).toBe(true);
    expect(bridge.props.scrollEventThrottle).toBe(16);
    expect(screen.getAllByTestId('trade-content')).toHaveLength(1);
  });

  it('uses a stationary keyboard responder instead of a proxy ScrollView on Android', () => {
    setPlatform('android');
    render(
      <PerpsProTradeScrollBridge controller={createController()} height={520}>
        <View testID="trade-content" />
      </PerpsProTradeScrollBridge>,
    );

    const bridge = screen.getByTestId('perps-pro-trade-scroll-bridge');
    expect(bridge.props.keyboardShouldPersistTaps).toBe('handled');
    expect(bridge.props.scrollEnabled).toBe(false);
    expect(bridge.props.contentOffset).toBeUndefined();
    expect(bridge.props.contentContainerStyle).toBeUndefined();
    expect(bridge.props.onScroll).toBeUndefined();
    expect(screen.getAllByTestId('trade-content')).toHaveLength(1);
  });

  it('mirrors native proxy deltas to the active list and stops a stale session', () => {
    const controller = createController();
    render(
      <PerpsProTradeScrollBridge controller={controller} height={520}>
        <View />
      </PerpsProTradeScrollBridge>,
    );

    act(() => {
      mockScrollHandlers.onBeginDrag({ contentOffset: { y: 100_000 } });
      mockScrollHandlers.onScroll({ contentOffset: { y: 100_050 } });
    });
    expect(mockScrollTo).toHaveBeenCalledWith(
      controller.targets[0].ref,
      0,
      150,
      false,
    );

    interruptPerpsProInfoScrollBridge(controller);
    act(() => {
      mockScrollHandlers.onScroll({ contentOffset: { y: 100_080 } });
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('disables the proxy until the initial info tab is resolved', () => {
    render(
      <PerpsProTradeScrollBridge
        controller={createController()}
        enabled={false}
        height={520}>
        <View />
      </PerpsProTradeScrollBridge>,
    );

    expect(
      screen.getByTestId('perps-pro-trade-scroll-bridge').props.scrollEnabled,
    ).toBe(false);
  });

  it('rejects a new vertical session while the horizontal pager is active', () => {
    const controller = createController();
    controller.pageGestureActive.value = true;
    render(
      <PerpsProTradeScrollBridge controller={controller} height={520}>
        <View />
      </PerpsProTradeScrollBridge>,
    );

    act(() => {
      mockScrollHandlers.onBeginDrag({ contentOffset: { y: 100_000 } });
      mockScrollHandlers.onScroll({ contentOffset: { y: 100_050 } });
    });
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('clamps malformed and out-of-bounds bridge offsets', () => {
    expect(
      getPerpsProInfoBridgeOffset({ delta: 50, maxOffset: 120, offset: 100 }),
    ).toBe(120);
    expect(
      getPerpsProInfoBridgeOffset({ delta: -150, maxOffset: 120, offset: 100 }),
    ).toBe(0);
    expect(
      getPerpsProInfoBridgeOffset({
        delta: Number.NaN,
        maxOffset: Number.POSITIVE_INFINITY,
        offset: Number.NaN,
      }),
    ).toBe(0);
  });
});
