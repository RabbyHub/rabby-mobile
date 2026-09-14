jest.mock('@/assets2024/icons/perps/PerpsProLeveragePlus.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProLeverageMinus.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
});
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { perpsProKeyboardSession } from '../common/perpsProKeyboardSession';

const ReactNative = jest.requireActual('react-native');

jest.mock('@/core/native/utils', () => ({ IS_ANDROID: true }));
jest.mock('react-native-reanimated', () => ({
  useAnimatedReaction: jest.fn(),
}));

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

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  return {
    ANIMATION_STATUS: { STOPPED: 2 },
    SCROLLABLE_STATUS: { UNLOCKED: 1 },
    useBottomSheetInternal: () => ({
      animatedAnimationState: { value: { status: 2 } },
      animatedScrollableStatus: { value: 1 },
    }),
    BottomSheetScrollView: require('react-native').ScrollView,
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

  it('reserves Done space without remounting the focused leverage draft', () => {
    const show = jest.fn();
    const listener = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, callback) => {
        if (event === 'keyboardDidShow') {
          show.mockImplementation(callback);
        }
        return { remove: jest.fn() };
      });
    perpsProKeyboardSession.setEnabled(true);
    const view = render(
      <PerpsProLeverageSheet
        currentLeverage={20}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );
    fireEvent(screen.getByTestId('perps-pro-leverage-input'), 'focus');
    const owner = perpsProKeyboardSession.getSnapshot();
    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), '12');
    act(() => show({ endCoordinates: { height: 300, screenY: 500 } }));
    expect(screen.getByTestId('leverage-sheet').props.snapPoints).toEqual([
      410,
    ]);
    expect(perpsProKeyboardSession.getSnapshot()?.id).toBe(owner?.id);
    expect(owner?.sheetId).toBeDefined();
    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '12',
    );
    view.unmount();
    perpsProKeyboardSession.setEnabled(false);
    listener.mockRestore();
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
      362,
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
    ).toMatchObject({ height: 40, paddingBottom: 23.727184, paddingTop: 10 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('leverage-sheet').props.handleIndicatorStyle,
      ),
    ).toMatchObject({ height: 6.272816, width: 50.182529 });
    expect(screen.getByText('Adjust Leverage')).toBeTruthy();
    expect(screen.getByText('Up To 40x')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Adjust Leverage').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Up To 40x').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 20,
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
      appearance: 'leverage-dialog',
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
      52,
    );
    expect(screen.getByTestId('perps-pro-leverage-confirm').props.type).toBe(
      'primary',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-leverage-footer').props.style,
      ),
    ).toMatchObject({ paddingTop: 24, paddingBottom: 36 });
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
    const measure = screen.getByTestId('perps-pro-leverage-input-measure', {
      includeHiddenElements: true,
    });
    expect(measure.props.children).toBe('40');
    expect(measure.props.accessibilityElementsHidden).toBe(true);
    expect(StyleSheet.flatten(measure.props.style)).toMatchObject({
      fontSize: 36,
      fontVariant: ['tabular-nums'],
      opacity: 0,
    });
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      left: 0,
      right: 0,
      fontSize: 36,
      fontVariant: ['tabular-nums'],
    });

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

  it('keeps native cursor ownership while clearing and retyping leverage', () => {
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

    const input = screen.getByTestId('perps-pro-leverage-input');
    fireEvent(input, 'focus', { nativeEvent: {} });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Backspace' } });
    fireEvent.changeText(input, '');

    expect(
      screen.getByTestId('perps-pro-leverage-input').props.selection,
    ).toBeUndefined();

    fireEvent(input, 'keyPress', { nativeEvent: { key: '1' } });
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { end: 1, start: 1 } },
    });
    fireEvent.changeText(input, '1');

    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '1',
    );
    expect(
      screen.getByTestId('perps-pro-leverage-input').props.selection,
    ).toBeUndefined();
    expect(mockBottomSheetInputSetNativeProps).not.toHaveBeenCalledWith({
      selection: { end: 0, start: 0 },
    });
  });

  it('keeps an empty replacement draft disabled without closing the sheet', () => {
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

    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), '');
    expect(
      screen.getByTestId('perps-pro-leverage-confirm').props.accessibilityState,
    ).toEqual({ disabled: true });
    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));

    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('normalizes a manually entered zero to the minimum 1x', () => {
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

    fireEvent.changeText(screen.getByTestId('perps-pro-leverage-input'), '0');

    expect(screen.getByTestId('perps-pro-leverage-input').props.value).toBe(
      '1',
    );
    expect(
      screen.getByTestId('perps-pro-leverage-decrement').props
        .accessibilityState,
    ).toEqual({ disabled: true });
    fireEvent.press(screen.getByTestId('perps-pro-leverage-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(1);
  });
});

it.each(['android', 'ios'] as const)(
  'preserves input geometry through editing with the real %s font factory',
  platform => {
    let Sheet = PerpsProLeverageSheet;
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
        './PerpsProLeverageSheet',
      ).PerpsProLeverageSheet;
    });

    render(
      <Sheet
        currentLeverage={21}
        maxLeverage={40}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        pending={false}
        visible
      />,
    );
    const input = screen.getByTestId('perps-pro-leverage-input');
    const inputStyle = StyleSheet.flatten(input.props.style);
    const measureStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-leverage-input-measure', {
        includeHiddenElements: true,
      }).props.style,
    );
    expect(inputStyle).toMatchObject({
      fontFamily:
        platform === 'android' ? 'SF-Pro-Rounded-Bold' : 'SF Pro Rounded',
      fontSize: 36,
      fontVariant: ['tabular-nums'],
      height: platform === 'android' ? 54 : 42,
      top: platform === 'android' ? -6 : 0,
    });
    expect(measureStyle).toMatchObject({ height: 42, lineHeight: 42 });
    expect(inputStyle.top + inputStyle.height / 2).toBe(
      measureStyle.height / 2,
    );
    expect(StyleSheet.flatten(screen.getByText('x').props.style)).toMatchObject(
      {
        fontSize: 36,
        lineHeight: 42,
      },
    );
    if (platform === 'android') {
      expect(inputStyle.lineHeight).toBeUndefined();
      expect(inputStyle).toMatchObject({
        includeFontPadding: false,
        textAlignVertical: 'center',
      });
    } else {
      expect(inputStyle.lineHeight).toBe(42);
      expect(inputStyle.includeFontPadding).toBeUndefined();
      expect(inputStyle.textAlignVertical).toBeUndefined();
    }

    fireEvent(input, 'focus');
    expect(input.props.selection).toEqual({ start: 2, end: 2 });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Backspace' } });
    fireEvent.changeText(input, '2');
    expect(input.props.selection).toBeUndefined();
    for (const draft of ['', '1', '40']) {
      fireEvent.changeText(input, draft);
      expect(screen.getByTestId('perps-pro-leverage-input')).toBe(input);
      expect(input.props.value).toBe(draft);
      expect(StyleSheet.flatten(input.props.style)).toEqual(inputStyle);
    }
    fireEvent(input, 'blur');
    fireEvent(input, 'focus');
    expect(input.props.selection).toEqual({ start: 2, end: 2 });
    expect(StyleSheet.flatten(input.props.style)).toEqual(inputStyle);
  },
);
