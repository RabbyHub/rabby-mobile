import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

const mockFocusTextInput = jest.fn();
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

jest.mock('@/assets2024/icons/perps/PerpsProAmountUnitSwitch.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
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

jest.mock('@/assets2024/icons/perps/PerpsProAvailableAdd.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProAvailableSwap.svg', () => {
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

jest.mock('@/components/Typography', () => {
  const ReactModule = require('react');
  const { Text, TextInput } = require('react-native');
  return {
    Text,
    TextInput: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          focus: () =>
            mockFocusTextInput(
              (props as { accessibilityLabel?: string }).accessibilityLabel,
            ),
          setNativeProps: jest.fn(),
        }));
        return ReactModule.createElement(TextInput, props);
      },
    ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@rneui/themed', () => ({
  Slider: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, { ...props, testID: 'rne-slider' });
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() || key }),
}));

jest.mock('../common/PerpsProDottedUnderlineText', () => ({
  PerpsProDottedUnderlineText: require('react-native').Text,
}));

const mockDismissKeyboardThen = jest.fn((action: () => void) => action());
const mockBboSheetProps = jest.fn();

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => mockDismissKeyboardThen,
}));

jest.mock('../positions/PerpsProLeverageSheet', () => ({
  PerpsProLeverageSheet: () => null,
}));

jest.mock('./PerpsProBboSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProBboSheet: (props: object) => {
      mockBboSheetProps(props);
      return ReactModule.createElement(View, {
        ...props,
        testID: 'bbo-sheet',
      });
    },
  };
});

jest.mock('./PerpsProTifSheet', () => ({
  PerpsProTifSheet: () => null,
}));

jest.mock('./PerpsProMarginModeSheet', () => ({
  PerpsProMarginModeSheet: () => null,
}));

jest.mock('./PerpsProOrderTypeSheet', () => ({
  PerpsProOrderTypeSheet: () => null,
}));

jest.mock('./PerpsProTpSlModeSheet', () => ({
  PerpsProTpSlModeSheet: () => null,
}));

import { createPerpsProTradeFormState } from '../../model/trade';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PerpsProTradeForm } from './PerpsProTradeForm';
import { PERPS_PRO_PRICE_FILL_ANIMATION } from './PerpsProTradePriceField';
import { getPerpsProTradeSelectFontStyle } from './PerpsProTradePrimitives';

const market = {
  canonicalCoin: 'BTC',
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  marketData: {
    markPx: '63000',
    maxLeverage: 40,
    pxDecimals: 2,
    szDecimals: 5,
  },
  quoteAsset: 'USDC',
};

const controller = (
  formOverrides: Partial<ReturnType<typeof createPerpsProTradeFormState>> = {},
) =>
  ({
    attachedTpSlExecutionEnabled: true,
    amountDecimals: 2,
    amountSource: 'manual',
    amountUnitLabel: 'USDC',
    availableQuote: '1000',
    beginAmountEntry: jest.fn(),
    endAmountEntry: jest.fn(),
    confirmLeverage: jest.fn(async () => true),
    disableBbo: jest.fn(),
    enableBbo: jest.fn(),
    form: { ...createPerpsProTradeFormState(), ...formOverrides },
    getCostDisplayAmount: jest.fn(() => '0'),
    getEstimatedLiquidationPrice: jest.fn(() => null),
    getMaxDisplayAmount: jest.fn(() => '1000'),
    getSliderButtonDisplayAmount: jest.fn(() => null),
    leverage: 25,
    leveragePending: false,
    marginMode: 'isolated',
    marginModeDisabledReason: null,
    market,
    patchForm: jest.fn(),
    pending: false,
    percentage: 0,
    priceFillFeedback: null,
    reduceOnlyAvailability: {
      buyUnavailable: false,
      checkboxDisabled: false,
      hasPosition: true,
      sellUnavailable: false,
    },
    requestReview: jest.fn(),
    resolvedAmount: null,
    showAmountConversion: false,
    setAmount: jest.fn(),
    setConditionalExecution: jest.fn(),
    setLeverage: jest.fn(),
    setMarginMode: jest.fn(),
    setOrderType: jest.fn(),
    setPercentage: jest.fn(),
    setPrice: jest.fn(),
    setTif: jest.fn(),
    stepPrice: jest.fn(),
    toggleAmountUnit: jest.fn(),
    tpSl: {
      blurFocusedLeg: jest.fn(),
      clearForMarketChange: jest.fn(),
      compatibilityError: null,
      disabled: false,
      focusedLeg: null,
      previews: {
        buy: { sl: null, tp: null },
        sell: { sl: null, tp: null },
      },
      setEnabled: jest.fn(),
      setFocusedLeg: jest.fn(),
      setMode: jest.fn(),
      setRawMagnitude: jest.fn(),
    },
  } as unknown as PerpsProTradeController);

