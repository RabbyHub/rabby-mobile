import { Animated } from 'react-native';

import {
  createPerpsProMarketTranslateY,
  getPerpsProMarketNaturalAnchor,
  getPerpsProMarketTop,
} from './perpsProMarketSticky';

describe('Perps Pro Market sticky geometry', () => {
  it('places the Market below the measured region alert', () => {
    expect(
      getPerpsProMarketNaturalAnchor({
        headerHeight: 56,
        regionAlertExtent: 46,
      }),
    ).toBe(102);
    expect(
      getPerpsProMarketNaturalAnchor({
        headerHeight: 56,
        regionAlertExtent: 0,
      }),
    ).toBe(56);
  });

  it('follows the alert until reaching the current Header bottom', () => {
    expect(
      getPerpsProMarketTop({
        headerMarketTop: 56,
        naturalAnchorY: 102,
        scrollY: 20,
      }),
    ).toBe(82);
    expect(
      getPerpsProMarketTop({
        headerMarketTop: 56,
        naturalAnchorY: 102,
        scrollY: 80,
      }),
    ).toBe(56);
    expect(
      getPerpsProMarketTop({
        headerMarketTop: 0,
        naturalAnchorY: 102,
        scrollY: 120,
      }),
    ).toBe(0);
  });

  it('keeps the same result in the native Animated expression', () => {
    const headerMarketTranslateY = new Animated.Value(56);
    const scrollY = new Animated.Value(20);
    const translateY = createPerpsProMarketTranslateY({
      headerMarketTranslateY,
      naturalAnchorY: 102,
      scrollY,
    });

    expect((translateY as Animated.Value).__getValue()).toBe(82);
    scrollY.setValue(80);
    expect((translateY as Animated.Value).__getValue()).toBe(56);
    headerMarketTranslateY.setValue(0);
    scrollY.setValue(120);
    expect((translateY as Animated.Value).__getValue()).toBe(0);
  });
});
