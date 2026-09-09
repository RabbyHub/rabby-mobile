import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import {
  AppState,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import 'react-native-gesture-handler/jestSetup';
import {
  BottomSheetModalProvider,
  useBottomSheetModalInternal,
} from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const Native = require('react-native');
  return {
    __esModule: true,
    default: {
      View: Native.View,
      ScrollView: Native.ScrollView,
      createAnimatedComponent: (component: unknown) => component,
      addWhitelistedUIProps: jest.fn(),
      addWhitelistedNativeProps: jest.fn(),
    },
    Easing: { exp: (value: number) => value, out: (easing: unknown) => easing },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

let mockRouteFocused = true;
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockRouteFocused,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({
      colors2024: new Proxy({}, { get: (_target, key) => String(key) }),
    }),
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { amount: string }) =>
      options ? `Min ${options.amount}` : key,
  }),
}));

import { PerpsProKeyboardAccessory } from './PerpsProKeyboardAccessory';
import { perpsProKeyboardSession } from './perpsProKeyboardSession';

const SheetSurface = () => {
  const { hostName } = useBottomSheetModalInternal();
  return (
    <Portal hostName={hostName} name="sheet-surface">
      <View testID="sheet-surface" />
    </Portal>
  );
};

type MeasureCallback = Parameters<View['measureInWindow']>[0];
const measureOverlay = (windowY: number) => {
  const nativeOverlay = screen
    .UNSAFE_getAllByType(View)
    .find(node => node.props.testID === 'perps-pro-keyboard-overlay')!.instance;
  nativeOverlay.measureInWindow.mockImplementation(
    (callback: MeasureCallback) => callback(0, windowY, 393, 852),
  );
  fireEvent(screen.getByTestId('perps-pro-keyboard-overlay'), 'layout');
};

