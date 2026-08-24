import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockCancelAnimation = jest.fn();
const mockWithTiming = jest.fn((value: number) => value);

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { createAnimatedComponent: (component: unknown) => component },
    Easing: {
      cubic: (value: number) => value,
      out: (easing: (value: number) => number) => easing,
    },
    ReduceMotion: { System: 'system' },
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    withTiming: (...args: [number, object]) => mockWithTiming(...args),
  };
});

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() || key }),
}));

jest.mock('../common/PerpsProDottedUnderlineText', () => ({
  PerpsProDottedUnderlineText: require('react-native').Text,
}));

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('./PerpsProTpSlModeSheet', () => ({
  PerpsProTpSlModeSheet: ({
    onSelect,
    visible,
  }: {
    onSelect: (mode: 'roi') => void;
    visible: boolean;
  }) => {
    if (!visible) {
      return null;
    }
    const ReactModule = require('react');
    const { Pressable } = require('react-native');
    return ReactModule.createElement(Pressable, {
      onPress: () => onSelect('roi'),
      testID: 'mock-tpsl-mode-sheet',
    });
  },
}));

import type { PerpsProTpSlController } from '../../scene/usePerpsProTpSl';
import { PerpsProTpSlFields } from './PerpsProTpSlFields';
import { resolvePerpsProTpSlTooltipTone } from './PerpsProTpSlTooltip';

const draft = {
  enabled: true,
  sl: { mode: 'pnl' as const, rawMagnitude: '20' },
  tp: { mode: 'price' as const, rawMagnitude: '110' },
};

const evaluated = (kind: 'sl' | 'tp', triggerPrice: string) => ({
  estimatedPnl: kind === 'tp' ? '20' : '-20',
  estimatedRoi: kind === 'tp' ? '100' : '-100',
  kind,
  mode: draft[kind].mode,
  rawMagnitude: draft[kind].rawMagnitude,
  triggerPrice,
});

const LONG_DECIMAL = '999999999999999999999';

const textLayoutEvent = (...widths: number[]) => ({
  nativeEvent: { lines: widths.map(width => ({ width })) },
});

const tooltipWidth = () =>
  StyleSheet.flatten(screen.getByTestId('perps-pro-tpsl-tooltip').props.style)
    .width;

const tooltipMeasure = () =>
  screen.getByTestId('perps-pro-tpsl-tooltip-measure', {
    includeHiddenElements: true,
  });

const queryTooltipMeasure = () =>
  screen.queryByTestId('perps-pro-tpsl-tooltip-measure', {
    includeHiddenElements: true,
  });

const controller = (overrides: Partial<PerpsProTpSlController> = {}) =>
  ({
    clearForMarketChange: jest.fn(),
    blurFocusedLeg: jest.fn(),
    compatibilityError: null,
    disabled: false,
    focusedLeg: null,
    previews: {
      buy: { sl: evaluated('sl', '90'), tp: evaluated('tp', '110') },
      sell: { sl: evaluated('sl', '110'), tp: evaluated('tp', '90') },
    },
    setEnabled: jest.fn(),
    setFocusedLeg: jest.fn(),
    setMode: jest.fn(),
    setRawMagnitude: jest.fn(),
    ...overrides,
  } as PerpsProTpSlController);

