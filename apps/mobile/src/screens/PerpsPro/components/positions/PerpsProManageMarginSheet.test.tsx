import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';

const mockInputBlur = jest.fn();
const mockInputFocus = jest.fn();
const mockInputSetNativeProps = jest.fn();
const mockKeyboardDismiss = jest
  .spyOn(Keyboard, 'dismiss')
  .mockImplementation(jest.fn());

jest.mock(
  '@/assets2024/icons/perps/PerpsProMarginAlarm.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsProMarginWarning.svg',
  () => require('react-native').View,
);
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          children,
          testID: 'manage-margin-modal',
        });
      },
    ),
  };
});
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({ onPress, title, ...props }: Record<string, unknown>) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      { ...props, onPress },
      ReactModule.createElement(Text, null, title),
    );
  },
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 34 } }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  return {
    BottomSheetTextInput: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          blur: mockInputBlur,
          focus: mockInputFocus,
          setNativeProps: mockInputSetNativeProps,
        }));
        return ReactModule.createElement(require('react-native').TextInput, {
          ...props,
          testBottomSheetInputHost: true,
        });
      },
    ),
    BottomSheetView: require('react-native').View,
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));
jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: jest.fn(),
}));
jest.mock('./PerpsProManageMarginSlider', () => ({
  PerpsProManageMarginSlider: (props: object) => {
    const ReactModule = require('react');
    return ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'manage-margin-slider',
    });
  },
}));

import type { PerpsProManageMarginView } from '../../scene/usePerpsProManageMargin';
import { PerpsProManageMarginSheet } from './PerpsProManageMarginSheet';

const baseView: PerpsProManageMarginView = {
  currentLiquidationDistance: '0.2',
  currentLiquidationPrice: '80',
  currentMargin: '20',
  direction: 'long',
  displayPair: 'BTC-USDC',
  entryPrice: '95',
  leverage: 10,
  markPrice: '100',
  projectedLiquidationDistance: '0.3',
  projectedLiquidationPrice: '70',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  range: {
    addOnly: false,
    current: '20',
    hasRepresentableRange: true,
    max: '25',
    min: '10.1',
    rawMax: '25',
    rawMin: '10.1',
  },
  sourceTag: null,
  targetState: 'valid',
};

const renderSheet = (
  overrides: Partial<
    React.ComponentProps<typeof PerpsProManageMarginSheet>
  > = {},
) => {
  const props: React.ComponentProps<typeof PerpsProManageMarginSheet> = {
    dirty: true,
    draft: '20',
    onBeginEditing: jest.fn(),
    onChangeDraft: jest.fn(),
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    onSelectTarget: jest.fn(),
    pending: false,
    view: baseView,
    visible: true,
    ...overrides,
  };
  render(<PerpsProManageMarginSheet {...props} />);
  return props;
};

describe('PerpsProManageMarginSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('matches the normal 552-point Figma geometry and dynamic market facts', () => {
    renderSheet();

    expect(screen.getByTestId('manage-margin-modal').props.snapPoints).toEqual([
      552,
    ]);
    expect(screen.getByTestId('manage-margin-modal').props).toMatchObject({
      android_keyboardInputMode: 'adjustPan',
      enableDynamicSizing: false,
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
    });
    expect(screen.getByText('BTC-USDC')).toBeTruthy();
    expect(screen.getByText('95.00')).toBeTruthy();
    expect(screen.getByText('100.00')).toBeTruthy();
    expect(screen.getByText('10.10')).toBeTruthy();
    expect(screen.getByText('25.00')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-amount-card').props.style,
      ),
    ).toMatchObject({ borderRadius: 12, height: 138, top: 164 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-risk').props.style,
      ).top,
    ).toBe(318);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-footer').props.style,
      ).bottom,
    ).toBe(40);
  });

  it('expands the amount area and moves risk facts for boundary warnings', () => {
    renderSheet({
      draft: '9',
      view: { ...baseView, targetState: 'belowMin' },
    });

    expect(screen.getByTestId('perps-pro-manage-margin-warning')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-amount-card').props.style,
      ).height,
    ).toBe(184);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-manage-margin-risk').props.style,
      ).top,
    ).toBe(364);
  });

  it('sanitizes decimal input and wires Min, MAX, slider, and confirm actions', () => {
    const props = renderSheet();

    fireEvent.changeText(
      screen.getByTestId('perps-pro-manage-margin-input'),
      '0012a.345',
    );
    expect(props.onChangeDraft).toHaveBeenCalledWith('12.34');
    expect(mockInputSetNativeProps).toHaveBeenCalledWith({ text: '12.34' });

    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-min'));
    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-max'));
    fireEvent(
      screen.getByTestId('manage-margin-slider'),
      'valueChange',
      '18.5',
    );
    expect(props.onSelectTarget).toHaveBeenNthCalledWith(1, '10.1');
    expect(props.onSelectTarget).toHaveBeenNthCalledWith(2, '25');
    expect(props.onSelectTarget).toHaveBeenNthCalledWith(3, '18.5');

    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-confirm'));
    expect(mockInputBlur).toHaveBeenCalled();
    expect(mockKeyboardDismiss).toHaveBeenCalled();
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks all mutations while the request outcome is pending', () => {
    const props = renderSheet({ pending: true });

    expect(screen.getByTestId('manage-margin-slider').props.disabled).toBe(
      true,
    );
    expect(
      screen.getByTestId('perps-pro-manage-margin-confirm').props.loading,
    ).toBe(true);
    fireEvent.press(screen.getByTestId('perps-pro-manage-margin-confirm'));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-manage-margin-input').props.editable,
    ).toBe(false);
  });
});
