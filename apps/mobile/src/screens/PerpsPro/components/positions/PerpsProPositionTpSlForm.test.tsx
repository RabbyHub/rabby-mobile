import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';

const mockAmountInputBlur = jest.fn();
const mockDecimalProps = jest.fn();
const mockSliderProps = jest.fn();
const mockTransProps = jest.fn();
const mockModeSheetProps = jest.fn();
let mockPositionModes: Record<'sl' | 'tp', 'pnl' | 'roi'> = {
  sl: 'pnl',
  tp: 'pnl',
};
const mockSetTpSlMode = jest.fn(
  async (selection: { leg: 'sl' | 'tp'; mode: 'pnl' | 'roi' }) => {
    mockPositionModes = {
      ...mockPositionModes,
      [selection.leg]: selection.mode,
    };
  },
);
const mockSliderHapticComplete = jest.fn();
const mockSliderHapticStart = jest.fn();
const mockSliderHapticValueChange = jest.fn();
const mockUseSliderHaptics = jest.fn();

jest.mock(
  '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg',
  () => () => null,
);

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ buttonStyle, disabled, onPress, testID, title }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityState: { disabled },
          disabled,
          onPress,
          style: buttonStyle,
          testID,
        },
        ReactModule.createElement(Text, null, title),
      ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  Trans: (props: { i18nKey: string }) => {
    mockTransProps(props);
    return props.i18nKey;
  },
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../trade/PerpsProDecimalTextInput', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    PerpsProDecimalTextInput: ReactModule.forwardRef(
      (
        { normalizeValue, onChangeText, ...props }: any,
        forwardedRef: React.Ref<unknown>,
      ) => {
        mockDecimalProps({ ...props, normalizeValue, onChangeText });
        ReactModule.useImperativeHandle(forwardedRef, () => ({
          blur: mockAmountInputBlur,
        }));
        return ReactModule.createElement(TextInput, {
          ...props,
          onChangeText: (value: string) =>
            onChangeText(normalizeValue ? normalizeValue(value) : value),
        });
      },
    ),
  };
});

jest.mock('./PerpsProPositionTpSlBottomSheetTextInput', () => ({
  PerpsProPositionTpSlBottomSheetTextInput: require('react-native').TextInput,
}));

jest.mock('../common/PerpsProSlider', () => ({
  PerpsProSlider: (props: object) => {
    mockSliderProps(props);
    return null;
  },
}));

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('../common/usePerpsProSliderHaptics', () => ({
  usePerpsProSliderHaptics: (options: object) => {
    mockUseSliderHaptics(options);
    return {
      onSlidingComplete: mockSliderHapticComplete,
      onSlidingStart: mockSliderHapticStart,
      onValueChange: mockSliderHapticValueChange,
    };
  },
}));

jest.mock('../trade/PerpsProTpSlModeSheet', () => ({
  PerpsProTpSlModeSheet: (props: object) => {
    mockModeSheetProps(props);
    return null;
  },
}));

jest.mock('../../scene/usePerpsProTpSlModePreferences', () => ({
  usePerpsProTpSlModePreferences: () => ({
    hydrated: true,
    opening: { sl: 'price', tp: 'price' },
    position: mockPositionModes,
    setMode: mockSetTpSlMode,
  }),
}));

import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsPositionTpSlKind,
  PerpsPositionTpSlOrderViewModel,
} from '../../model/positionTpSl';
import { PerpsProPositionTpSlBottomSheetTextInput } from './PerpsProPositionTpSlBottomSheetTextInput';
import { PerpsProPositionTpSlForm } from './PerpsProPositionTpSlForm';

const order = (
  kind: PerpsPositionTpSlKind,
  oid: number,
  triggerPrice: string,
  scope: 'partial' | 'position' = 'partial',
): PerpsPositionTpSlOrderViewModel => ({
  execution: 'market',
  key: `${scope}:${oid}`,
  kind,
  oid,
  originalSize: scope === 'position' ? '0' : '0.5',
  remainingSize: scope === 'position' ? '0' : '0.5',
  scope,
  side: 'A',
  timestamp: oid,
  triggerPrice,
});

const position = (
  tpslOrders: PerpsPositionTpSlOrderViewModel[] = [],
): PerpsPositionViewModel => ({
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '10',
  marginMode: 'cross',
  marginRatio: null,
  maxLeverage: 50,
  pnl: '0',
  quoteSize: '100',
  roiRatio: '0',
  tpslOrders,
});

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '100',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 3,
};

