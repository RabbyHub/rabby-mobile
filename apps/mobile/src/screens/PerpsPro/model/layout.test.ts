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

  it('keeps both main TP/SL tabs at the same safe capped height', () => {
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'list',
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(758);
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'form',
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(758);
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'form',
        topInset: 150,
        windowHeight: 852,
      }),
    ).toBe(686);
  });

  it('reserves the exact remaining 758px sheet height for every TP/SL form presentation', () => {
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'subpage',
        snapPoint: 758,
      }),
    ).toBe(532);
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'tab',
        snapPoint: 758,
      }),
    ).toBe(486);
    expect(
      getPerpsProPositionTpSlFormMinimumHeight({
        presentation: 'inline-empty',
        snapPoint: 758,
      }),
    ).toBe(486);
  });
  it.each([
    ['add', 704],
    ['modify', 604],
    ['position-modify', 598],
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
  it('budgets both normal PnL hints and only the actual form bottom-padding increment', () => {
    for (const [page, base] of [
      ['form', 758],
      ['add', 704],
      ['modify', 604],
      ['position-modify', 598],
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
    for (const [page, height] of [['list', 758]] as const) {
      expect(
        getPerpsProPositionTpSlSnapPoint({
          page,
          formBottomPaddingExtra: 34,
          topInset: 24,
          windowHeight: 900,
        }),
      ).toBe(height);
    }
    for (const extra of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        getPerpsProPositionTpSlSnapPoint({
          page: 'add',
          formBottomPaddingExtra: extra,
          topInset: 24,
          windowHeight: 900,
        }),
      ).toBe(704);
    }
  });
});
