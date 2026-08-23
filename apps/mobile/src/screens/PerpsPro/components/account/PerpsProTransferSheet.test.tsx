import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/assets2024/icons/perps/PerpsProTransferDirectionArrow.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          testID: 'transfer-sheet',
        });
      },
    ),
  };
});
jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      buttonStyle,
      disabled,
      loading,
      onPress,
      title,
      titleStyle,
      type,
    }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          buttonStyle,
          disabled,
          isDisabled: disabled,
          loading,
          onPress,
          testID: 'transfer-confirm',
          titleStyle,
          type,
        },
        ReactModule.createElement(Text, null, title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
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
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetTextInput: require('react-native').TextInput,
  BottomSheetView: require('react-native').View,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'global.from': 'From',
        'global.to': 'To',
        'page.perps.pro.account.amount': 'Amount',
        'page.perps.pro.account.balance': 'Balance',
        'page.perps.pro.account.max': 'Max',
        'page.perps.pro.account.perps': 'Perps',
        'page.perps.pro.account.spot': 'Spot',
        'page.perps.pro.account.transfer': 'Transfer',
      }[key] ?? key),
  }),
}));

import { PerpsProTransferSheet } from './PerpsProTransferSheet';

describe('PerpsProTransferSheet', () => {
  it('uses the fixed Figma geometry and only enables a valid amount', () => {
    const onConfirm = jest.fn();
    render(
      <PerpsProTransferSheet
        available="10"
        onClose={jest.fn()}
        onConfirm={onConfirm}
        pending={false}
        visible
      />,
    );

    expect(screen.getByTestId('transfer-sheet').props).toMatchObject({
      enableDynamicSizing: false,
      enablePanDownToClose: true,
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
      snapPoints: [546],
    });
    expect(
      screen.getByTestId('transfer-sheet').props.backdropProps.pressBehavior,
    ).toBe('close');
    expect(screen.getByTestId('transfer-confirm').props).toMatchObject({
      isDisabled: true,
      loading: false,
      type: 'primary',
    });
    expect(screen.getByTestId('transfer-confirm').props.buttonStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderRadius: 8 })]),
    );
    expect(
      screen.getByTestId('perps-pro-transfer-usdc-icon').props.style,
    ).toEqual({ height: 24, width: 24 });

    fireEvent.changeText(screen.getByTestId('perps-pro-transfer-amount'), '2');
    expect(screen.getByTestId('transfer-confirm').props.isDisabled).toBe(false);
    fireEvent.press(screen.getByTestId('transfer-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('2');

    fireEvent.changeText(
      screen.getByTestId('perps-pro-transfer-amount'),
      '10.01',
    );
    expect(screen.getByTestId('transfer-confirm').props.isDisabled).toBe(true);
  });

  it('rounds shortcuts down to two decimals and locks every action while pending', () => {
    const view = render(
      <PerpsProTransferSheet
        available="10.119"
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-transfer-shortcut-0.25'));
    expect(screen.getByTestId('perps-pro-transfer-amount').props.value).toBe(
      '2.52',
    );

    view.rerender(
      <PerpsProTransferSheet
        available="10.119"
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending
        visible
      />,
    );
    expect(
      screen.getByTestId('transfer-sheet').props.enablePanDownToClose,
    ).toBe(false);
    expect(
      screen.getByTestId('transfer-sheet').props.backdropProps.pressBehavior,
    ).toBe('none');
    expect(screen.getByTestId('perps-pro-transfer-amount').props.editable).toBe(
      false,
    );
    expect(screen.getByTestId('transfer-confirm').props).toMatchObject({
      isDisabled: true,
      loading: true,
    });
    expect(
      screen.getByTestId('perps-pro-transfer-shortcut-0.25').props
        .accessibilityState.disabled,
    ).toBe(true);
  });
});
