import { Animated } from 'react-native';

import {
  createPerpsProInfoTabsTranslateY,
  getPerpsProInfoTabsNaturalAnchor,
  getPerpsProInfoTabsTop,
  PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT,
} from './perpsProInfoTabsSticky';

describe('Perps Pro info tabs sticky geometry', () => {
  it('preserves the 16px natural gap after the trade row', () => {
    expect(
      getPerpsProInfoTabsNaturalAnchor({
        leadInHeight: 96,
        tradeRowHeight: 424,
      }),
    ).toBe(536);
    expect(PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT).toBe(50);
  });

  it('follows its list anchor until it reaches the moving Market bottom', () => {
    expect(
      getPerpsProInfoTabsTop({
        anchorY: 612,
        marketTranslateY: 56,
        scrollY: 0,
      }),
    ).toBe(612);
    expect(
      getPerpsProInfoTabsTop({
        anchorY: 612,
        marketTranslateY: 56,
        scrollY: 600,
      }),
    ).toBe(96);
    expect(
      getPerpsProInfoTabsTop({
        anchorY: 612,
        marketTranslateY: 0,
        scrollY: 600,
      }),
    ).toBe(40);
  });

  it('keeps the same geometry in the native Animated expression', () => {
    const scrollY = new Animated.Value(600);
    const marketTranslateY = new Animated.Value(56);
    const translateY = createPerpsProInfoTabsTranslateY({
      anchorY: 612,
      marketBarHeight: 40,
      marketTranslateY,
      scrollY,
    });

    expect((translateY as Animated.Value).__getValue()).toBe(96);
    marketTranslateY.setValue(0);
    expect((translateY as Animated.Value).__getValue()).toBe(40);
  });
});
