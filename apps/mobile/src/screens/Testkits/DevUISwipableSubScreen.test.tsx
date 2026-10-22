import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => ({
      activeOffsetX: () => undefined,
      failOffsetY: () => undefined,
      onBegin: () => undefined,
      onEnd: () => undefined,
      onFinalize: () => undefined,
      onUpdate: () => undefined,
    }),
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react').Fragment, null, children),
}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      ScrollView: ReactNative.ScrollView,
      Text: ReactNative.Text,
      View: ReactNative.View,
    },
    cancelAnimation: jest.fn(),
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    runOnUI: (callback: (...args: unknown[]) => unknown) => callback,
    scrollTo: jest.fn(),
    useAnimatedReaction: () => undefined,
    useAnimatedRef: () => {
      const ref = (component?: unknown) => {
        ref.current = component ?? null;
      };
      ref.current = null;
      return ref;
    },
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
    useSharedValue: (value: unknown) => ({ value }),
    withDecay: (config: { velocity: number }) => config.velocity,
    withTiming: (value: number) => value,
  };
});

import DevUISwipableSubScreen from './DevUISwipableSubScreen';

describe('Swipable SubScreen harness', () => {
  it('swaps the single list data when a tab is pressed', () => {
    render(<DevUISwipableSubScreen />);

    expect(screen.getByTestId('dev-perps-pager-row-a-0')).toBeTruthy();
    expect(screen.getByTestId('dev-perps-pager-active')).toHaveTextContent(
      'active=a rows=12',
    );

    fireEvent.press(screen.getByTestId('dev-perps-pager-tab-b'));

    expect(screen.getByTestId('dev-perps-pager-row-b-0')).toBeTruthy();
    expect(screen.queryByTestId('dev-perps-pager-row-a-0')).toBeNull();
    expect(screen.getByTestId('dev-perps-pager-active')).toHaveTextContent(
      'active=b rows=8',
    );
  });
});