describe('PerpsProTradeForm order matrix', () => {
  beforeEach(() => {
    mockFocusTextInput.mockClear();
    mockDismissKeyboardThen.mockReset();
    mockDismissKeyboardThen.mockImplementation(action => action());
    mockCancelAnimation.mockClear();
    mockWithTiming.mockClear();
  });

  it('keeps the real form frame visible but fail-closed while configuration is preparing', () => {
    const trade = controller();
    render(
      <PerpsProTradeForm
        configurationReady={false}
        controller={trade}
        onAddFunds={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-pro-trade-form').props).toMatchObject({
      accessibilityState: { disabled: true },
      pointerEvents: 'none',
    });
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByTestId('perps-pro-trade-button-buy').props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('perps-pro-trade-button-sell').props.accessibilityState
        .disabled,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));
    expect(trade.requestReview).not.toHaveBeenCalled();
  });

  it('keeps the readable variant off the leverage configuration button only', () => {
    render(
      <PerpsProTradeForm controller={controller()} onAddFunds={jest.fn()} />,
    );

    const sharedFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);
    const isolatedStyle = StyleSheet.flatten(
      screen.getByText('isolated').props.style,
    );
    const leverageStyle = StyleSheet.flatten(
      screen.getByText('25x').props.style,
    );
    const orderTypeStyle = StyleSheet.flatten(
      screen.getByText('market').props.style,
    );

    const sharedVisibleStyle = {
      ...sharedFontStyle,
      fontSize: 14,
      lineHeight: 18,
    };

    expect(isolatedStyle).toMatchObject(sharedVisibleStyle);
    expect(orderTypeStyle).toMatchObject(sharedVisibleStyle);
    expect(leverageStyle).toMatchObject({
      fontFamily: sharedVisibleStyle.fontFamily,
      fontSize: 14,
      lineHeight: 18,
    });
    expect(leverageStyle.fontVariant).toBeUndefined();
    expect(isolatedStyle.fontVariant).toEqual(['stylistic-six']);
    expect(orderTypeStyle.fontVariant).toEqual(['stylistic-six']);
  });

  it('keeps every selector on the same platform font and stylistic variant', () => {
    expect(getPerpsProTradeSelectFontStyle('android')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Medium',
      fontVariant: ['stylistic-six'],
    });
    expect(getPerpsProTradeSelectFontStyle('ios')).toEqual({
      fontFamily: 'SF Pro',
      fontWeight: '500',
      fontVariant: ['stylistic-six'],
    });
  });

  it('keeps Market free of Price, BBO and TIF controls', () => {
    render(
      <PerpsProTradeForm controller={controller()} onAddFunds={jest.fn()} />,
    );

    expect(screen.queryByTestId('perps-pro-trade-price-field')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-tif-trigger')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
  });

  it('keeps TIF visible for both manual Limit and BBO', () => {
    const view = render(
      <PerpsProTradeForm
        controller={controller({ limitPrice: '63000', orderType: 'limit' })}
        onAddFunds={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-pro-trade-tif-trigger')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-trade-price-suffix-BBO')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('BBO').props.style),
    ).toMatchObject({
      ...getPerpsProTradeSelectFontStyle(Platform.OS),
      fontSize: 12,
      lineHeight: 16,
    });

    view.rerender(
      <PerpsProTradeForm
        controller={controller({
          bboEnabled: true,
          limitPrice: '63000',
          orderType: 'limit',
        })}
        onAddFunds={jest.fn()}
      />,
    );
    expect(screen.getByTestId('perps-pro-trade-tif-trigger')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Counterparty 1').props.style),
    ).toMatchObject({
      ...getPerpsProTradeSelectFontStyle(Platform.OS),
      fontSize: 14,
      lineHeight: 18,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-caret').props.style,
      ),
    ).toMatchObject({
      flexShrink: 0,
      height: 6,
      width: 8,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-strategy-label').props.style,
      ),
    ).toMatchObject({
      flex: 1,
      fontSize: 14,
      lineHeight: 18,
      minWidth: 0,
      textAlign: 'center',
    });
    expect(
      screen.getByTestId('perps-pro-trade-bbo-strategy-label').props
        .numberOfLines,
    ).toBe(1);
    expect(
      screen.getByTestId('perps-pro-trade-bbo-strategy-label').props
        .ellipsizeMode,
    ).toBe('tail');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-field').props.style,
      ),
    ).toMatchObject({ flexDirection: 'row', gap: 4, height: 40 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-strategy').props.style,
      ),
    ).toMatchObject({
      backgroundColor: '#F4F5F5',
      borderRadius: 6,
      flex: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    });
    expect(
      screen.getByTestId('perps-pro-trade-bbo-caret-glyph').props,
    ).toMatchObject({
      height: 4.11638,
      width: 5.69228,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-caret-glyph').props.style,
      ),
    ).toMatchObject({ transform: [{ rotate: '180deg' }] });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-price-suffix-BBO').props.style,
      ),
    ).toMatchObject({
      backgroundColor: '#F4F5F5',
      borderRadius: 8,
      borderWidth: 1,
      height: 40,
      paddingHorizontal: 8,
      paddingVertical: 4,
      width: 60,
    });
    expect(
      StyleSheet.flatten(screen.getByText('BBO').props.style),
    ).toMatchObject({
      ...getPerpsProTradeSelectFontStyle(Platform.OS),
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      width: 40,
    });
    expect(screen.getByText('BBO').props.numberOfLines).toBe(1);
    expect(screen.queryByText('price')).toBeNull();
  });

  it('enables Counterparty 1 without opening BBO until the strategy is pressed', () => {
    const trade = controller({
      bboStrategy: 'q5',
      limitPrice: '63000',
      orderType: 'limit',
    });
    const view = render(
      <PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-trade-price-suffix-BBO'));

    expect(trade.enableBbo).toHaveBeenCalledTimes(1);
    expect(trade.enableBbo).toHaveBeenCalledWith('cp1');
    expect(mockDismissKeyboardThen).not.toHaveBeenCalled();
    expect(mockBboSheetProps.mock.lastCall?.[0].visible).toBe(false);

    view.rerender(
      <PerpsProTradeForm
        controller={{
          ...trade,
          form: { ...trade.form, bboEnabled: true, bboStrategy: 'cp1' },
        }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(screen.getByText('Counterparty 1')).toBeTruthy();
    expect(mockBboSheetProps.mock.lastCall?.[0].visible).toBe(false);

    fireEvent.press(screen.getByTestId('perps-pro-trade-price-suffix-BBO'));
    expect(trade.disableBbo).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText('Counterparty 1'));
    expect(mockDismissKeyboardThen).toHaveBeenCalledTimes(1);
    expect(mockBboSheetProps.mock.lastCall?.[0].visible).toBe(true);

    act(() => mockBboSheetProps.mock.lastCall?.[0].onSelect('q5'));
    expect(trade.enableBbo).toHaveBeenLastCalledWith('q5');
  });

  it('disables BBO while TP/SL is enabled', () => {
    const base = createPerpsProTradeFormState({ orderType: 'limit' });
    const trade = controller({
      attachedTpSl: { ...base.attachedTpSl, enabled: true },
      limitPrice: '63000',
      orderType: 'limit',
    });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    const bbo = screen.getByTestId('perps-pro-trade-price-suffix-BBO');
    expect(StyleSheet.flatten(bbo.props.style)).toMatchObject({
      opacity: 0.45,
    });
    fireEvent.press(bbo);
    expect(trade.enableBbo).not.toHaveBeenCalled();
  });

  it.each(['Ioc', 'Alo'] as const)('disables BBO while TIF is %s', tif => {
    const trade = controller({
      limitPrice: '63000',
      orderType: 'limit',
      tif,
    });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    const bbo = screen.getByTestId('perps-pro-trade-price-suffix-BBO');
    expect(StyleSheet.flatten(bbo.props.style)).toMatchObject({
      opacity: 0.45,
    });
    fireEvent.press(bbo);
    expect(trade.enableBbo).not.toHaveBeenCalled();
    expect(screen.getByTestId('perps-pro-trade-tif-trigger')).toBeTruthy();
  });

  it('keeps TP/SL clickable while BBO is active so the controller can replace it', () => {
    const trade = controller({
      bboEnabled: true,
      bboStrategy: 'q5',
      orderType: 'limit',
    });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getAllByRole('checkbox')[0]);
    expect(trade.tpSl.setEnabled).toHaveBeenCalledWith(true);
  });

  it('keeps the Limit Price native input stable behind the Size-matched overlay', () => {
    render(
      <PerpsProTradeForm
        controller={controller({ orderType: 'limit' })}
        onAddFunds={jest.fn()}
      />,
    );
    const price = screen.getByLabelText('price(USDC)');
    const initialInputStyle = StyleSheet.flatten(price.props.style);
    const placeholder = screen.getByTestId('perps-pro-trade-price-placeholder');

    expect(price.props.placeholder).toBeUndefined();
    expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      top: 11,
    });
    expect(price.props.multiline).toBe(false);
    expect(screen.queryByLabelText('Decrease price(USDC)')).toBeNull();
    expect(screen.queryByLabelText('Increase price(USDC)')).toBeNull();

    fireEvent(price, 'focus');
    expect(
      screen.queryByTestId('perps-pro-trade-price-placeholder'),
    ).toBeNull();
    expect(screen.getByTestId('perps-pro-trade-price-label')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByLabelText('price(USDC)').props.style),
    ).toEqual(initialInputStyle);
  });

  it('removes a sixth CXMT significant figure from the native input', () => {
    const trade = controller({ orderType: 'limit' });
    trade.market = {
      ...market,
      canonicalCoin: 'xyz:CXMT',
      displayBase: 'CXMT',
      displayPair: 'CXMTUSDC',
      marketData: {
        ...market.marketData,
        markPx: '8.28',
        pxDecimals: 4,
        szDecimals: 1,
      },
    } as PerpsProTradeController['market'];
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    const price = screen.getByLabelText('price(USDC)');
    fireEvent.changeText(price, '12.3456');

    expect(trade.setPrice).toHaveBeenCalledWith('limitPrice', '12.345');
    expect(screen.getByLabelText('price(USDC)').props.value).toBe('12.345');
  });

  it('animates only accepted order-book fill revisions, including repeated prices', () => {
    const base = controller({ orderType: 'limit' });
    const view = render(
      <PerpsProTradeForm controller={base} onAddFunds={jest.fn()} />,
    );
    mockCancelAnimation.mockClear();
    mockWithTiming.mockClear();

    view.rerender(
      <PerpsProTradeForm
        controller={{
          ...base,
          form: { ...base.form, limitPrice: '63000' },
          priceFillFeedback: { field: 'limitPrice', revision: 1 },
        }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        duration: PERPS_PRO_PRICE_FILL_ANIMATION.durationMs,
        reduceMotion: 'system',
      }),
    );

    view.rerender(
      <PerpsProTradeForm
        controller={{
          ...base,
          form: { ...base.form, limitPrice: '63000' },
          priceFillFeedback: { field: 'limitPrice', revision: 2 },
        }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(mockWithTiming).toHaveBeenCalledTimes(2);

    view.rerender(
      <PerpsProTradeForm
        controller={{
          ...base,
          form: { ...base.form, limitPrice: '64000' },
          priceFillFeedback: { field: 'limitPrice', revision: 2 },
        }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(mockWithTiming).toHaveBeenCalledTimes(2);
  });

  it('keeps Conditional Trigger and Limit Price geometry stable on focus', () => {
    render(
      <PerpsProTradeForm
        controller={controller({
          conditionalExecution: 'limit',
          orderType: 'conditional',
        })}
        onAddFunds={jest.fn()}
      />,
    );
    const trigger = screen.getByLabelText('triggerPrice(USDC)');
    const limit = screen.getByLabelText('price(USDC)');
    const triggerStyle = StyleSheet.flatten(trigger.props.style);
    const limitStyle = StyleSheet.flatten(limit.props.style);

    expect(trigger.props.placeholder).toBeUndefined();
    expect(limit.props.placeholder).toBeUndefined();
    expect(
      screen.getAllByTestId('perps-pro-trade-price-placeholder'),
    ).toHaveLength(2);

    fireEvent(trigger, 'focus');
    expect(
      StyleSheet.flatten(
        screen.getByLabelText('triggerPrice(USDC)').props.style,
      ),
    ).toEqual(triggerStyle);
    fireEvent(trigger, 'blur');
    fireEvent(limit, 'focus');
    expect(
      StyleSheet.flatten(screen.getByLabelText('price(USDC)').props.style),
    ).toEqual(limitStyle);
  });

  it('allows only Market or manual Limit execution inside Conditional', () => {
    const trade = controller({
      orderType: 'conditional',
      triggerPrice: '64000',
    });
    const view = render(
      <PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />,
    );

    expect(screen.getAllByTestId('perps-pro-trade-price-field')).toHaveLength(
      2,
    );
    expect(
      screen.getByTestId('perps-pro-trade-price-suffix-market'),
    ).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-tif-trigger')).toBeNull();
    expect(screen.getByLabelText('triggerPrice(USDC)')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-conditional-execution-value').props
          .style,
      ),
    ).toMatchObject({ opacity: 0.5 });
    expect(
      StyleSheet.flatten(screen.getByText('market').props.style),
    ).toMatchObject({
      ...getPerpsProTradeSelectFontStyle(Platform.OS),
      fontSize: 10,
      lineHeight: 12,
    });
    expect(
      screen.getByTestId('perps-pro-trade-conditional-execution-switch'),
    ).toHaveProp('height', 10);
    expect(
      screen.getByTestId('perps-pro-trade-conditional-execution-switch'),
    ).toHaveProp('width', 10);

    fireEvent.press(screen.getByTestId('perps-pro-trade-price-suffix-market'));
    expect(trade.setConditionalExecution).toHaveBeenCalledWith('limit');

    view.rerender(
      <PerpsProTradeForm
        controller={{
          ...trade,
          form: {
            ...trade.form,
            conditionalExecution: 'limit',
            conditionalLimitPrice: '64100',
          },
        }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-trade-price-suffix-limit'),
    ).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-conditional-execution-value').props
          .style,
      ).opacity,
    ).toBeUndefined();

    fireEvent.press(screen.getByTestId('perps-pro-trade-price-suffix-limit'));
    expect(trade.setConditionalExecution).toHaveBeenLastCalledWith('market');
  });

  it('routes the Amount unit control to the shared unit toggle', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-amount-unit'));
    expect(trade.toggleAmountUnit).toHaveBeenCalledTimes(1);
  });

  it('keeps the Amount native input geometry stable while moving its visual label', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);
    const amountInput = screen.getByLabelText('amount(USDC)');
    const initialInputStyle = StyleSheet.flatten(amountInput.props.style);

    expect(amountInput.props.placeholder).toBeUndefined();
    expect(screen.getByTestId('perps-pro-amount-placeholder')).toBeTruthy();
    fireEvent(amountInput, 'focus');
    expect(screen.getByLabelText('amount(USDC)').props.multiline).toBe(false);
    expect(screen.queryByTestId('perps-pro-amount-placeholder')).toBeNull();
    expect(screen.getByTestId('perps-pro-amount-label')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByLabelText('amount(USDC)').props.style),
    ).toEqual(initialInputStyle);
    fireEvent(screen.getByLabelText('amount(USDC)'), 'blur');
    expect(screen.getByTestId('perps-pro-amount-placeholder')).toBeTruthy();
    expect(trade.endAmountEntry).toHaveBeenCalledTimes(1);
  });

  it('begins manual Amount entry on press even when the input is already focused', () => {
    const trade = controller({ amount: '30%' });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);
    const amountInput = screen.getByLabelText('amount(USDC)');

    fireEvent(amountInput, 'focus');
    trade.beginAmountEntry.mockClear();
    fireEvent(amountInput, 'pressIn');

    expect(trade.beginAmountEntry).toHaveBeenCalledTimes(1);
  });

  it('renders liquidation for both sides and preserves unavailable as --', () => {
    const trade = controller() as any;
    trade.resolvedAmount = { baseSize: '1', quoteAmount: '63000' };
    trade.getEstimatedLiquidationPrice = jest.fn((side: 'buy' | 'sell') =>
      side === 'buy' ? '50000.00' : '--',
    );
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    expect(screen.getAllByText('liquidationPrice')).toHaveLength(2);
    expect(screen.getByText('50,000.00 USDC')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('shows converted Amount only for manual input, not Slider input', () => {
    const trade = controller() as any;
    trade.resolvedAmount = { baseSize: '1', quoteAmount: '63000' };
    trade.showAmountConversion = true;
    const view = render(
      <PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />,
    );

    expect(screen.getByText('≈ 1.00000 BTC')).toBeTruthy();

    view.rerender(
      <PerpsProTradeForm
        controller={{ ...trade, showAmountConversion: false }}
        onAddFunds={jest.fn()}
      />,
    );
    expect(screen.queryByText('≈ 1.00000 BTC')).toBeNull();
  });

  it('shows direction-specific Slider amounts in the selected unit', () => {
    const trade = controller({ amountUnit: 'base' }) as any;
    trade.amountUnitLabel = 'BTC';
    trade.getSliderButtonDisplayAmount = jest.fn((side: 'buy' | 'sell') =>
      side === 'buy' ? '1.23456' : '0',
    );
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    expect(
      screen.getByTestId('perps-pro-trade-button-buy-amount').props.children,
    ).toBe('≈1.23456 BTC');
    expect(
      screen.getByTestId('perps-pro-trade-button-sell-amount').props.children,
    ).toBe('≈0.00000 BTC');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-button-buy').props.style,
      ),
    ).toMatchObject({ height: 40 });
  });

  it('waits for keyboard dismissal before requesting Buy or Sell review', () => {
    const trade = controller({ amount: '10' });
    let pendingAction: (() => void) | null = null;
    mockDismissKeyboardThen.mockImplementation(action => {
      pendingAction = action;
    });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));
    expect(mockDismissKeyboardThen).toHaveBeenCalledTimes(1);
    expect(trade.requestReview).not.toHaveBeenCalled();

    act(() => {
      pendingAction?.();
    });
    expect(trade.requestReview).toHaveBeenCalledTimes(1);
    expect(trade.requestReview).toHaveBeenLastCalledWith('buy');

    pendingAction = null;
    trade.requestReview.mockClear();
    fireEvent.press(screen.getByTestId('perps-pro-trade-button-sell'));
    expect(mockDismissKeyboardThen).toHaveBeenCalledTimes(2);
    expect(trade.requestReview).not.toHaveBeenCalled();

    act(() => {
      pendingAction?.();
    });
    expect(trade.requestReview).toHaveBeenCalledTimes(1);
    expect(trade.requestReview).toHaveBeenLastCalledWith('sell');
  });

  it('uses the latest requestReview callback after keyboard dismissal', () => {
    const initialTrade = controller({ amount: '10' });
    const latestTrade = controller({ amount: '10' });
    let pendingAction: (() => void) | null = null;
    mockDismissKeyboardThen.mockImplementation(action => {
      pendingAction = action;
    });
    const view = render(
      <PerpsProTradeForm controller={initialTrade} onAddFunds={jest.fn()} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));
    expect(initialTrade.requestReview).not.toHaveBeenCalled();

    view.rerender(
      <PerpsProTradeForm controller={latestTrade} onAddFunds={jest.fn()} />,
    );
    act(() => {
      pendingAction?.();
    });

    expect(initialTrade.requestReview).not.toHaveBeenCalled();
    expect(latestTrade.requestReview).toHaveBeenCalledTimes(1);
    expect(latestTrade.requestReview).toHaveBeenCalledWith('buy');
  });

  it('delegates add-funds immediately so the Scene can freeze the tap intent', () => {
    const onAddFunds = jest.fn();
    mockDismissKeyboardThen.mockImplementation(action => {
      throw new Error(`Form must not delay add-funds: ${String(action)}`);
    });
    render(
      <PerpsProTradeForm controller={controller()} onAddFunds={onAddFunds} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-trade-available-deposit'));

    expect(onAddFunds).toHaveBeenCalledTimes(1);
    expect(mockDismissKeyboardThen).not.toHaveBeenCalled();
  });

  it('focuses Amount instead of requesting review when manual Amount is empty', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));

    expect(mockFocusTextInput).toHaveBeenCalledWith('amount(USDC)');
    expect(mockDismissKeyboardThen).not.toHaveBeenCalled();
    expect(trade.requestReview).not.toHaveBeenCalled();
  });

  it('focuses an empty Conditional Trigger Price before submitting a valid Amount', () => {
    const trade = controller({
      amount: '10',
      orderType: 'conditional',
      triggerPrice: '',
    });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));

    expect(mockFocusTextInput).toHaveBeenCalledWith('triggerPrice(USDC)');
    expect(mockDismissKeyboardThen).not.toHaveBeenCalled();
    expect(trade.requestReview).not.toHaveBeenCalled();
  });

  it('focuses an empty Trigger Price without clearing valid Slider input', () => {
    const trade = controller({
      amount: '25%',
      orderType: 'conditional',
      triggerPrice: '',
    }) as any;
    trade.amountSource = 'slider';
    trade.percentage = 25;
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-sell'));

    expect(mockFocusTextInput).toHaveBeenCalledWith('triggerPrice(USDC)');
    expect(trade.beginAmountEntry).not.toHaveBeenCalled();
    expect(trade.form.amount).toBe('25%');
    expect(trade.percentage).toBe(25);
    expect(trade.requestReview).not.toHaveBeenCalled();
  });

  it('keeps a Slider percentage as valid input when Buy is pressed', () => {
    const trade = controller({ amount: '25%' }) as any;
    trade.amountSource = 'slider';
    trade.percentage = 25;
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));

    expect(trade.beginAmountEntry).not.toHaveBeenCalled();
    expect(trade.requestReview).toHaveBeenCalledWith('buy');
    expect(trade.form.amount).toBe('25%');
    expect(trade.percentage).toBe(25);
  });

  it('makes the Available value and USDC text part of the Deposit target', () => {
    const onDeposit = jest.fn();
    render(
      <PerpsProTradeForm controller={controller()} onAddFunds={onDeposit} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-trade-available-deposit'));
    expect(onDeposit).toHaveBeenCalledTimes(1);
  });

  it('renders and invokes the Swap add-funds action', () => {
    const onAddFunds = jest.fn();
    render(
      <PerpsProTradeForm
        addFundsMode="swap"
        controller={controller()}
        onAddFunds={onAddFunds}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-trade-available-swap').props,
    ).toMatchObject({
      color: 'neutral-title-1',
      height: 16,
      width: 16,
    });
    expect(screen.queryByText('swap')).toBeNull();
    fireEvent.press(screen.getByTestId('perps-pro-trade-available-deposit'));
    expect(onAddFunds).toHaveBeenCalledTimes(1);
  });

  it('uses the shared precision caret for TIF', () => {
    render(
      <PerpsProTradeForm
        controller={controller({ orderType: 'limit' })}
        onAddFunds={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-pro-trade-tif-caret')).toBeTruthy();
    expect(screen.queryByText('⌄')).toBeNull();
  });

  it('dismisses Amount focus when Slider interaction takes ownership', () => {
    const dismiss = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => undefined);
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);
    const slider = screen.getByTestId('rne-slider');

    expect(
      screen.getAllByTestId('perps-pro-trade-amount-slider-point'),
    ).toHaveLength(5);
    fireEvent(slider, 'valueChange', 42.6);
    expect(trade.setPercentage).toHaveBeenCalledWith(43);
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent(slider, 'slidingStart');
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeTruthy();
    fireEvent(slider, 'slidingComplete', 43);
    expect(
      screen.queryByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeNull();

    fireEvent(
      screen.getByTestId('perps-pro-trade-amount-slider'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(trade.setPercentage).toHaveBeenLastCalledWith(25);
    dismiss.mockRestore();
  });

  it('disables TP/SL for Reduce Only without clearing either leg draft', () => {
    const attachedTpSl = {
      enabled: true,
      sl: { mode: 'pnl' as const, rawMagnitude: '10' },
      tp: { mode: 'roi' as const, rawMagnitude: '20' },
    };
    const trade = controller({ attachedTpSl });
    render(<PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />);

    fireEvent.press(screen.getAllByRole('checkbox')[1]);
    expect(trade.patchForm).toHaveBeenCalledWith({
      attachedTpSl: { ...attachedTpSl, enabled: false },
      reduceOnly: true,
    });
  });

  it('keeps Reduce Only directions clickable while disabling an empty-position checkbox', () => {
    const trade = controller({ amount: '10', reduceOnly: true });
    trade.reduceOnlyAvailability = {
      buyUnavailable: true,
      checkboxDisabled: false,
      hasPosition: true,
      sellUnavailable: false,
    };
    const view = render(
      <PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />,
    );

    expect(
      screen.getByTestId('perps-pro-trade-button-buy').props.accessibilityState
        .disabled,
    ).toBe(false);
    expect(
      screen.getByTestId('perps-pro-trade-button-sell').props.accessibilityState
        .disabled,
    ).toBe(false);
    fireEvent.press(screen.getByTestId('perps-pro-trade-button-buy'));
    expect(trade.requestReview).toHaveBeenCalledWith('buy');

    trade.reduceOnlyAvailability = {
      buyUnavailable: false,
      checkboxDisabled: true,
      hasPosition: false,
      sellUnavailable: false,
    };
    view.rerender(
      <PerpsProTradeForm controller={trade} onAddFunds={jest.fn()} />,
    );
    expect(screen.getAllByRole('checkbox')[1].props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
