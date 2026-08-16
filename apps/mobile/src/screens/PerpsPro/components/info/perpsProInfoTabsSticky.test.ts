import { Animated } from 'react-native';

import {
  createPerpsProInfoTabsTranslateY,
  getPerpsProPopulatedInfoSectionBottomPadding,
  getPerpsProInfoSectionMinimumContentHeight,
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

  it('reserves enough short-content range to pin the info tabs below a collapsed Market bar', () => {
    expect(
      getPerpsProInfoSectionMinimumContentHeight({
        infoTabsNaturalAnchor: 536,
        marketBarHeight: 40,
        viewportHeight: 700,
      }),
    ).toBe(1196);
    expect(
      getPerpsProInfoSectionMinimumContentHeight({
        infoTabsNaturalAnchor: 0,
        marketBarHeight: 40,
        viewportHeight: Number.NaN,
      }),
    ).toBe(0);
  });

  it('preserves the empty-state trailing distance after populated rows', () => {
    expect(
      getPerpsProPopulatedInfoSectionBottomPadding({
        marketBarHeight: 40,
        viewportHeight: 700,
      }),
    ).toBe(390);
    expect(
      getPerpsProPopulatedInfoSectionBottomPadding({
        marketBarHeight: 40,
        viewportHeight: 300,
      }),
    ).toBe(32);
    expect(
      getPerpsProPopulatedInfoSectionBottomPadding({
        marketBarHeight: 40,
        viewportHeight: Number.NaN,
      }),
    ).toBe(32);
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
