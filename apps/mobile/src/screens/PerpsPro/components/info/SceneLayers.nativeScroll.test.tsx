import { act, cleanup, render, screen } from '@testing-library/react-native';
import React from 'react';
import {
  Animated as NativeAnimated,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

jest.mock('react-native-gesture-handler', () => ({ Gesture: {} }));
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof import('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      View: ReactNative.View,
    },
    useAnimatedReaction: () => undefined,
    useAnimatedStyle: jest.fn((factory: () => unknown) => factory()),
    useSharedValue: <T,>(value: T) => ReactModule.useRef({ value }).current,
  };
});

import {
  CollapsibleHeaderLayer,
  CollapsiblePinnedLayer,
  CollapsibleSceneProvider,
} from '@rabby-wallet/rn-collapsible-scene-view';
import { useAnimatedStyle } from 'react-native-reanimated';

const tabs = ['positions'];
const renderLayers = ({
  baseTop = 400,
  content,
  headerHeight = 80,
  nativeScrollY,
  pinTop = 50,
  style,
}: {
  baseTop?: number;
  content?: string;
  headerHeight?: number;
  nativeScrollY?: NativeAnimated.Value;
  pinTop?: number;
  style?: ViewStyle;
}) => (
  <CollapsibleSceneProvider
    activeTab="positions"
    headerHeight={headerHeight}
    syncOffsetOnActivate={false}
    tabs={tabs}>
    <CollapsibleHeaderLayer nativeScrollY={nativeScrollY} testID="header">
      {content ? <Text>{`Header ${content}`}</Text> : <View />}
    </CollapsibleHeaderLayer>
    <CollapsiblePinnedLayer
      baseTop={baseTop}
      nativeScrollY={nativeScrollY}
      pinTop={pinTop}
      style={style}
      testID="tabs">
      {content ? <Text>{`Tabs ${content}`}</Text> : <View />}
    </CollapsiblePinnedLayer>
  </CollapsibleSceneProvider>
);

describe('scene native vertical presentation clock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('matches the clamp and pin formulas without sending the native value into worklets', () => {
    const nativeScrollY = new NativeAnimated.Value(0);
    render(renderLayers({ nativeScrollY }));
    expect(useAnimatedStyle).not.toHaveBeenCalled();

    for (const y of [-60, 0, 40, 80, 200, 350, 500]) {
      act(() => nativeScrollY.setValue(y));
      const hidden = Math.min(Math.max(y, 0), 80);
      expect(screen.getByTestId('header')).toHaveStyle({
        opacity: 1 - hidden / 80,
        transform: [{ translateY: hidden === 0 ? 0 : -hidden }],
      });
      expect(screen.getByTestId('tabs')).toHaveStyle({
        transform: [{ translateY: Math.max(50, 400 - Math.max(y, 0)) }],
      });
    }
  });

  it('handles zero collapse and already-pinned layouts without invalid interpolation ranges', () => {
    const nativeScrollY = new NativeAnimated.Value(0);
    const view = render(
      renderLayers({ baseTop: 20, headerHeight: 0, nativeScrollY, pinTop: 50 }),
    );
    for (const y of [-20, 0, 150]) {
      act(() => nativeScrollY.setValue(y));
      expect(screen.getByTestId('header')).toHaveStyle({
        opacity: 1,
        transform: [{ translateY: 0 }],
      });
      expect(screen.getByTestId('tabs')).toHaveStyle({
        transform: [{ translateY: 50 }],
      });
    }
    view.rerender(renderLayers({ baseTop: 50, nativeScrollY, pinTop: 50 }));
    expect(screen.getByTestId('tabs')).toHaveStyle({
      transform: [{ translateY: 50 }],
    });
  });

  it('keeps the existing worklet presentation when no native clock is supplied', () => {
    render(renderLayers({}));
    expect(useAnimatedStyle).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('header')).toHaveStyle({
      opacity: 1,
      transform: [{ translateY: 0 }],
    });
    expect(screen.getByTestId('tabs')).toHaveStyle({
      transform: [{ translateY: 400 }],
    });
  });
});