// Unit/component coverage: native keyboard events and route focus are boundaries.
describe('PerpsProKeyboardAccessory', () => {
  const platform = Platform.OS;
  const initialAppState = AppState.currentState;
  const statusBarHeight = StatusBar.currentHeight;
  const keyboardListeners = new Map<string, (event: unknown) => void>();
  let appStateListener: (state: string) => void;
  const removeKeyboardListener = jest.fn();
  const removeAppStateListener = jest.fn();
  const input = {
    blur: jest.fn(),
    isFocused: () => true,
    measureInWindow: jest.fn(),
  };
  const focus = (minimum: string | null = '15.35 USDC') =>
    act(() =>
      perpsProKeyboardSession.focus({
        id: 'amount',
        input,
        minimum,
        scrollTrade: false,
      }),
    );
  beforeEach(() => {
    AppState.currentState = 'active';
    StatusBar.currentHeight = 24;
    Platform.OS = 'ios';
    mockRouteFocused = true;
    input.blur.mockClear();
    keyboardListeners.clear();
    removeKeyboardListener.mockClear();
    removeAppStateListener.mockClear();
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(jest.fn());
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, listener) => {
        keyboardListeners.set(event, listener);
        return { remove: removeKeyboardListener };
      });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: removeAppStateListener };
      });
  });
  afterEach(() => {
    act(() => perpsProKeyboardSession.setEnabled(false));
    Platform.OS = platform;
    AppState.currentState = initialAppState;
    StatusBar.currentHeight = statusBarHeight;
    jest.restoreAllMocks();
  });

  it('absorbs toolbar touches and Done only blurs the active input and dismisses the keyboard', () => {
    render(<PerpsProKeyboardAccessory />, {
      wrapper: BottomSheetModalProvider,
    });
    focus();
    expect(screen.getByText('Min 15.35 USDC')).toBeTruthy();
    const bar = screen.getByTestId('perps-pro-keyboard-accessory');
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({
      height: 48,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    });
    expect(bar.props.onStartShouldSetResponder()).toBe(true);
    expect(input.blur).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('perps-pro-keyboard-done'));
    expect(input.blur).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(screen.queryByTestId('perps-pro-keyboard-minimum')).toBeNull();
  });

  it.each(['ios', 'android'] as const)(
    'keeps the rounded shadow outside the content clip on %s',
    platformOS => {
      Platform.OS = platformOS;
      render(<PerpsProKeyboardAccessory />, {
        wrapper: BottomSheetModalProvider,
      });
      focus();
      if (platformOS === 'android') {
        act(() =>
          keyboardListeners.get('keyboardDidShow')?.({
            endCoordinates: { screenY: 560, height: 300 },
          }),
        );
        measureOverlay(-24);
      }
      expect(screen.getByTestId('perps-pro-keyboard-shadow')).toHaveStyle({
        backgroundColor: 'neutral-bg-1',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'visible',
      });
      expect(screen.getByTestId('perps-pro-keyboard-accessory')).toHaveStyle({
        height: 48,
        backgroundColor: 'neutral-bg-1',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        overflow: 'hidden',
      });
      if (platformOS === 'android') {
        const shadow = screen.getByTestId('perps-pro-keyboard-android-shadow');
        // The canvas must include the 20pt upper shadow AND the 14pt corners.
        expect(shadow.props.height).toBe(34);
        expect(shadow.props.pointerEvents).toBe('none');
        expect(shadow).toHaveStyle({ top: -20 });
      } else {
        expect(screen.getByTestId('perps-pro-keyboard-shadow')).toHaveStyle({
          shadowColor: '#494B5B',
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 6,
          shadowOpacity: 0.06,
        });
        expect(
          screen.queryByTestId('perps-pro-keyboard-android-shadow'),
        ).toBeNull();
      }
      expect(screen.getByTestId('perps-pro-keyboard-minimum')).toHaveStyle({
        color: 'neutral-title-1',
      });
      expect(screen.getByText('global.Done')).toHaveStyle({ color: '#23C0B0' });
    },
  );

  it('removes ownership and listeners on leaving Pro, backgrounding and unmounting', () => {
    const view = render(<PerpsProKeyboardAccessory />, {
      wrapper: BottomSheetModalProvider,
    });
    focus(null);
    expect(screen.queryByTestId('perps-pro-keyboard-minimum')).toBeNull();
    act(() => appStateListener('background'));
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(screen.queryByTestId('perps-pro-keyboard-accessory')).toBeNull();
    act(() => appStateListener('active'));
    focus();
    mockRouteFocused = false;
    view.rerender(<PerpsProKeyboardAccessory />);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(screen.queryByTestId('perps-pro-keyboard-accessory')).toBeNull();
    view.unmount();
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(removeKeyboardListener).toHaveBeenCalledTimes(6);
  });

  it('shows the Android overlay only for a registered input with an open keyboard', () => {
    Platform.OS = 'android';
    render(<PerpsProKeyboardAccessory />, {
      wrapper: BottomSheetModalProvider,
    });
    focus();
    expect(screen.queryByTestId('perps-pro-keyboard-accessory')).toBeNull();
    act(() =>
      keyboardListeners.get('keyboardDidShow')?.({
        endCoordinates: { screenY: 560, height: 300 },
      }),
    );
    expect(screen.getByTestId('perps-pro-keyboard-accessory')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-keyboard-accessory'),
    ).not.toBeVisible();
    // Full-screen host at screen y=0: Paper reports -24 after removing the status bar.
    measureOverlay(-24);
    expect(screen.getByTestId('perps-pro-keyboard-position')).toHaveStyle({
      top: 512,
    });
    expect(screen.getByTestId('perps-pro-keyboard-accessory')).toBeVisible();
    // The same host after adjustPan moved the Activity up by 160.
    measureOverlay(-184);
    expect(screen.getByTestId('perps-pro-keyboard-position')).toHaveStyle({
      top: 672,
    });
    act(() => keyboardListeners.get('keyboardDidHide')?.({}));
    expect(screen.queryByTestId('perps-pro-keyboard-accessory')).toBeNull();
  });

  it('mounts above the existing sheet in the same real PortalHost and Done removes only the accessory', () => {
    Platform.OS = 'android';
    const view = render(
      <>
        <SheetSurface />
        <PerpsProKeyboardAccessory />
      </>,
      { wrapper: BottomSheetModalProvider },
    );
    focus(null);
    act(() =>
      keyboardListeners.get('keyboardDidShow')?.({
        endCoordinates: { screenY: 560, height: 300 },
      }),
    );
    const rendered = view.toJSON() as Array<{ props: { testID?: string } }>;
    expect(rendered.slice(-2).map(node => node.props.testID)).toEqual([
      'sheet-surface',
      'perps-pro-keyboard-overlay',
    ]);
    measureOverlay(-24);
    fireEvent.press(screen.getByTestId('perps-pro-keyboard-done'));
    expect(input.blur).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('perps-pro-keyboard-overlay')).toBeNull();
    expect(screen.getByTestId('sheet-surface')).toBeTruthy();
  });
});
