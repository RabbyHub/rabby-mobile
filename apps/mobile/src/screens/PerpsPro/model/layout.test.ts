import {
  getPerpsProColumnLayout,
  getPerpsProMarketSelectorSnapPoint,
  getPerpsProPrecisionSheetLayout,
} from './layout';

describe('Perps Pro layout model', () => {
  it.each([
    [320, 112, 13, 165],
    [360, 124, 15, 191],
    [375, 129, 15, 201],
    [390, 135, 16, 209],
    [393, 136, 16, 211],
    [430, 136, 16, 248],
  ])(
    'keeps the order-book/trade columns continuous at %ipx',
    (windowWidth, orderBookWidth, gap, tradeWidth) => {
      expect(getPerpsProColumnLayout(windowWidth)).toMatchObject({
        gap,
        orderBookWidth,
        tradeWidth,
      });
    },
  );

  it('includes the handle, every precision option, and the bottom safe area', () => {
    const oneOption = getPerpsProPrecisionSheetLayout({
      bottomInset: 0,
      optionCount: 1,
      topInset: 47,
      windowHeight: 852,
    });
    const sixOptions = getPerpsProPrecisionSheetLayout({
      bottomInset: 34,
      optionCount: 6,
      topInset: 47,
      windowHeight: 852,
    });

    expect(oneOption).toEqual({
      bottomPadding: 16,
      contentHeight: 138,
      scrollEnabled: false,
      snapPoint: 150,
    });
    expect(sixOptions).toEqual({
      bottomPadding: 34,
      contentHeight: 376,
      scrollEnabled: false,
      snapPoint: 376,
    });
  });

  it('caps the precision sheet and lets its scroll view expose the last item', () => {
    expect(
      getPerpsProPrecisionSheetLayout({
        bottomInset: 34,
        optionCount: 12,
        topInset: 47,
        windowHeight: 568,
      }),
    ).toEqual({
      bottomPadding: 34,
      contentHeight: 640,
      scrollEnabled: true,
      snapPoint: 420,
    });
  });

  it('keeps the selector at the Figma y=120 baseline and respects larger top insets', () => {
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(732);
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 80,
        windowHeight: 852,
      }),
    ).toBe(732);
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 120,
        windowHeight: 852,
      }),
    ).toBe(716);
  });
});