describe('PerpsProTpSlFields', () => {
  beforeEach(() => {
    mockCancelAnimation.mockClear();
    mockWithTiming.mockClear();
  });

  it('colors Price profit by sign and Trigger values by trade direction', () => {
    const positive = evaluated('tp', '110');
    const negative = evaluated('sl', '90');
    const zero = { ...positive, estimatedPnl: '0' };

    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'buy',
        leg: positive,
        mode: 'price',
      }),
    ).toBe('positive');
    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'sell',
        leg: negative,
        mode: 'price',
      }),
    ).toBe('negative');
    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'buy',
        leg: zero,
        mode: 'price',
      }),
    ).toBe('neutral');
    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'buy',
        leg: negative,
        mode: 'pnl',
      }),
    ).toBe('positive');
    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'sell',
        leg: positive,
        mode: 'roi',
      }),
    ).toBe('negative');
    expect(
      resolvePerpsProTpSlTooltipTone({
        direction: 'buy',
        leg: null,
        mode: 'roi',
      }),
    ).toBe('neutral');
  });

  it('widens the quote unit while preserving the expanded TP/SL geometry', () => {
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-inputs').props.style,
      ),
    ).toMatchObject({ gap: 16 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-field').props.style,
      ),
    ).toMatchObject({
      borderRadius: 6,
      gap: 6,
      height: 40,
      paddingHorizontal: 8,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-mode').props.style,
      ),
    ).toMatchObject({ height: 24, width: 52 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-mode-content').props.style,
      ),
    ).toMatchObject({
      gap: 2,
      height: 16,
      left: 4,
      position: 'absolute',
      top: 4,
      width: 46,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-caret').props.style,
      ),
    ).toMatchObject({ height: 6, width: 8 });
    expect(screen.getByTestId('perps-pro-tpsl-tp-unit').props.children).toBe(
      'USDC',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-unit').props.style,
      ),
    ).toMatchObject({ fontSize: 12, lineHeight: 16, width: 36 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-label').props.style,
      ),
    ).toMatchObject({
      fontSize: 10,
      lineHeight: 12,
      textAlign: 'center',
      top: 4,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-input').props.style,
      ),
    ).toMatchObject({ height: 40, paddingTop: 12, textAlign: 'center' });
    expect(
      StyleSheet.flatten(screen.getByText('takeProfit').props.style),
    ).toMatchObject({ fontSize: 12, lineHeight: 16 });
    expect(
      screen.getByTestId('perps-pro-trade-checkbox-icon').props,
    ).toMatchObject({ height: 20, width: 20 });
  });

  it('uses a centered overlay placeholder and keeps the input geometry stable on focus', () => {
    const emptyDraft = {
      ...draft,
      tp: { ...draft.tp, mode: 'roi' as const, rawMagnitude: '' },
    };
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={emptyDraft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    const input = screen.getByTestId('perps-pro-tpsl-tp-input');
    expect(input.props.placeholder).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-placeholder').props.style,
      ),
    ).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      top: 11,
    });
    expect(screen.getByTestId('perps-pro-tpsl-tp-unit').props.children).toBe(
      '%',
    );

    fireEvent(input, 'focus');

    expect(screen.queryByTestId('perps-pro-tpsl-tp-placeholder')).toBeNull();
    expect(screen.getByTestId('perps-pro-tpsl-tp-label').props.children).toBe(
      'roiInput',
    );
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      height: 40,
      paddingTop: 12,
      textAlign: 'center',
    });
  });

  it('routes checkbox, input and independent mode events to the controller', () => {
    const tpSl = controller();
    render(
      <PerpsProTpSlFields
        controller={tpSl}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    fireEvent.press(screen.getByRole('checkbox'));
    expect(tpSl.setEnabled).toHaveBeenCalledWith(false);
    fireEvent.changeText(screen.getByTestId('perps-pro-tpsl-tp-input'), '120');
    expect(tpSl.setRawMagnitude).toHaveBeenCalledWith('tp', '120');
    expect(screen.getByText('−')).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-tpsl-sl-mode'));
    expect(tpSl.setFocusedLeg).toHaveBeenCalledWith(null);
    fireEvent.press(screen.getByTestId('mock-tpsl-mode-sheet'));
    expect(tpSl.setMode).toHaveBeenCalledWith('sl', 'roi');
  });

  it('uses the shared fill animation only for TP/SL Price revisions', () => {
    const view = render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
        slFillRevision={0}
        tpFillRevision={0}
      />,
    );
    mockCancelAnimation.mockClear();
    mockWithTiming.mockClear();

    view.rerender(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
        slFillRevision={1}
        tpFillRevision={1}
      />,
    );
    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 180, reduceMotion: 'system' }),
    );

    view.rerender(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
        slFillRevision={2}
        tpFillRevision={2}
      />,
    );
    expect(mockWithTiming).toHaveBeenCalledTimes(2);
  });

  it('centers the SL negative prefix together with the measured input value', () => {
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    fireEvent(screen.getByTestId('perps-pro-tpsl-sl-value-measure'), 'layout', {
      nativeEvent: { layout: { width: 28 } },
    });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-sl-negative-prefix').props.style,
      ),
    ).toMatchObject({
      fontWeight: '500',
      left: '50%',
      lineHeight: 18,
      top: 18,
      transform: [{ translateX: -18.5 }],
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-sl-input').props.style,
      ),
    ).toMatchObject({ paddingLeft: 9, textAlign: 'center' });
  });

  it('shows a live dual-direction tooltip only for the focused valid leg', () => {
    const view = render(
      <PerpsProTpSlFields
        controller={controller({ focusedLeg: null })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.queryByTestId('perps-pro-tpsl-tooltip')).toBeNull();

    view.rerender(
      <PerpsProTpSlFields
        controller={controller({ focusedLeg: 'tp' })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.getByTestId('perps-pro-tpsl-tooltip')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
      ),
    ).toMatchObject({ top: -27, width: 206 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip-body').props.style,
      ),
    ).toMatchObject({ borderRadius: 6, height: 40 });
    expect(screen.getByText(/buyProfit/)).toBeTruthy();
    expect(screen.getByText(/sellProfit/)).toBeTruthy();
  });

  it.each([
    ['buy', evaluated('tp', '110'), null],
    ['sell', null, evaluated('tp', '90')],
  ] as const)(
    'keeps both Price tooltip rows when only the %s preview is valid',
    (_side, buy, sell) => {
      render(
        <PerpsProTpSlFields
          controller={controller({
            focusedLeg: 'tp',
            previews: {
              buy: { sl: evaluated('sl', '90'), tp: buy },
              sell: { sl: evaluated('sl', '110'), tp: sell },
            },
          })}
          draft={draft}
          pxDecimals={2}
          quoteAsset="USDC"
        />,
      );

      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
        ),
      ).toMatchObject({ top: -27, width: 206 });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip-body').props.style,
        ),
      ).toMatchObject({ height: 40 });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip-tail').props.style,
        ),
      ).toMatchObject({ top: 36 });
      expect(screen.getByText(/buyProfit/)).toBeTruthy();
      expect(screen.getByText(/sellProfit/)).toBeTruthy();
      expect(screen.getByText('-- / --')).toBeTruthy();
    },
  );

  it('shows both Price placeholders when neither direction has a valid preview', () => {
    render(
      <PerpsProTpSlFields
        controller={controller({
          focusedLeg: 'tp',
          previews: {
            buy: { sl: evaluated('sl', '90'), tp: null },
            sell: { sl: evaluated('sl', '110'), tp: null },
          },
        })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(screen.getByTestId('perps-pro-tpsl-tooltip')).toBeTruthy();
    expect(screen.getByText(/buyProfit/)).toBeTruthy();
    expect(screen.getByText(/sellProfit/)).toBeTruthy();
    expect(screen.getAllByText('-- / --')).toHaveLength(2);
  });

  it('uses -- for an unavailable Trigger preview', () => {
    render(
      <PerpsProTpSlFields
        controller={controller({
          focusedLeg: 'sl',
          previews: {
            buy: { sl: evaluated('sl', '90'), tp: evaluated('tp', '110') },
            sell: { sl: null, tp: evaluated('tp', '90') },
          },
        })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(
      screen.getByTestId('perps-pro-tpsl-tooltip-buy-line'),
    ).toHaveTextContent('buyTrigger 90.00');
    expect(
      screen.getByTestId('perps-pro-tpsl-tooltip-sell-line'),
    ).toHaveTextContent('sellTrigger --');
  });

  it.each(['pnl', 'roi'] as const)(
    'grows and locks the %s Trigger tooltip at the Price width',
    mode => {
      const fields = (rawMagnitude: string, triggerPrice: string) => (
        <PerpsProTpSlFields
          controller={controller({
            focusedLeg: 'sl',
            previews: {
              buy: {
                sl: evaluated('sl', triggerPrice),
                tp: evaluated('tp', '110'),
              },
              sell: {
                sl: evaluated('sl', `1${triggerPrice}`),
                tp: evaluated('tp', '90'),
              },
            },
          })}
          draft={{
            ...draft,
            sl: { mode, rawMagnitude },
          }}
          pxDecimals={2}
          quoteAsset="USDC"
        />
      );
      const view = render(fields('1', '12345678.12'));

      const tooltipStyle = StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
      );
      expect(tooltipStyle).toMatchObject({
        maxWidth: 206,
        minWidth: 139,
        top: -27,
      });
      expect(tooltipStyle.width).toBe(139);
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip-tail').props.style,
        ),
      ).toMatchObject({
        left: '50%',
        top: 36,
        transform: [{ translateX: -36 }],
      });
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-buy-line'),
      ).toHaveTextContent('buyTrigger 12,345,678.12');
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-sell-line'),
      ).toHaveTextContent('sellTrigger 112,345,678.12');
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-buy-line').props
          .numberOfLines,
      ).toBe(1);
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-sell-line').props
          .numberOfLines,
      ).toBe(1);
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-buy-line').props
          .ellipsizeMode,
      ).toBe('tail');
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-sell-line').props
          .ellipsizeMode,
      ).toBe('tail');

      const staleMeasureHandler = tooltipMeasure().props.onTextLayout;
      fireEvent(tooltipMeasure(), 'textLayout', textLayoutEvent(145, 160));
      expect(tooltipWidth()).toBe(176);

      view.rerender(fields('10', '123456789.12'));
      act(() => staleMeasureHandler(textLayoutEvent(190, 190)));
      expect(tooltipWidth()).toBe(176);

      fireEvent(tooltipMeasure(), 'textLayout', textLayoutEvent(181, 189.2));
      expect(tooltipWidth()).toBe(206);
      expect(queryTooltipMeasure()).toBeNull();

      view.rerender(fields('100', LONG_DECIMAL));
      expect(tooltipWidth()).toBe(206);
      expect(queryTooltipMeasure()).toBeNull();

      view.rerender(fields('', LONG_DECIMAL));
      expect(screen.queryByTestId('perps-pro-tpsl-tooltip')).toBeNull();
      view.rerender(fields('1', '90'));
      expect(tooltipWidth()).toBe(139);
      expect(tooltipMeasure()).toBeTruthy();
    },
  );

  it.each(['pnl', 'roi'] as const)(
    'keeps the %s Trigger value in fixed-point notation after reaching max width',
    mode => {
      render(
        <PerpsProTpSlFields
          controller={controller({
            focusedLeg: 'sl',
            previews: {
              buy: {
                sl: evaluated('sl', LONG_DECIMAL),
                tp: evaluated('tp', '110'),
              },
              sell: {
                sl: evaluated('sl', `1${LONG_DECIMAL}`),
                tp: evaluated('tp', '90'),
              },
            },
          })}
          draft={{ ...draft, sl: { ...draft.sl, mode } }}
          pxDecimals={2}
          quoteAsset="USDC"
        />,
      );

      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-buy-line'),
      ).toHaveTextContent('buyTrigger 999,999,999,999,999,999,999.00');
      expect(
        screen.getByTestId('perps-pro-tpsl-tooltip-sell-line'),
      ).toHaveTextContent('sellTrigger 1,999,999,999,999,999,999,999.00');
      expect(screen.queryByText(/e\+/i)).toBeNull();
      fireEvent(tooltipMeasure(), 'textLayout', textLayoutEvent(250, 300));
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
        ),
      ).toMatchObject({ maxWidth: 206, minWidth: 139, width: 206 });
      expect(queryTooltipMeasure()).toBeNull();
    },
  );

  it('keeps Price profit values in fixed-point notation and aligned to the same tail anchor', () => {
    const largePriceLeg = {
      ...evaluated('tp', '110'),
      estimatedPnl: LONG_DECIMAL,
      estimatedRoi: `1${LONG_DECIMAL}`,
    };
    render(
      <PerpsProTpSlFields
        controller={controller({
          focusedLeg: 'tp',
          previews: {
            buy: { sl: evaluated('sl', '90'), tp: largePriceLeg },
            sell: { sl: evaluated('sl', '110'), tp: largePriceLeg },
          },
        })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(
      screen.getAllByText(
        /\+999,999,999,999,999,999,999\.00\(\+1,999,999,999,999,999,999,999\.00%\)/,
      ),
    ).toHaveLength(2);
    expect(screen.queryByText(/e\+/i)).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
      ),
    ).toMatchObject({ left: 0, width: 206 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip-tail').props.style,
      ),
    ).toMatchObject({
      left: '50%',
      transform: [{ translateX: -36 }],
    });
    expect(
      screen.getByTestId('perps-pro-tpsl-tooltip-buy-line').props.ellipsizeMode,
    ).toBe('tail');
    expect(
      screen.getByTestId('perps-pro-tpsl-tooltip-sell-line').props
        .ellipsizeMode,
    ).toBe('tail');
  });

  it('does not reserve inline error UI beside either TP/SL leg', () => {
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.queryByText('outsideLiquidationRange')).toBeNull();
  });
});