const props = () => ({
  amountUnit: 'base' as const,
  cancelingOids: [],
  markPrice: '100',
  market,
  onCancelOrder: jest.fn(),
  onReview: jest.fn(),
  pending: false,
});

describe('PerpsProPositionTpSlForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPositionModes = { sl: 'pnl', tp: 'pnl' };
  });

  it('keeps Modify disabled until a valid field changes, then builds cancel-and-recreate intent', () => {
    const initialOrder = order('takeProfit', 7, '110');
    const input = props();
    render(
      <PerpsProPositionTpSlForm
        {...input}
        initialOrder={initialOrder}
        mode="modify"
        position={position([initialOrder])}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: true });
    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-price'),
      '112',
    );
    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: false });
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    expect(input.onReview).toHaveBeenCalledWith({
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: 7,
          size: '0.5',
          triggerPrice: '112',
        },
      ],
      mode: 'modify',
      scope: 'partial',
    });
    expect(mockSliderProps.mock.lastCall?.[0]).toMatchObject({ value: 0 });
    expect(
      screen.getByTestId('perps-pro-position-tpsl-amount').props.value,
    ).toBe('0.5');
    expect(
      screen.getByTestId('perps-pro-position-tpsl-amount-unit'),
    ).toHaveTextContent('BTC');
  });

  it('transfers Amount ownership between the input and Slider without retaining stale values', () => {
    const initialOrder = order('takeProfit', 7, '110');
    const keyboardDismiss = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(jest.fn());
    render(
      <PerpsProPositionTpSlForm
        {...props()}
        initialOrder={initialOrder}
        mode="modify"
        position={position([initialOrder])}
      />,
    );

    const amountInput = screen.getByTestId('perps-pro-position-tpsl-amount');
    fireEvent(amountInput, 'focus');
    act(() =>
      screen
        .getByTestId('perps-pro-position-tpsl-amount-slider-section')
        .props.onStartShouldSetResponderCapture(),
    );
    expect(mockAmountInputBlur).toHaveBeenCalledTimes(1);
    expect(keyboardDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      mockSliderProps.mock.lastCall?.[0].onSlidingStart(0);
      mockSliderProps.mock.lastCall?.[0].onValueChange(50);
      mockSliderProps.mock.lastCall?.[0].onSlidingComplete(50);
    });
    expect(mockSliderHapticStart).toHaveBeenCalledWith(0);
    expect(mockSliderHapticValueChange).toHaveBeenCalledWith(50);
    expect(mockSliderHapticComplete).toHaveBeenCalledTimes(1);
    expect(mockUseSliderHaptics).toHaveBeenCalledWith({
      disabled: false,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: expect.any(Number),
    });
    expect(
      screen.getByTestId('perps-pro-position-tpsl-slider-amount'),
    ).toHaveTextContent(/50%/);
    expect(mockSliderProps.mock.lastCall?.[0]).toMatchObject({ value: 50 });

    fireEvent(screen.getByTestId('perps-pro-position-tpsl-amount'), 'pressIn');
    fireEvent(screen.getByTestId('perps-pro-position-tpsl-amount'), 'focus');
    expect(mockSliderProps.mock.lastCall?.[0]).toMatchObject({ value: 0 });
    expect(
      screen.getByTestId('perps-pro-position-tpsl-amount').props.value,
    ).toBe('');
    expect(
      screen.queryByTestId('perps-pro-position-tpsl-slider-amount'),
    ).toBeNull();

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-amount'),
      '2',
    );
    expect(
      screen.getByTestId('perps-pro-position-tpsl-amount').props.value,
    ).toBe('1');
    const amountProps = mockDecimalProps.mock.calls
      .map(call => call[0])
      .find(item => item.testID === 'perps-pro-position-tpsl-amount');
    expect(amountProps.inputComponent).toBe(
      PerpsProPositionTpSlBottomSheetTextInput,
    );

    keyboardDismiss.mockRestore();
  });

  it('creates independent TP and SL legs with one shared amount and Mark validation', () => {
    const input = props();
    render(
      <PerpsProPositionTpSlForm {...input} mode="add" position={position()} />,
    );

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-price'),
      '110',
    );
    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-stopLoss-price'),
      '90',
    );
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));

    expect(input.onReview).toHaveBeenCalledWith({
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '1',
          triggerPrice: '110',
        },
        {
          kind: 'stopLoss',
          replaceOid: null,
          size: '1',
          triggerPrice: '90',
        },
      ],
      mode: 'add',
      scope: 'partial',
    });
    expect(
      screen.getAllByText('page.perps.pro.positionTpsl.triggerDescription'),
    ).toHaveLength(2);
    expect(mockSliderProps.mock.lastCall?.[0]).toMatchObject({
      maximumValue: 100,
      minimumValue: 0,
      pointCount: 5,
      step: 1,
      tone: 'neutral',
      value: 100,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-amount-section').props
          .style,
      ),
    ).toMatchObject({ gap: 8, marginTop: 24 });
    expect(mockTransProps.mock.calls.map(call => call[0].values)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pnl: '+10.00', roi: '+100.00' }),
        expect.objectContaining({ pnl: '-10.00', roi: '-100.00' }),
      ]),
    );
    expect(screen.queryByText(/Last/)).toBeNull();
  });

  it('blocks silent Position modification for duplicate same-side remote orders and exposes each Cancel', () => {
    const first = order('takeProfit', 1, '110', 'position');
    const second = order('takeProfit', 2, '120', 'position');
    const input = props();
    render(
      <PerpsProPositionTpSlForm
        {...input}
        mode="position"
        position={position([first, second])}
      />,
    );

    expect(
      screen.getByText('page.perps.pro.positionTpsl.duplicatePositionOrders'),
    ).toBeTruthy();
    expect(screen.getAllByText('global.cancel')).toHaveLength(2);
    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: true });
    fireEvent.press(screen.getAllByText('global.cancel')[1]!);
    expect(input.onCancelOrder).toHaveBeenCalledWith(second);
  });

  it('keeps both Position descriptions visible with placeholders and natural wrapping when no order exists', () => {
    render(
      <PerpsProPositionTpSlForm
        {...props()}
        mode="position"
        position={position()}
      />,
    );

    const takeProfitHint = screen.getByTestId(
      'perps-pro-position-tpsl-takeProfit-hint',
    );
    const stopLossHint = screen.getByTestId(
      'perps-pro-position-tpsl-stopLoss-hint',
    );
    expect(StyleSheet.flatten(takeProfitHint.props.style)).toMatchObject({
      minHeight: 32,
    });
    expect(
      StyleSheet.flatten(takeProfitHint.props.style).height,
    ).toBeUndefined();
    expect(StyleSheet.flatten(stopLossHint.props.style).height).toBeUndefined();
    expect(mockTransProps.mock.calls.map(call => call[0].values)).toEqual([
      expect.objectContaining({ pnl: '--', roi: '--', trigger: '--' }),
      expect.objectContaining({ pnl: '--', roi: '--', trigger: '--' }),
    ]);
  });

  it('uses the Figma inline-empty geometry, defaults to the full position, and keeps its pristine Confirm visually branded but non-actionable', () => {
    const input = props();
    render(
      <PerpsProPositionTpSlForm
        {...input}
        mode="add"
        position={position()}
        presentation="inline-empty"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-form-inline-empty').props
          .style,
      ),
    ).toMatchObject({ paddingHorizontal: 15, paddingTop: 24 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-amount-section').props
          .style,
      ),
    ).toMatchObject({ gap: 8, marginTop: 24 });
    expect(
      screen.getByTestId('perps-pro-position-tpsl-slider-amount'),
    ).toHaveTextContent(/100%/);
    expect(
      screen.getByTestId('perps-pro-position-tpsl-amount-unit'),
    ).toHaveTextContent('BTC');
    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: true });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-review').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'brand-default' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-footer').props.style,
      ),
    ).toMatchObject({ paddingBottom: 44, paddingTop: 12 });
    expect(mockSliderProps.mock.lastCall?.[0]).toMatchObject({ value: 100 });

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-price'),
      '110',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-footer').props.style,
      ),
    ).toMatchObject({ paddingBottom: 40, paddingTop: 12 });
    expect(mockTransProps.mock.lastCall?.[0].values).toMatchObject({
      pnl: '+10.00',
      roi: '+100.00',
    });
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    expect(input.onReview).toHaveBeenCalledWith({
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '1',
          triggerPrice: '110',
        },
      ],
      mode: 'add',
      scope: 'partial',
    });
  });

  it('keeps the Position form in the exact remaining Figma sheet height and bottom-anchors its footer', () => {
    render(
      <PerpsProPositionTpSlForm
        {...props()}
        minimumHeight={486}
        mode="position"
        position={position()}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-form-tab').props.style,
      ),
    ).toMatchObject({ minHeight: 486, paddingTop: 24 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-footer').props.style,
      ),
    ).toMatchObject({
      marginTop: 'auto',
      paddingBottom: 40,
      paddingTop: 12,
    });
  });

  it('defaults Position to PnL, hides Price, persists the leg, and limits input to two decimals', () => {
    const input = props();
    render(
      <PerpsProPositionTpSlForm {...input} mode="add" position={position()} />,
    );

    fireEvent.press(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input-mode'),
    );
    expect(mockModeSheetProps.mock.lastCall?.[0]).toMatchObject({
      allowedModes: ['pnl', 'roi'],
      selected: 'pnl',
      visible: true,
    });
    act(() => mockModeSheetProps.mock.lastCall?.[0].onSelect('roi'));
    expect(mockSetTpSlMode).toHaveBeenCalledWith({
      leg: 'tp',
      mode: 'roi',
      surface: 'position',
    });
    act(() => mockModeSheetProps.mock.lastCall?.[0].onSelect('pnl'));
    expect(
      mockDecimalProps.mock.calls
        .map(([inputProps]) => inputProps)
        .find(
          inputProps =>
            inputProps.testID ===
            'perps-pro-position-tpsl-takeProfit-mode-input',
        ),
    ).toMatchObject({ maxDecimals: 2 });
    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input'),
      '10.1234',
    );

    expect(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input').props
        .value,
    ).toBe('10.12');
    expect(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-price').props
        .value,
    ).toBe('110.12');
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    expect(input.onReview).toHaveBeenCalledWith({
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '1',
          triggerPrice: '110.12',
        },
      ],
      mode: 'add',
      scope: 'partial',
    });
  });

  it('keeps the current leg value when the already-selected mode is selected again', () => {
    const full = order('takeProfit', 9, '110', 'position');
    render(
      <PerpsProPositionTpSlForm
        {...props()}
        mode="position"
        position={position([full])}
      />,
    );

    fireEvent.press(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input-mode'),
    );
    act(() => mockModeSheetProps.mock.lastCall?.[0].onSelect('pnl'));
    expect(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-price').props
        .value,
    ).toBe('110');
  });

  it('shows the Desktop liquidation error on both full-position inputs without adding a PnL cap', () => {
    const input = props();
    render(
      <PerpsProPositionTpSlForm
        {...input}
        mode="position"
        position={position()}
      />,
    );

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-stopLoss-mode-input'),
      '40',
    );

    expect(
      screen.getByText(
        'page.perps.pro.positionTpsl.triggerHigherThanLiquidation',
      ),
    ).toBeTruthy();
    expect(mockTransProps.mock.lastCall?.[0].values).toMatchObject({
      pnl: '-40.00',
      roi: '-400.00',
      trigger: '60.00',
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-stopLoss-price-field').props
          .style,
      ),
    ).toMatchObject({ borderColor: 'red-default', borderWidth: 1 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-stopLoss-mode-input-field')
          .props.style,
      ),
    ).toMatchObject({ borderColor: 'red-default', borderWidth: 1 });
    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: true });

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-stopLoss-mode-input'),
      '10',
    );
    expect(
      screen.queryByText(
        'page.perps.pro.positionTpsl.triggerHigherThanLiquidation',
      ),
    ).toBeNull();
    expect(
      screen.getByTestId('perps-pro-position-tpsl-review').props
        .accessibilityState,
    ).toEqual({ disabled: false });

    fireEvent.changeText(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input'),
      '999999',
    );
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-review'));
    expect(input.onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        legs: expect.arrayContaining([
          expect.objectContaining({
            kind: 'takeProfit',
            triggerPrice: '1000099',
          }),
        ]),
        mode: 'position',
        scope: 'position',
      }),
    );
  });

  it('restores the persisted Position leg mode after the form remounts', async () => {
    const first = render(
      <PerpsProPositionTpSlForm
        {...props()}
        mode="position"
        position={position()}
      />,
    );
    fireEvent.press(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input-mode'),
    );
    await act(async () => {
      await mockModeSheetProps.mock.lastCall?.[0].onSelect('roi');
    });
    first.unmount();

    render(
      <PerpsProPositionTpSlForm
        {...props()}
        mode="position"
        position={position()}
      />,
    );
    fireEvent.press(
      screen.getByTestId('perps-pro-position-tpsl-takeProfit-mode-input-mode'),
    );

    expect(mockModeSheetProps.mock.lastCall?.[0]).toMatchObject({
      selected: 'roi',
    });
  });
});
