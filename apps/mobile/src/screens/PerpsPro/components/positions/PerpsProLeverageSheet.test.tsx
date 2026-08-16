import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';

const mockShowToast = jest.fn();
const mockSliderHapticComplete = jest.fn();
const mockSliderHapticStart = jest.fn();
const mockSliderHapticValueChange = jest.fn();
const mockUseSliderHaptics = jest.fn();
const mockBottomSheetInputBlur = jest.fn();
const mockBottomSheetInputFocus = jest.fn();
const mockBottomSheetInputSetNativeProps = jest.fn();
const mockKeyboardDismiss = jest
  .spyOn(Keyboard, 'dismiss')
  .mockImplementation(jest.fn());

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
          testID: 'leverage-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@/components2024/Button', () => ({
  Button: ({
    onPress,
    title,
    ...props
  }: {
    onPress: () => void;
    title: string;
  }) => {
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
          blur: mockBottomSheetInputBlur,
          focus: mockBottomSheetInputFocus,
          setNativeProps: mockBottomSheetInputSetNativeProps,
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
    t: (key: string, params?: { leverage?: number }) =>
      key.endsWith('adjustLeverage')
        ? 'Adjust Leverage'
        : key.endsWith('upToLeverage')
        ? `Up To ${params?.leverage}x`
        : key.endsWith('invalidLeverage')
        ? 'Invalid leverage'
        : 'Confirm',
  }),
}));

jest.mock('../common/PerpsProSlider', () => ({
  PerpsProSlider: (props: object) => {
    const ReactModule = require('react');
    const { View } = require('react-native');
    return ReactModule.createElement(View, {
      ...props,
      testID: 'leverage-slider',
    });
  },
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

import { PerpsProLeverageSheet } from './PerpsProLeverageSheet';

describe('PerpsProLeverageSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches the compact Figma contract and confirms the draft value', () => {
    const onConfirm = jest.fn();
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        pending={false}
        visible
      />,
    );

    expect(screen.getByTestId('leverage-sheet').props.snapPoints).toEqual([
      296,
    ]);
    expect(screen.getByTestId('leverage-sheet').props).toMatchObject({
      android_keyboardInputMode: 'adjustPan',
      enableDynamicSizing: false,
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('leverage-sheet').props.handleStyle,
      ),
    ).toMatchObject({ height: 40, paddingBottom: 27, paddingTop: 9 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('leverage-sheet').props.handleIndicatorStyle,
      ),
    ).toMatchObject({ height: 4, width: 40 });
    expect(screen.getByText('Adjust Leverage')).toBeTruthy();
    expect(screen.getByText('Up To 40x')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Adjust Leverage').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Up To 40x').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '20',
    );
    expect(
      screen.getByTestId('perps-pro-leverage-input').props
        .testBottomSheetInputHost,
    ).toBe(true);
    expect(screen.getByText('x').props.pointerEvents).toBe('none');
    fireEvent(screen.getByTestId('perps-pro-leverage-input'), 'focus', {
      nativeEvent: {},
    });
    expect(
      screen.getByTestId('perps-pro-leverage-input').props.selection,
    ).toEqual({ end: 2, start: 2 });
    expect(screen.getByTestId('leverage-slider').props).toMatchObject({
      dimWhenDisabled: false,
      pointCount: 5,
      showPoints: false,
      tone: 'neutral',
    });
    expect(mockUseSliderHaptics).toHaveBeenCalledWith({
      disabled: false,
      maximumValue: 40,
      minimumValue: 1,
      step: 1,
      value: 20,
    });
    expect(
      screen.getByTestId('leverage-slider').props.hideMinimumPoint,
    ).toBeUndefined();

    fireEvent(screen.getByTestId('leverage-slider'), 'slidingStart', 20);
    fireEvent(screen.getByTestId('leverage-slider'), 'valueChange', 30);
    fireEvent(screen.getByTestId('leverage-slider'), 'slidingComplete', 30);
    expect(mockSliderHapticStart).toHaveBeenCalledWith(20);
    expect(mockSliderHapticValueChange).toHaveBeenCalledWith(30);
    expect(mockSliderHapticComplete).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('perps-pro-leverage-increment'));
    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '31',
    );
    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(31);
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.height).toBe(
      36,
    );
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.type).toBe(
      'primary',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-leverage-footer').props.style,
      ),
    ).toMatchObject({ marginTop: 32, paddingBottom: 40 });
  });

  it('blurs the leverage input before the slider handles a touch', () => {
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );

    expect(
      screen
        .getByTestId('perps-pro-leverage-slider-section')
        .props.onStartShouldSetResponderCapture({ nativeEvent: {} }),
    ).toBe(false);

    expect(mockBottomSheetInputBlur).toHaveBeenCalledTimes(1);
    expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
    expect(mockSliderHapticStart).not.toHaveBeenCalled();
    expect(mockSliderHapticValueChange).not.toHaveBeenCalled();
  });

  it('keeps the complete market maximum visible at the slider endpoint', () => {
    const onConfirm = jest.fn();
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        pending={false}
        visible
      />,
    );

    fireEvent(screen.getByTestId('leverage-slider'), 'valueChange', 40);

    const input = screen.getByTestId('perps-pro-leverage-input');
    expect(input.props.value).toBe('40');
    expect(StyleSheet.flatten(input.props.style).width).toBeGreaterThanOrEqual(
      28,
    );

    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(40);
  });

  it('locks the pending slider without changing its visual appearance', () => {
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending
        visible
      />,
    );

    expect(screen.getByTestId('leverage-slider').props).toMatchObject({
      dimWhenDisabled: false,
      disabled: true,
    });
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.loading).toBe(
      true,
    );
  });

  it('clamps values above the market maximum while rejecting illegal characters', () => {
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );

    fireEvent.changeText(
      screen.getByTestId('perps-pro-leverage-input'),
      '-a401',
    );

    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '40',
    );
  });

  it('retains the leverage-specific empty selection while clearing and retyping', () => {
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );

    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), '');

    expect(
      screen.getByTestId('perps-pro-leverage-input').props.selection,
    ).toEqual({ end: 0, start: 0 });

    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), '1');

    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '1',
    );
    expect(
      screen.getByTestId('perps-pro-leverage-input').props.selection,
    ).toBeUndefined();
  });

  it.each(['', '0'])('treats %p as invalid and closes the sheet', draft => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={onClose}
        onConfirm={onConfirm}
        pending={false}
        visible
      />,
    );

    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), draft);
    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));

    expect(mockShowToast).toHaveBeenCalledWith('Invalid leverage', 'error');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