describe('stable native presentation shell', () => {
  const nativeView = (testID: string) =>
    screen
      .UNSAFE_getAllByType(NativeAnimated.View)
      .find(view => view.props.testID === testID)!;

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('updates business children without rerendering the animated hosts or rebuilding their graphs', () => {
    const nativeScrollY = new NativeAnimated.Value(0);
    const interpolateClock = jest.spyOn(nativeScrollY, 'interpolate');
    const view = render(renderLayers({ content: 'positions', nativeScrollY }));
    const headerProps = nativeView('header').props;
    const tabsProps = nativeView('tabs').props;
    expect(interpolateClock).toHaveBeenCalledTimes(3);

    view.rerender(renderLayers({ content: 'account', nativeScrollY }));
    expect(screen.getByText('Header account')).toBeOnTheScreen();
    expect(screen.getByText('Tabs account')).toBeOnTheScreen();
    expect(screen.queryByText('Header positions')).toBeNull();
    expect(screen.queryByText('Tabs positions')).toBeNull();
    // The shell's JSX props object would be replaced if it rerendered. The
    // content context updates only the descendant slot, not Animated.View.
    expect(nativeView('header').props).toBe(headerProps);
    expect(nativeView('tabs').props).toBe(tabsProps);
    expect(interpolateClock).toHaveBeenCalledTimes(3);
    expect(useAnimatedStyle).not.toHaveBeenCalled();
  });

  it('updates the native shell and interpolation when geometry changes', () => {
    const nativeScrollY = new NativeAnimated.Value(100);
    const view = render(renderLayers({ nativeScrollY }));
    const headerProps = nativeView('header').props;
    const tabsProps = nativeView('tabs').props;
    view.rerender(
      renderLayers({
        baseTop: 600,
        headerHeight: 160,
        nativeScrollY,
        pinTop: 80,
      }),
    );
    expect(nativeView('header').props).not.toBe(headerProps);
    expect(nativeView('tabs').props).not.toBe(tabsProps);
    expect(screen.getByTestId('header')).toHaveStyle({
      opacity: 0.375,
      transform: [{ translateY: -100 }],
    });
    expect(screen.getByTestId('tabs')).toHaveStyle({
      transform: [{ translateY: 500 }],
    });
  });

  it('updates non-animated styles without rebuilding the scroll interpolation', () => {
    const nativeScrollY = new NativeAnimated.Value(0);
    const interpolateClock = jest.spyOn(nativeScrollY, 'interpolate');
    const view = render(renderLayers({ nativeScrollY }));
    const tabsProps = nativeView('tabs').props;
    view.rerender(
      renderLayers({ nativeScrollY, style: { backgroundColor: 'red' } }),
    );
    expect(nativeView('tabs').props).not.toBe(tabsProps);
    expect(screen.getByTestId('tabs')).toHaveStyle({
      backgroundColor: 'red',
      transform: [{ translateY: 400 }],
    });
    expect(interpolateClock).toHaveBeenCalledTimes(3);
  });

  it('rebinds presentation to a replacement native clock without retaining the old clock', () => {
    const firstClock = new NativeAnimated.Value(100);
    const nextClock = new NativeAnimated.Value(20);
    const view = render(renderLayers({ nativeScrollY: firstClock }));
    const headerProps = nativeView('header').props;
    const tabsProps = nativeView('tabs').props;
    view.rerender(renderLayers({ nativeScrollY: nextClock }));
    expect(nativeView('header').props).not.toBe(headerProps);
    expect(nativeView('tabs').props).not.toBe(tabsProps);
    act(() => firstClock.setValue(300));
    expect(screen.getByTestId('header')).toHaveStyle({
      opacity: 0.75,
      transform: [{ translateY: -20 }],
    });
    expect(screen.getByTestId('tabs')).toHaveStyle({
      transform: [{ translateY: 380 }],
    });
    act(() => nextClock.setValue(40));
    expect(screen.getByTestId('tabs')).toHaveStyle({
      transform: [{ translateY: 360 }],
    });
  });

  it('does not mirror native scroll into JS listeners or explicit passthrough props', () => {
    const nativeScrollY = new NativeAnimated.Value(0);
    const addListener = jest.spyOn(nativeScrollY, 'addListener');
    render(renderLayers({ nativeScrollY }));
    expect(addListener).not.toHaveBeenCalled();
    for (const testID of ['header', 'tabs']) {
      expect(
        nativeView(testID).props.passthroughAnimatedPropExplicitValues,
      ).toBeUndefined();
    }
  });
});
