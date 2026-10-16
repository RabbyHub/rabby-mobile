import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, UIManager } from 'react-native';
import { navBack } from '@/hooks/navigation';

import { PERPS_HEADER_HEIGHT } from '../constants';
import { PerpsHeader } from './PerpsHeader';

jest.mock('@/assets2024/icons/perps/PerpsHeaderBackground.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsHeaderBack.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/hooks/navigation', () => {
  return {
    navBack: jest.fn(),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const { Pressable, TouchableOpacity } = require('react-native');
  return { Pressable, TouchableOpacity };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('./PerpsModeSwitch', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsModeSwitch: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'mode-switch',
      }),
  };
});

jest.mock('./PerpsAccountTrigger', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsAccountTrigger: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'account-trigger',
      }),
  };
});

describe('PerpsHeader', () => {
  it('owns the single Figma geometry used by both modes', () => {
    const onPressAccount = jest.fn();
    const onPressInMode = jest.fn();
    const onPressOutMode = jest.fn();
    const onSelectMode = jest.fn();
    const screen = render(
      <PerpsHeader
        accountExpanded={false}
        accountLabel="Hongbo"
        activeMode="simple"
        extendProHitAreaRight
        isModeSwitching={false}
        onPressAccount={onPressAccount}
        onPressInMode={onPressInMode}
        onPressOutMode={onPressOutMode}
        onSelectMode={onSelectMode}
        showBottomDivider={false}
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-header').props.style),
    ).toMatchObject({
      backgroundColor: 'transparent',
      gap: 8,
      height: PERPS_HEADER_HEIGHT,
      paddingLeft: 16,
      paddingRight: 16,
      position: 'relative',
    });
    expect(screen.queryByTestId('perps-header-bottom-divider')).toBeNull();
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-header-left').props.style),
    ).toMatchObject({ flex: 1, gap: 4, minWidth: 0 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-header-identity').props.style,
      ),
    ).toMatchObject({ flex: 1, minWidth: 0 });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-header-back').props.style),
    ).toMatchObject({
      height: 44,
      width: 24,
    });
    expect(
      screen.getByTestId('perps-header-background-mark').props,
    ).toMatchObject({
      height: 48,
      width: 61,
    });
    expect(screen.getByTestId('mode-switch').props).toMatchObject({
      activeMode: 'simple',
      disabled: false,
      extendProHitAreaRight: true,
      onPressInMode,
      onPressOutMode,
      onSelectMode,
    });
    expect(screen.getByTestId('account-trigger').props).toMatchObject({
      expanded: false,
      label: 'Hongbo',
      onPress: onPressAccount,
    });
    fireEvent.press(screen.getByTestId('perps-header-back'));
    expect(navBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the same shell when Pro is active and no account is available', () => {
    const screen = render(
      <PerpsHeader
        activeMode="pro"
        isModeSwitching
        onSelectMode={jest.fn()}
        showBottomDivider
      />,
    );

    expect(
      StyleSheet.flatten(screen.getByTestId('perps-header').props.style),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      height: PERPS_HEADER_HEIGHT,
    });
    expect(screen.getByTestId('mode-switch').props).toMatchObject({
      activeMode: 'pro',
      disabled: true,
      extendProHitAreaRight: false,
    });
    expect(screen.queryByTestId('account-trigger')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-header-bottom-divider').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-5',
      bottom: 0,
      height: 1,
      left: 0,
      position: 'absolute',
      right: 0,
    });
  });

  describe('back button touch handling', () => {
    function touchEvent(pageX: number, pageY: number) {
      let defaultPrevented = false;
      const touch = { pageX, pageY };
      return {
        currentTarget: 1,
        dispatchConfig: { registrationName: 'onResponderGrant' },
        nativeEvent: { ...touch, touches: [touch], changedTouches: [touch] },
        persist: jest.fn(),
        preventDefault: () => {
          defaultPrevented = true;
        },
        isDefaultPrevented: () => defaultPrevented,
      };
    }

    function renderHeader() {
      return render(
        <PerpsHeader
          activeMode="simple"
          isModeSwitching={false}
          onSelectMode={jest.fn()}
          showBottomDivider={false}
        />,
      );
    }

    beforeEach(() => {
      jest.useFakeTimers();
      jest.mocked(navBack).mockClear();
      // Keep the real TouchableOpacity/Pressability, fixing only native layout.
      jest
        .spyOn(UIManager, 'measure')
        .mockImplementation((_target, callback) => {
          callback(0, 0, 24, 44, 20, 40);
        });
    });

    afterEach(() => {
      cleanup();
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('navigates once after an in-bounds 11-point movement and keeps its opacity', () => {
      const screen = renderHeader();
      const button = screen.getByTestId('perps-header-back');
      const release = touchEvent(43, 62);

      expect(
        screen.UNSAFE_getByType(TouchableOpacity).props.activeOpacity,
      ).toBe(0.8);
      fireEvent(button, 'responderGrant', touchEvent(32, 62));
      fireEvent(button, 'responderMove', release);
      fireEvent(button, 'responderRelease', release);

      expect(navBack).toHaveBeenCalledTimes(1);
    });

    it.each(['leaves the press region', 'loses the responder'])(
      'cancels when the touch %s and accepts the next tap',
      cancellation => {
        const screen = renderHeader();
        const button = screen.getByTestId('perps-header-back');

        fireEvent(button, 'responderGrant', touchEvent(32, 62));
        if (cancellation === 'leaves the press region') {
          const outside = touchEvent(200, 200);
          fireEvent(button, 'responderMove', outside);
          fireEvent(button, 'responderRelease', outside);
        } else {
          fireEvent(button, 'responderTerminate', touchEvent(32, 62));
        }
        expect(navBack).not.toHaveBeenCalled();

        fireEvent(button, 'responderGrant', touchEvent(32, 62));
        fireEvent(button, 'responderRelease', touchEvent(32, 62));
        expect(navBack).toHaveBeenCalledTimes(1);
      },
    );
  });
});
