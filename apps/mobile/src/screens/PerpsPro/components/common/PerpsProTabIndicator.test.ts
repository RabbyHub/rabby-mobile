jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  cancelAnimation: jest.fn(),
  Easing: { bezier: jest.fn(() => 'ease-out') },
  ReduceMotion: { System: 'system' },
  useAnimatedStyle: jest.fn(),
  withTiming: jest.fn((target: number) => target),
}));

import {
  getPerpsProTabIndicatorFrame,
  PERPS_PRO_TAB_INDICATOR_DURATION_MS,
} from './PerpsProTabIndicator';

describe('PerpsProTabIndicator', () => {
  const layouts = [
    { width: 20, x: 10 },
    { width: 40, x: 50 },
    { width: 30, x: 120 },
  ];

  it('interpolates adjacent indicator frames in both directions', () => {
    expect(getPerpsProTabIndicatorFrame(0.5, layouts)).toEqual({
      width: 30,
      x: 30,
    });
    expect(getPerpsProTabIndicatorFrame(1.5, layouts)).toEqual({
      width: 35,
      x: 85,
    });
  });

  it('clamps invalid and out-of-range pager positions', () => {
    expect(getPerpsProTabIndicatorFrame(-1, layouts)).toEqual(layouts[0]);
    expect(getPerpsProTabIndicatorFrame(4, layouts)).toEqual(layouts[2]);
    expect(getPerpsProTabIndicatorFrame(Number.NaN, layouts)).toEqual(
      layouts[0],
    );
    expect(getPerpsProTabIndicatorFrame(1, [])).toEqual({ width: 0, x: 0 });
  });

  it('keeps the Desktop-aligned fallback duration explicit', () => {
    expect(PERPS_PRO_TAB_INDICATOR_DURATION_MS).toBe(300);
  });
});
