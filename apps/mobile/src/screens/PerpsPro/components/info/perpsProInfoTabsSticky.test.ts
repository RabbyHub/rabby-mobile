import {
  getPerpsProPopulatedInfoSectionBottomPadding,
  getPerpsProInfoSectionMinimumContentHeight,
  getPerpsProInfoTabsNaturalAnchor,
  PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT,
} from './perpsProInfoTabsSticky';

describe('Perps Pro info tabs sticky geometry', () => {
  it('preserves the 16px natural gap and 6px section divider after the trade row', () => {
    expect(
      getPerpsProInfoTabsNaturalAnchor({
        leadInHeight: 96,
        tradeRowHeight: 424,
      }),
    ).toBe(542);
    expect(PERPS_PRO_INFO_TABS_PLACEHOLDER_HEIGHT).toBe(60);
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
    ).toBe(386);
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
});
