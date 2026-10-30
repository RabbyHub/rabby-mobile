import {
  getPerpsProColumnLayout,
  getPerpsProMarketSelectorSnapPoint,
  getPerpsProPositionTpSlFormMinimumHeight,
  getPerpsProPositionTpSlSnapPoint,
  getPerpsProPrecisionSheetLayout,
} from './layout';

describe('Perps Pro layout model', () => {
  it.each([
    [320, 112, 11, 165],
    [360, 124, 13, 191],
    [375, 129, 13, 201],
    [390, 135, 14, 209],
    [393, 136, 14, 211],
    [430, 136, 14, 248],
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
      bottomPadding: 36,
      contentHeight: 184,
      scrollEnabled: false,
      snapPoint: 184,
    });
    expect(sixOptions).toEqual({
      bottomPadding: 36,
      contentHeight: 484,
      scrollEnabled: false,
      snapPoint: 484,
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
      bottomPadding: 36,
      contentHeight: 844,
      scrollEnabled: true,
      snapPoint: 484,
    });
  });

  it('keeps the selector at the Figma y=104 baseline and respects larger top insets', () => {
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(748);
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 80,
        windowHeight: 852,
      }),
    ).toBe(748);
    expect(
      getPerpsProMarketSelectorSnapPoint({
        topInset: 120,
        windowHeight: 852,
      }),
    ).toBe(716);
  });

  it.each([
    [852, 59, 785],
    [874, 62, 804],
    [932, 59, 865],
    [667, 20, 639],
    [500, 47, 445],
    [852, 150, 694],
    [20, 59, 0],
    [Number.NaN, 59, 0],
    [852, Number.NaN, 844],
  ])(
    'keeps list, form and Add equally above the market bar at height %s and inset %s',
    (windowHeight, topInset, height) => {
      for (const page of ['list', 'form', 'add'] as const) {
        for (const formBottomPaddingExtra of [0, 34]) {
          expect(
            getPerpsProPositionTpSlSnapPoint({
              page,
              formBottomPaddingExtra,
              topInset,
              windowHeight,
            }),
          ).toBe(height);
        }
      }
    },
  );

  it('reserves the exact remaining 782px sheet height for every TP/SL form presentation', () => {
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'subpage',
        snapPoint: 782,
      }),
    ).toBe(538);
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'tab',
        snapPoint: 782,
      }),
    ).toBe(486);
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'inline-empty',
        snapPoint: 782,
      }),
    ).toBe(486);
  });
  it.each([
    ['modify', 622],
    ['position-modify', 616],
  ] as const)('sizes the %s page to its approved content', (page, height) => {
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page,
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(height);
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page,
        topInset: 47,
        windowHeight: 500,
      }),
    ).toBe(437);
  });
  it.each([
    ['subpage', 782, 538],
    ['subpage', 622, 378],
    ['position-modify', 616, 372],
  ] as const)(
    'preserves the %s form budget at height %s after moving the header outside scrolling',
    (presentation, snapPoint, minimumHeight) => {
      expect(
        getPerpsProPositionTpSlFormMinimumHeight({ presentation, snapPoint }),
      ).toBe(minimumHeight);
      expect(
        getPerpsProPositionTpSlFormMinimumHeight({
          presentation,
          snapPoint: snapPoint + 34,
        }),
      ).toBe(minimumHeight + 34);
      expect(
        getPerpsProPositionTpSlFormMinimumHeight({
          presentation,
          snapPoint: 437,
        }),
      ).toBe(193);
    },
  );
  it('preserves modify heights and their actual form bottom-padding increment', () => {
    for (const [page, base] of [
      ['modify', 622],
      ['position-modify', 616],
    ] as const) {
      expect(
        getPerpsProPositionTpSlSnapPoint({
          page,
          formBottomPaddingExtra: 24,
          topInset: 24,
          windowHeight: 900,
        }),
      ).toBe(base + 24);
      expect(
        getPerpsProPositionTpSlSnapPoint({
          page,
          formBottomPaddingExtra: 34,
          topInset: 47,
          windowHeight: 680,
        }),
      ).toBe(617);
    }
    for (const extra of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        getPerpsProPositionTpSlSnapPoint({
          page: 'modify',
          formBottomPaddingExtra: extra,
          topInset: 24,
          windowHeight: 900,
        }),
      ).toBe(622);
    }
  });
});
