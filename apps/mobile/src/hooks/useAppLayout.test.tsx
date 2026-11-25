import { renderHook } from '@testing-library/react-native';
import {
  getVerticalLayoutHeights,
  startWatchLayoutChange,
  svsLayout,
  useSafeAndroidBottomSizes,
  useCustomHeaderTop,
  useSafeOffTop,
  useSafeSizes,
} from './useAppLayout';

let mockWindowLayout = { width: 360, height: 700 };
let mockScreenLayout = { width: 360, height: 760 };
let mockInsets = { top: 10, bottom: 20, left: 0, right: 0 };
let mockFoldablePosture = false;

let changeListener:
  | ((payload: {
      window: { width: number; height: number };
      screen: { width: number; height: number };
    }) => void)
  | undefined;

jest.mock('@/constant/layout', () => ({
  ScreenLayouts: {
    headerAreaHeight: 56,
  },
}));

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.fn(),
}));

jest.mock('react-native-reanimated', () => ({
  makeMutable: (value: unknown) => ({
    value,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

// The real package ships untranspiled ESM; only the context is needed here.
jest.mock('@react-navigation/elements', () => {
  const React = require('react');
  return { HeaderHeightContext: React.createContext(undefined) };
});

jest.mock('@/core/utils/foldableDevice', () => ({
  isFoldableSideColumnPosture: () => mockFoldablePosture,
}));

jest.mock('react-native', () => ({
  Dimensions: {
    get: (target: 'window' | 'screen') =>
      target === 'window' ? mockWindowLayout : mockScreenLayout,
    addEventListener: (
      event: string,
      listener: (payload: {
        window: { width: number; height: number };
        screen: { width: number; height: number };
      }) => void,
    ) => {
      if (event === 'change') {
        changeListener = listener;
      }
      return {
        remove: jest.fn(),
      };
    },
  },
  Platform: {
    OS: 'android',
  },
  StatusBar: {
    currentHeight: 24,
  },
}));

describe('useAppLayout', () => {
  beforeEach(() => {
    mockWindowLayout = { width: 360, height: 700 };
    mockScreenLayout = { width: 360, height: 760 };
    mockInsets = { top: 10, bottom: 20, left: 0, right: 0 };
    mockFoldablePosture = false;
    changeListener = undefined;
    svsLayout.winLayout.value = mockWindowLayout;
    svsLayout.screenLayout.value = mockScreenLayout;
    svsLayout.insets.value = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
  });

  it('tracks mutable layout snapshots and updates them on dimension changes', () => {
    expect(svsLayout.winLayout.value).toEqual({ width: 360, height: 700 });
    expect(svsLayout.screenLayout.value).toEqual({ width: 360, height: 760 });

    startWatchLayoutChange();
    changeListener?.({
      window: { width: 400, height: 710 },
      screen: { width: 400, height: 780 },
    });

    expect(svsLayout.winLayout.value).toEqual({ width: 400, height: 710 });
    expect(svsLayout.screenLayout.value).toEqual({ width: 400, height: 780 });
  });

  it('computes vertical layout heights using the current android formula', () => {
    expect(getVerticalLayoutHeights()).toEqual({
      screenHeight: 760,
      windowHeight: 700,
      statusbarHeight: 24,
      androidSystembarHeight: 36,
    });
  });

  it('returns safe-area derived sizes and offsets', () => {
    const { result: safeSizes } = renderHook(() => useSafeSizes());
    expect(safeSizes.current).toEqual({
      safeTop: 10,
      safeHeaderTop: 10,
      headerHeight: 56,
      safeOffHeader: 66,
      safeOffScreenTop: 750,
      safeOffBottom: 20,
      systembarOffsetBottom: 20,
      androidOnlyBottomOffset: 20,
    });

    const { result: bottomSizes } = renderHook(() =>
      useSafeAndroidBottomSizes({
        footer: 100,
      }),
    );
    expect(bottomSizes.current).toEqual({
      safeSizes: {
        footer: 120,
      },
      cutOffSizes: {
        footer: 80,
      },
      androidBottomOffset: 20,
    });

    const { result: offTop } = renderHook(() =>
      useSafeOffTop({
        card: 100,
      }),
    );
    expect(offTop.current).toEqual({
      topValue: 10,
      offWindow: {
        card: 590,
      },
      offScreen: {
        card: 650,
      },
    });
  });

  it('keeps the raw top and headers unchanged when no side column is present', () => {
    const { result: safeSizes } = renderHook(() => useSafeSizes());
    expect(safeSizes.current.safeHeaderTop).toBe(10);

    const { result: headerTop } = renderHook(() => useCustomHeaderTop());
    expect(headerTop.current).toBe(10);

    mockInsets = { top: 0, bottom: 20, left: 0, right: 0 };
    const { result: noInsetSizes } = renderHook(() => useSafeSizes());
    expect(noInsetSizes.current.safeHeaderTop).toBe(0);

    const { result: noInsetHeaderTop } = renderHook(() => useCustomHeaderTop());
    expect(noInsetHeaderTop.current).toBe(0);
  });

  it('uses the calibrated header offset on the foldable side-column posture', () => {
    mockFoldablePosture = true;
    mockInsets = { top: 0, bottom: 34, left: 0, right: 84 };

    const { result: safeSizes } = renderHook(() => useSafeSizes());
    // Outer screen: no native header context in this test, so the content
    // offset falls back to headerAreaHeight + top; the header row itself is
    // pinned to the calibrated 22pt.
    expect(safeSizes.current.safeHeaderTop).toBe(22);
    expect(safeSizes.current.safeOffHeader).toBe(56);

    const { result: headerTop } = renderHook(() => useCustomHeaderTop());
    expect(headerTop.current).toBe(22);
  });

  it('prefers the real safe-area top over the foldable offset when it exists', () => {
    mockFoldablePosture = false;
    mockInsets = { top: 59, bottom: 34, left: 0, right: 84 };

    const { result: headerTop } = renderHook(() => useCustomHeaderTop());
    expect(headerTop.current).toBe(59);
  });
});
