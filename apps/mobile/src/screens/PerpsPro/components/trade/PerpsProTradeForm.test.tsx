import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

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

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('../positions/PerpsProLeverageSheet', () => ({
  PerpsProLeverageSheet: () => null,
}));

jest.mock('./PerpsProTradeOptionSheet', () => ({
  PerpsProTradeOptionSheet: () => null,
}));

jest.mock('./PerpsProMarginModeSheet', () => ({
  PerpsProMarginModeSheet: () => null,
}));

jest.mock('./PerpsProOrderTypeSheet', () => ({
  PerpsProOrderTypeSheet: () => null,
}));

import { createPerpsProTradeFormState } from '../../model/trade';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PerpsProTradeForm } from './PerpsProTradeForm';

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
    amountUnitLabel: 'USDC',
    availableQuote: '1000',
    beginAmountEntry: jest.fn(),
    confirmLeverage: jest.fn(async () => true),
    form: { ...createPerpsProTradeFormState(), ...formOverrides },
    getCostDisplayAmount: jest.fn(() => '0'),
    getEstimatedLiquidationPrice: jest.fn(() => null),
    getMaxDisplayAmount: jest.fn(() => '1000'),
    leverage: 25,
    leveragePending: false,
    marginMode: 'isolated',
    marginModeDisabledReason: null,
    market,
    patchForm: jest.fn(),
    pending: false,
    percentage: 0,
    requestReview: jest.fn(),
    resolvedAmount: null,
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
      setSubmitErrors: jest.fn(),
      submitErrors: [],
    },
  } as unknown as PerpsProTradeController);

describe('PerpsProTradeForm order matrix', () => {
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
    ).toMatchObject({ fontSize: 14, lineHeight: 18 });
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

  it('uses a smaller one-line Price placeholder and exposes no Tick buttons', () => {
    render(
      <PerpsProTradeForm
        controller={controller({ orderType: 'limit' })}
        onDeposit={jest.fn()}
      />,
    );
    const price = screen.getByLabelText('price(USDC)');

    expect(StyleSheet.flatten(price.props.style)?.fontSize).toBe(12);
    expect(price.props.multiline).toBe(false);
    expect(screen.queryByLabelText('Decrease price(USDC)')).toBeNull();
    expect(screen.queryByLabelText('Increase price(USDC)')).toBeNull();

    fireEvent(price, 'focus');
    expect(
      StyleSheet.flatten(screen.getByLabelText('price(USDC)').props.style)
        ?.fontSize,
    ).toBe(14);
  });

  it('allows only Market or manual Limit execution inside Conditional', () => {
    const view = render(
      <PerpsProTradeForm
        controller={controller({
          orderType: 'conditional',
          triggerPrice: '64000',
        })}
        onDeposit={jest.fn()}
      />,
    );

    expect(screen.getAllByTestId('perps-pro-trade-price-field')).toHaveLength(
      2,
    );
    expect(
      screen.getByTestId('perps-pro-trade-price-suffix-market'),
    ).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
    expect(screen.queryByTestId('perps-pro-trade-tif-trigger')).toBeNull();

    view.rerender(
      <PerpsProTradeForm
        controller={controller({
          conditionalExecution: 'limit',
          conditionalLimitPrice: '64100',
          orderType: 'conditional',
          triggerPrice: '64000',
        })}
        onDeposit={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-trade-price-suffix-limit'),
    ).toBeTruthy();
    expect(screen.queryByTestId('perps-pro-trade-price-suffix-BBO')).toBeNull();
  });

  it('routes the Amount unit control to the shared unit toggle', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

    fireEvent.press(screen.getByTestId('perps-pro-trade-amount-unit'));
    expect(trade.toggleAmountUnit).toHaveBeenCalledTimes(1);
  });

  it('uses focus as part of the Amount floating-label state', () => {
    render(
      <PerpsProTradeForm controller={controller()} onDeposit={jest.fn()} />,
    );
    const amountInput = screen.getByLabelText('amount(USDC)');

    expect(amountInput.props.placeholder).toBe('amount(USDC)');
    fireEvent(amountInput, 'focus');
    expect(screen.getByLabelText('amount(USDC)').props.multiline).toBe(false);
    expect(
      StyleSheet.flatten(screen.getByLabelText('amount(USDC)').props.style),
    ).toMatchObject({ height: 18, top: 16 });
    expect(
      screen.getByLabelText('amount(USDC)').props.placeholder,
    ).toBeUndefined();
    fireEvent(screen.getByLabelText('amount(USDC)'), 'blur');
    expect(screen.getByLabelText('amount(USDC)').props.placeholder).toBe(
      'amount(USDC)',
    );
  });

  it('renders liquidation for both sides and preserves unavailable as --', () => {
    const trade = controller() as any;
    trade.resolvedAmount = { baseSize: '1', quoteAmount: '63000' };
    trade.getEstimatedLiquidationPrice = jest.fn((side: 'buy' | 'sell') =>
      side === 'buy' ? '50000.00' : '--',
    );
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);

    expect(screen.getAllByText('liquidationPrice')).toHaveLength(2);
    expect(screen.getByText('50000.00 USDC')).toBeTruthy();
    expect(screen.getByText('--')).toBeTruthy();
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

  it('forwards continuous Slider changes and keeps five visual points', () => {
    const trade = controller();
    render(<PerpsProTradeForm controller={trade} onDeposit={jest.fn()} />);
    const slider = screen.getByTestId('rne-slider');

    expect(
      screen.getAllByTestId('perps-pro-trade-amount-slider-point'),
    ).toHaveLength(5);
    fireEvent(slider, 'valueChange', 42.6);
    expect(trade.setPercentage).toHaveBeenCalledWith(43);
    fireEvent(slider, 'slidingStart');
    expect(
      screen.getByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeTruthy();
    fireEvent(slider, 'slidingComplete', 43);
    expect(
      screen.queryByTestId('perps-pro-trade-amount-slider-tooltip'),
    ).toBeNull();
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
});
