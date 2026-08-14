import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';

jest.mock('@/assets/icons/swap/switch-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProAmountUnitArrow.svg', () => {
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

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => mockDismissKeyboardThen,
}));

jest.mock('../positions/PerpsProLeverageSheet', () => ({
  PerpsProLeverageSheet: () => null,
}));

jest.mock('./PerpsProBboSheet', () => ({
  PerpsProBboSheet: () => null,
}));

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
    amountUnitLabel: 'USDC',
    availableQuote: '1000',
    beginAmountEntry: jest.fn(),
    confirmLeverage: jest.fn(async () => true),
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
    mockDismissKeyboardThen.mockReset();
    mockDismissKeyboardThen.mockImplementation(action => action());
  });

  it('uses the shared selector font and the isolated stylistic I', () => {
    render(
      <PerpsProTradeForm controller={controller()} onDeposit={jest.fn()} />,
    );

    const sharedFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);
    const isolatedStyle = StyleSheet.flatten(
      screen.getByText('isolated').props.style,
    );
    const leverageStyle = StyleSheet.flatten(
      screen.getByText('25x').props.style,
    );

    expect(isolatedStyle).toMatchObject({
      ...sharedFontStyle,
      fontVariant: ['stylistic-six'],
    });
    expect(leverageStyle).toMatchObject(sharedFontStyle);
    expect(isolatedStyle.fontFamily).toBe(leverageStyle.fontFamily);
  });

  it('uses an Android bundled font whose ss06 changes the isolated glyph', () => {
    expect(getPerpsProTradeSelectFontStyle('android')).toEqual({
      fontFamily: 'SF-Pro-Rounded-Medium',
    });
    expect(getPerpsProTradeSelectFontStyle('ios')).toEqual({
      fontFamily: 'SF Pro',
      fontWeight: '500',
    });
  });

  it('keeps Market free of Price, BBO and TIF controls', () => {
    render(
      <PerpsProTradeForm controller={controller()} onDeposit={jest.fn()} />,
    );

    expect(screen.queryByTestId('perps-pro-trade-price-field')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-tif-trigger')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
  });

  it('shows TIF only for manual Limit and removes it for fixed-GTC BBO', () => {
    const view = render(
      <PerpsProTradeForm
        controller={controller({ limitPrice: '63000', orderType: 'limit' })}
        onDeposit={jest.fn()}
      />,
    );

    expect(screen.getByTestId('perps-pro-trade-tif-trigger')).toBeTruthy();
    expect(screen.getByTestId('perps-pro-trade-price-suffix-BBO')).toBeTruthy();

    view.rerender(
      <PerpsProTradeForm
        controller={controller({
          bboEnabled: true,
          limitPrice: '63000',
          orderType: 'limit',
        })}
        onDeposit={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('perps-pro-trade-tif-trigger')).toBeNull();
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
      transform: [{ rotate: '180deg' }],
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-bbo-strategy-label').props.style,
      ),
    ).toMatchObject({ flex: 1, minWidth: 0, textAlign: 'center' });
    expect(screen.getByTestId('perps-pro-trade-bbo-caret').props).toMatchObject(
      { height: 6, width: 8 },
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-trade-price-suffix-BBO').props.style,
      ),
    ).toMatchObject({ borderRadius: 8, width: 60 });
    expect(screen.queryByText('price')).toBeNull();
  });

  it('keeps the Limit Price native input stable behind a 12px overlay', () => {
    render(
      <PerpsProTradeForm
        controller={controller({ orderType: 'limit' })}
        onDeposit={jest.fn()}
      />,
    );
    const price = screen.getByLabelText('price(USDC)');
    const initialInputStyle = StyleSheet.flatten(price.props.style);
    const placeholder = screen.getByTestId('perps-pro-trade-price-placeholder');

    expect(price.props.placeholder).toBeUndefined();
    expect(StyleSheet.flatten(placeholder.props.style)?.fontSize).toBe(12);
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

  it('keeps Conditional Trigger and Limit Price geometry stable on focus', () => {
    render(
      <PerpsProTradeForm
        controller={controller({
          conditionalExecution: 'limit',
          orderType: 'conditional',
        })}
        onDeposit={jest.fn()}
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
      <PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />,
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
    ).toBeTruthy();

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
        onDeposit={jest.fn()}
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
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-amount-unit'));
    expect(trade.toggleAmountUnit).toHaveBeenCalledTimes(1);
  });

  it('keeps the Amount native input geometry stable while moving its visual label', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);
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
  });

  it('begins manual Amount entry on press even when the input is already focused', () => {
    const trade = controller({ amount: '30%' });
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);
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
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

    expect(screen.getAllByText('liquidationPrice')).toHaveLength(2);
    expect(screen.getByText('50,000.00 USDC')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('shows converted Amount only for manual input, not Slider input', () => {
    const trade = controller() as any;
    trade.resolvedAmount = { baseSize: '1', quoteAmount: '63000' };
    trade.showAmountConversion = true;
    const view = render(
      <PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />,
    );

    expect(screen.getByText('≈ 1.00000 BTC')).toBeTruthy();

    view.rerender(
      <PerpsProTradeForm
        controller={{ ...trade, showAmountConversion: false }}
        onDeposit={jest.fn()}
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
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

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
    const trade = controller();
    let pendingAction: (() => void) | null = null;
    mockDismissKeyboardThen.mockImplementation(action => {
      pendingAction = action;
    });
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

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

  it('makes the Available value and USDC text part of the Deposit target', () => {
    const onDeposit = jest.fn();
    render(
      <PerpsProTradeForm controller={controller()} onDeposit={onDeposit} />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-trade-available-deposit'));
    expect(onDeposit).toHaveBeenCalledTimes(1);
  });

  it('uses the shared precision caret for TIF', () => {
    render(
      <PerpsProTradeForm
        controller={controller({ orderType: 'limit' })}
        onDeposit={jest.fn()}
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
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);
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
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

    fireEvent.press(screen.getAllByRole('checkbox')[1]);
    expect(trade.patchForm).toHaveBeenCalledWith({
      attachedTpSl: { ...attachedTpSl, enabled: false },
      reduceOnly: true,
    });
  });

  it('keeps Reduce Only directions clickable while disabling an empty-position checkbox', () => {
    const trade = controller({ reduceOnly: true });
    trade.reduceOnlyAvailability = {
      buyUnavailable: true,
      checkboxDisabled: false,
      hasPosition: true,
      sellUnavailable: false,
    };
    const view = render(
      <PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />,
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
      <PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />,
    );
    expect(screen.getAllByRole('checkbox')[1].props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
