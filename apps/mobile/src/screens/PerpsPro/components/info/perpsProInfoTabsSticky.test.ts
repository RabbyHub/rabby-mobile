import { Animated } from 'react-native';

import {
  createPerpsProInfoTabsTranslateY,
  getPerpsProInfoStickyHeaderOffset,
  getPerpsProInfoSectionMinimumContentHeight,
  getPerpsProInfoTabsNaturalAnchor,
  getPerpsProInfoTabsTop,
  PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT,
} from './perpsProInfoTabsSticky';

describe('Perps Pro info tabs sticky geometry', () => {
  it('anchors the tabs 20px after the trade row without a divider', () => {
    expect(
      getPerpsProInfoTabsNaturalAnchor({
        leadInHeight: 96,
        tradeRowHeight: 424,
      }),
    ).toBe(540);
    expect(PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT).toBe(64);
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
describe('getPerpsProInfoStickyHeaderOffset', () => {
  it('leaves the row in place until the tabs stop above it', () => {
    // Natural tabs top 300 at scroll 0; the row starts at their bottom.
    expect(getPerpsProInfoStickyHeaderOffset(300, 344, 0)).toBe(0);
    expect(getPerpsProInfoStickyHeaderOffset(200, 344, 100)).toBe(0);
  });

  it('keeps the row under the stuck tabs as the list keeps scrolling', () => {
    // Tabs stuck at 96 while the list scrolled 260: row stays at 96 + 44.
    expect(getPerpsProInfoStickyHeaderOffset(96, 344, 260)).toBe(56);
    expect(344 - 260 + 56).toBe(96 + 44);
  });
});
