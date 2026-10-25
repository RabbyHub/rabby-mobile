import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';
import { runOnUI } from 'react-native-reanimated';

import { PerpsModeSwitch } from './PerpsModeSwitch';

// Keep callback and disabled semantics real; native hit testing is device-only.
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    Pressable,
    Gesture: {
      Tap: () => {
        const tap = {
          enabled: () => tap,
          maxDistance: () => tap,
          onEnd: (callback: unknown) => {
            tap.callback = callback;
            return tap;
          },
          callback: undefined as unknown,
        };
        return tap;
      },
    },
    GestureDetector: ({ children, gesture }: any) =>
      ReactModule.createElement(
        View,
        {
          testID: `gesture-${children.props.testID}`,
          onGestureEnd: gesture.callback,
        },
        children,
      ),
  };
});

// Component protocol only: evaluate shared-value styles lazily, but do not
// claim to model a native worklet thread, font rendering, or tap arbitration.
jest.mock('react-native-reanimated', () => {
  const animatedValue = (read: () => object) =>
    new Proxy(
      {},
      {
        ownKeys: () => Object.keys(read()),
        getOwnPropertyDescriptor: () => ({
          configurable: true,
          enumerable: true,
        }),
        get: (_target, key) => (read() as Record<string, unknown>)[String(key)],
      },
    );
  return {
    __esModule: true,
    default: { View: require('react-native').View },
    useAnimatedStyle: animatedValue,
    useAnimatedProps: animatedValue,
    runOnUI: jest.fn(callback => callback),
  };
});

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text, AnimatedText: Text };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => 'New' }),
}));

