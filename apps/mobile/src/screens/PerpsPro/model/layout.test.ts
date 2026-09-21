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

  it('uses the Figma list and form top offsets for Position TP/SL', () => {
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'list',
        topInset: 47,
        windowHeight: 852,
      }),
    ).toBe(755);
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
    ['add', 652],
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
  it('grows for the error line but clamps long content to the safe viewport', () => {
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'form',
        topInset: 47,
        windowHeight: 852,
        formContentHeight: 502,
      }),
    ).toBe(774);
    expect(
      getPerpsProPositionTpSlSnapPoint({
        page: 'form',
        topInset: 47,
        windowHeight: 852,
        formContentHeight: 1500,
      }),
    ).toBe(789);
  });
});
