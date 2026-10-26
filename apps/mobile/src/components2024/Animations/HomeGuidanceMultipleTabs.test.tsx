import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import {
  HomeGuidanceMultipleTabs,
  useMeasureLayoutForHomeGuidanceMultipleTabs,
} from './HomeGuidanceMultipleTabs';

// Component contract only: a hidden mask must not register an exit animation
// that starts from opacity 1. Native unmount timing still needs device coverage.
let mockViewed = true;
let mockIsIOS = false;

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { View: require('react-native').View },
    makeMutable: (value: unknown) => ({ value }),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (callback: () => object) => callback(),
    useAnimatedReaction: (prepare: () => unknown, react: Function) => {
      ReactModule.useEffect(() => react(prepare(), null), []);
    },
    runOnJS: (callback: Function) => callback,
    withTiming: (value: unknown) => value,
    Easing: { inOut: (value: unknown) => value, quad: 'quad' },
    FadeIn: { duration: (duration: number) => ({ type: 'enter', duration }) },
    FadeOut: { duration: (duration: number) => ({ type: 'exit', duration }) },
  };
});
jest.mock('lottie-react-native', () => () => null);
jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockIsIOS;
  },
}));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));
jest.mock('./hooks', () => ({
  guidancePersistedStore: {
    getState: () => ({ multiTabs20251205Viewed: mockViewed }),
  },
  useGuidanceShown: () => ({ multiTabs20251205Viewed: mockViewed }),
  toggleViewedGuidance: jest.fn(),
}));
jest.mock('@/hooks/common/delayLikeValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));
jest.mock('@/hooks/reanimated', () => ({
  useValueFromSharedValue: (value: { value: unknown }) => value.value,
}));
jest.mock('@/utils/time', () => ({
  getLottieAnimationDurationInMS: () => 1000,
}));
jest.mock('@/constant/home', () => ({
  HOME_TOP_HEADER_SIZES: { headerHeight: 80 },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const context = {
      colors2024: new Proxy({}, { get: () => '#123456' }),
      isLight: true,
      safeAreaInsets: { value: { top: 0, bottom: 0, left: 0, right: 0 } },
      winLayout: { value: { width: 390, height: 844 } },
    };
    return {
      styles: getStyle.getStyles(context),
      reanimatedStyles: Object.fromEntries(
        Object.entries(getStyle.getReanimatedStyles ?? {}).map(
          ([key, value]) => [key, () => (value as Function)(context)],
        ),
      ),
    };
  },
}));

function getMask() {
  return screen
    .UNSAFE_queryAllByType(View)
    .find(
      view =>
        view.props.pointerEvents === 'none' &&
        StyleSheet.flatten(view.props.style)?.backgroundColor ===
          'rgba(0, 0, 0, 0.6)',
    );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockViewed = true;
  mockIsIOS = false;
  const measurement = renderHook(() =>
    useMeasureLayoutForHomeGuidanceMultipleTabs(),
  );
  measurement.result.current.secondaryIndicatorViewRef.current = {
    measure: callback => callback(0, 0, 100, 4, 200, 100),
  } as View;
  act(() => measurement.result.current.measureSecondaryIndicator());
  measurement.unmount();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('does not fade a previously viewed Android mask back in when Home unmounts', () => {
  const view = render(
    <HomeGuidanceMultipleTabs beforeContentNode={<View />} />,
  );
  expect(getMask()).toBeDefined();
  expect(StyleSheet.flatten(getMask()!.props.style).opacity).toBe(0);
  expect(getMask()!.props.entering).toBeUndefined();
  expect(getMask()!.props.exiting).toBeUndefined();
  view.unmount();
});

it('keeps the visible guidance animation but clears exit animation after dismissal', () => {
  mockViewed = false;
  const view = render(
    <HomeGuidanceMultipleTabs beforeContentNode={<View />} />,
  );
  expect(getMask()!.props.entering).toEqual({ type: 'enter', duration: 250 });
  expect(getMask()!.props.exiting).toEqual({ type: 'exit', duration: 250 });
  mockViewed = true;
  view.rerender(<HomeGuidanceMultipleTabs beforeContentNode={<View />} />);
  expect(getMask()!.props.entering).toBeUndefined();
  expect(getMask()!.props.exiting).toBeUndefined();
});

it('keeps hidden iOS guidance absent', () => {
  mockIsIOS = true;
  render(<HomeGuidanceMultipleTabs beforeContentNode={<View />} />);
  expect(getMask()).toBeUndefined();
});