describe('PerpsModeSwitch', () => {
  beforeEach(() => jest.clearAllMocks());
  it('marks the active label selected and only invokes the inactive mode', () => {
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch activeMode="simple" onSelectMode={onSelectMode} />,
    );

    expect(
      screen.getByTestId('perps-mode-simple').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: true,
    });
    expect(
      screen.getByTestId('perps-mode-pro').props.accessibilityState,
    ).toEqual({
      disabled: false,
      selected: false,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Perps').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '900',
      includeFontPadding: false,
      lineHeight: 24,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Pro').props.style),
    ).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '700',
      includeFontPadding: false,
      lineHeight: 24,
    });

    fireEvent.press(screen.getByTestId('perps-mode-simple'));
    expect(onSelectMode).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('perps-mode-pro'));
    expect(onSelectMode).toHaveBeenCalledTimes(1);
    expect(onSelectMode).toHaveBeenCalledWith('pro');
  });

  it('disables both labels while a mode save is in flight', () => {
    const onSelectMode = jest.fn();
    const onPressInMode = jest.fn();
    const onPressOutMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="pro"
        disabled
        onPressInMode={onPressInMode}
        onPressOutMode={onPressOutMode}
        onSelectMode={onSelectMode}
      />,
    );

    expect(
      screen.getByTestId('perps-mode-simple').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: false,
    });
    expect(
      screen.getByTestId('perps-mode-pro').props.accessibilityState,
    ).toEqual({
      disabled: true,
      selected: true,
    });
    expect(
      StyleSheet.flatten(screen.getByText('Perps').props.style),
    ).toMatchObject({ fontFamily: 'SF Pro Rounded' });
    expect(
      StyleSheet.flatten(screen.getByText('Pro').props.style),
    ).toMatchObject({ fontFamily: 'SF Pro Rounded' });

    ['simple', 'pro'].forEach(mode => {
      const target = screen.getByTestId(`perps-mode-${mode}`);
      fireEvent(target, 'pressIn');
      fireEvent(target, 'pressOut');
      fireEvent.press(target);
    });
    expect(onPressInMode).not.toHaveBeenCalled();
    expect(onPressOutMode).not.toHaveBeenCalled();
    expect(onSelectMode).not.toHaveBeenCalled();
  });

  it('lets only the Pro target own the remaining Simple Header corridor', () => {
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        extendProHitAreaRight
        onSelectMode={jest.fn()}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-simple').props.style),
    ).not.toHaveProperty('flex');
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-switch').props.style),
    ).toMatchObject({
      flex: 1,
      height: 44,
      minWidth: 0,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-pro').props.style),
    ).toMatchObject({
      alignItems: 'flex-start',
      flex: 1,
      height: '100%',
      justifyContent: 'center',
    });
  });

  it('reports press intent only for the enabled target before selection', () => {
    const onPressInMode = jest.fn();
    const onPressOutMode = jest.fn();
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        onPressInMode={onPressInMode}
        onPressOutMode={onPressOutMode}
        onSelectMode={onSelectMode}
      />,
    );

    fireEvent(screen.getByTestId('perps-mode-simple'), 'pressIn');
    fireEvent(screen.getByTestId('perps-mode-simple'), 'pressOut');
    expect(onPressInMode).not.toHaveBeenCalled();
    expect(onPressOutMode).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('perps-mode-pro'), 'pressIn');
    fireEvent(screen.getByTestId('perps-mode-pro'), 'pressOut');

    expect(onPressInMode).toHaveBeenCalledWith('pro');
    expect(onPressOutMode).toHaveBeenCalledWith('pro');
    expect(onSelectMode).not.toHaveBeenCalled();
  });

  it('renders the Figma New badge without changing the Pro press target', () => {
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        extendProHitAreaRight
        onSelectMode={onSelectMode}
        showProNewBadge
      />,
    );

    expect(screen.getByText('New')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('Pro').parent?.parent?.props.style),
    ).toMatchObject({
      alignItems: 'flex-start',
      flexDirection: 'row',
    });
    const badgeStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-new-badge').props.style,
    );
    expect(badgeStyle).toMatchObject({
      backgroundColor: 'red-light-1',
      borderRadius: 4,
      flexShrink: 0,
      marginLeft: -4,
      paddingHorizontal: 4,
      transform: [{ translateY: -8 }],
    });
    // Legacy Yoga resolves absolute percentages against the available target
    // width, so the badge must participate in the label's content row.
    expect(badgeStyle.position).not.toBe('absolute');
    expect(badgeStyle).not.toHaveProperty('left');
    expect(
      StyleSheet.flatten(screen.getByText('New').props.style),
    ).toMatchObject({
      color: 'red-default',
      fontFamily: 'SF Pro Rounded',
      fontSize: 10,
      fontWeight: '700',
      includeFontPadding: false,
      lineHeight: 16,
    });
    expect(screen.getByTestId('perps-pro-new-badge').props.pointerEvents).toBe(
      'none',
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-mode-pro').props.style),
    ).toMatchObject({ flex: 1, height: '100%' });

    fireEvent.press(screen.getByText('New'));
    expect(onSelectMode).toHaveBeenCalledTimes(1);
    expect(onSelectMode).toHaveBeenCalledWith('pro');
  });

  function rootUI(position = 0, selectedIndex = 0) {
    return {
      position: { value: position },
      selectedIndex: { value: selectedIndex },
      select: jest.fn(),
    } as unknown as RootScenePagerUI;
  }

  it('crossfades fixed-weight labels from track position without a React mode update', () => {
    const pagerUI = rootUI();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        pagerUI={pagerUI}
        onSelectMode={jest.fn()}
      />,
    );
    const hidden = { includeHiddenElements: true };
    const simpleActive = screen.getByTestId(
      'perps-mode-simple-active-label',
      hidden,
    );
    const proActive = screen.getByTestId('perps-mode-pro-active-label', hidden);
    const proInactive = screen.getByTestId(
      'perps-mode-pro-inactive-label',
      hidden,
    );
    expect(simpleActive).toHaveStyle({ opacity: 1 });
    expect(proActive).toHaveStyle({ opacity: 0 });
    pagerUI.position.value = 0.4;
    expect(simpleActive).toHaveStyle({ opacity: 0.6 });
    expect(proActive).toHaveStyle({ opacity: 0.4 });
    expect(proInactive).toHaveStyle({ opacity: 0.6 });
    pagerUI.position.value = 1;
    expect(proActive).toHaveStyle({ opacity: 1 });
    expect(simpleActive).toHaveStyle({ opacity: 0 });
    expect(proActive).toHaveStyle({
      fontFamily: 'SF Pro Rounded',
      fontWeight: '900',
    });
    expect(proInactive).toHaveStyle({
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      position: 'absolute',
    });
  });

  it('sends Root taps directly to the UI owner even with stale React selection, without JS prewarm/navigation', () => {
    const pagerUI = rootUI(1, 1);
    const onSelectMode = jest.fn();
    const onPressInMode = jest.fn();
    const onPressOutMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        pagerUI={pagerUI}
        onSelectMode={onSelectMode}
        onPressInMode={onPressInMode}
        onPressOutMode={onPressOutMode}
      />,
    );
    fireEvent(
      screen.getByTestId('gesture-perps-mode-simple'),
      'gestureEnd',
      {},
      true,
    );
    fireEvent(
      screen.getByTestId('gesture-perps-mode-pro'),
      'gestureEnd',
      {},
      true,
    );
    fireEvent(
      screen.getByTestId('gesture-perps-mode-pro'),
      'gestureEnd',
      {},
      false,
    );
    expect(pagerUI.select).toHaveBeenNthCalledWith(1, 0);
    expect(pagerUI.select).toHaveBeenNthCalledWith(2, 1);
    expect(pagerUI.select).toHaveBeenCalledTimes(2);
    expect(onSelectMode).not.toHaveBeenCalled();
    expect(onPressInMode).not.toHaveBeenCalled();
    expect(onPressOutMode).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-mode-pro').props.animatedProps
        .accessibilityState,
    ).toEqual({
      disabled: false,
      selected: true,
    });
    expect(
      screen.getByTestId('perps-mode-simple').props.animatedProps
        .accessibilityState,
    ).toEqual({
      disabled: false,
      selected: false,
    });
  });

  it('uses the same UI selector for accessibility and respects the navigation gate', () => {
    const pagerUI = rootUI();
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsModeSwitch
        activeMode="simple"
        pagerUI={pagerUI}
        onSelectMode={onSelectMode}
      />,
    );
    fireEvent(screen.getByTestId('perps-mode-pro'), 'accessibilityTap');
    fireEvent(screen.getByTestId('perps-mode-simple'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(runOnUI).toHaveBeenCalledWith(pagerUI.select);
    expect(pagerUI.select).toHaveBeenNthCalledWith(1, 1);
    expect(pagerUI.select).toHaveBeenNthCalledWith(2, 0);
    screen.rerender(
      <PerpsModeSwitch
        activeMode="simple"
        pagerUI={pagerUI}
        disabled
        onSelectMode={onSelectMode}
      />,
    );
    fireEvent(
      screen.getByTestId('gesture-perps-mode-pro'),
      'gestureEnd',
      {},
      true,
    );
    fireEvent(screen.getByTestId('perps-mode-pro'), 'accessibilityTap');
    expect(pagerUI.select).toHaveBeenCalledTimes(2);
    expect(onSelectMode).not.toHaveBeenCalled();
  });
});
