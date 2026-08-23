import { Animated } from 'react-native';

import {
  createPerpsProMarketTranslateY,
  createPerpsProRestrictedMarketTranslateY,
  getPerpsProMarketNaturalAnchor,
  getPerpsProMarketTop,
  getPerpsProRestrictedMarketTop,
} from './perpsProMarketSticky';

describe('Perps Pro Market sticky geometry', () => {
  it('places the Market below the measured region alert', () => {
    expect(
      getPerpsProMarketNaturalAnchor({
        headerHeight: 56,
        regionAlertExtent: 38,
      }),
    ).toBe(94);
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
        naturalAnchorY: 94,
        scrollY: 20,
      }),
    ).toBe(74);
    expect(
      getPerpsProMarketTop({
        headerMarketTop: 56,
        naturalAnchorY: 94,
        scrollY: 80,
      }),
    ).toBe(56);
    expect(
      getPerpsProMarketTop({
        headerMarketTop: 0,
        naturalAnchorY: 94,
        scrollY: 120,
      }),
    ).toBe(0);
  });

  it('keeps the same result in the native Animated expression', () => {
    const headerMarketTranslateY = new Animated.Value(56);
    const scrollY = new Animated.Value(20);
    const translateY = createPerpsProMarketTranslateY({
      headerMarketTranslateY,
      naturalAnchorY: 94,
      scrollY,
    });

    expect((translateY as Animated.Value).__getValue()).toBe(74);
    scrollY.setValue(80);
    expect((translateY as Animated.Value).__getValue()).toBe(56);
    headerMarketTranslateY.setValue(0);
    scrollY.setValue(120);
    expect((translateY as Animated.Value).__getValue()).toBe(0);
  });

  it('keeps restricted Market below the sticky alert as the header collapses', () => {
    expect(
      getPerpsProRestrictedMarketTop({
        headerMarketTop: 56,
        regionAlertExtent: 64,
      }),
    ).toBe(120);
    expect(
      getPerpsProRestrictedMarketTop({
        headerMarketTop: 0,
        regionAlertExtent: 64,
      }),
    ).toBe(64);

    const headerMarketTranslateY = new Animated.Value(56);
    const translateY = createPerpsProRestrictedMarketTranslateY({
      headerMarketTranslateY,
      regionAlertExtent: 64,
    });
    expect((translateY as Animated.Value).__getValue()).toBe(120);
    headerMarketTranslateY.setValue(0);
    expect((translateY as Animated.Value).__getValue()).toBe(64);
  });
});
