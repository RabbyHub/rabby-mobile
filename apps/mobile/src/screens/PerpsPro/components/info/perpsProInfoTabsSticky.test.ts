import {
  getPerpsProInfoSectionMinimumContentHeight,
  getPerpsProInfoTabsNaturalAnchor,
  PERPS_PRO_INFO_SECTION_BOTTOM_PADDING,
  PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT,
} from './perpsProInfoTabsSticky';

describe('Perps Pro info tabs sticky geometry', () => {
  it('keeps the 20px natural gap after the trade row with a 44px tab strip', () => {
    expect(
      getPerpsProInfoTabsNaturalAnchor({
        leadInHeight: 96,
        tradeRowHeight: 424,
      }),
    ).toBe(540);
    expect(PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT).toBe(64);
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

  it('ends long tabs with a fixed gap below the last row', () => {
    // Viewport-sized trailing padding made the Open Orders list show a tall
    // blank area below its last card (QA 1407).
    expect(PERPS_PRO_INFO_SECTION_BOTTOM_PADDING).toBe(36);
  });
});
