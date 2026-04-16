import { renderHook } from '@testing-library/react-native';
import {
  getVerticalLayoutHeights,
  startWatchLayoutChange,
  svsLayout,
  useSafeAndroidBottomSizes,
  useSafeOffTop,
  useSafeSizes,
} from './useAppLayout';

let mockWindowLayout = { width: 360, height: 700 };
let mockScreenLayout = { width: 360, height: 760 };

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
  useSafeAreaInsets: () => ({
    top: 10,
    bottom: 20,
    left: 0,
    right: 0,
  }),
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
});
