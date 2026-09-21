import { PERPS_PRO_DIALOG_TOKENS } from '../common/perpsProDialogVisual';
jest.mock('@/assets2024/icons/perps/PerpsProTransferUSDC.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
});
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const ReactNative = jest.requireActual('react-native');

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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
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
  it.each(['android', 'ios'] as const)(
    'preserves %s amount metrics through focus, typing, clearing, and shortcuts',
    platform => {
      let Sheet = PerpsProTransferSheet;
      jest.resetModules();
      jest.isolateModules(() => {
        jest.doMock('react', () => React);
        jest.doMock('react-native', () => ReactNative);
        jest.doMock('@/core/native/utils', () => ({
          IS_ANDROID: platform === 'android',
          IS_IOS: platform === 'ios',
        }));
        jest.doMock('@/utils/styles', () => {
          const actual = jest.requireActual('@/utils/styles');
          return {
            ...actual,
            createGetStyles2024: (factory: unknown) =>
              actual.createGetStyles2024(factory).getStyles,
          };
        });
        Sheet = jest.requireActual(
          './PerpsProTransferSheet',
        ).PerpsProTransferSheet;
      });
      const onConfirm = jest.fn();
      render(
        <Sheet
          available="10.119"
          onClose={jest.fn()}
          onConfirm={onConfirm}
          pending={false}
          visible
        />,
      );
      const input = screen.getByTestId('perps-pro-transfer-amount');
      expect(input.props).toMatchObject({
        cursorColor: PERPS_PRO_DIALOG_TOKENS.actionBackground,
        selectionColor: PERPS_PRO_DIALOG_TOKENS.actionBackground,
      });
      const style = StyleSheet.flatten(input.props.style);
      expect(style).toMatchObject({
        fontFamily:
          platform === 'android' ? 'SF-Pro-Rounded-Heavy' : 'SF Pro Rounded',
        fontSize: 36,
        height: 82,
        padding: 0,
      });
      if (platform === 'android') {
        expect(style.lineHeight).toBeUndefined();
        expect(style).toMatchObject({
          includeFontPadding: false,
          textAlignVertical: 'center',
        });
      } else {
        expect(style.lineHeight).toBe(42);
        expect(style.fontWeight).toBe('800');
        expect(style.includeFontPadding).toBeUndefined();
        expect(style.textAlignVertical).toBeUndefined();
      }
      expect(input.props).toMatchObject({
        allowFontScaling: false,
        keyboardType: 'decimal-pad',
        placeholder: '0',
        value: '',
      });
      fireEvent(input, 'focus');
      for (const value of ['2', '', '1.25']) {
        fireEvent.changeText(input, value);
        expect(screen.getByTestId('perps-pro-transfer-amount')).toBe(input);
        expect(input.props.value).toBe(value);
        expect(StyleSheet.flatten(input.props.style)).toEqual(style);
      }
      fireEvent(input, 'blur');
      fireEvent.press(screen.getByTestId('perps-pro-transfer-shortcut-0.25'));
      expect(input.props.value).toBe('2.52');
      expect(StyleSheet.flatten(input.props.style)).toEqual(style);
      fireEvent.press(screen.getByTestId('transfer-confirm'));
      expect(onConfirm).toHaveBeenCalledWith('2.52');
    },
  );

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
      snapPoints: [490],
    });
    expect(
      screen.getByTestId('transfer-sheet').props.backdropComponent({}).props
        .pressBehavior,
    ).toBe('close');
    expect(screen.getByTestId('transfer-confirm').props).toMatchObject({
      isDisabled: true,
      loading: false,
      type: 'primary',
    });
    expect(screen.getByTestId('transfer-confirm').props.buttonStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderRadius: 12 })]),
    );
    expect(
      screen.getByTestId('perps-pro-transfer-usdc-icon').props,
    ).toMatchObject({ height: 24, width: 24 });

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
      screen.getByTestId('transfer-sheet').props.backdropComponent({}).props
        .pressBehavior,
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
