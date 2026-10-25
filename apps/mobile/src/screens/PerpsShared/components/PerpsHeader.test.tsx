import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';
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
  beforeEach(() => jest.clearAllMocks());
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
    expect(screen.queryByTestId('perps-header-account-controls')).toBeNull();
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

  it('lets the Root own the Pro background without changing header controls or decoration', () => {
    const onSelectMode = jest.fn();
    const onPressAccount = jest.fn();
    const screen = render(
      <PerpsHeader
        activeMode="pro"
        accountLabel="Hongbo"
        isModeSwitching={false}
        onPressAccount={onPressAccount}
        onSelectMode={onSelectMode}
        showBottomDivider={false}
        transparentBackground
      />,
    );

    expect(screen.getByTestId('perps-header')).toHaveStyle({
      backgroundColor: 'transparent',
      height: PERPS_HEADER_HEIGHT,
    });
    expect(
      screen.getByTestId('perps-header-background-mark').props,
    ).toMatchObject({ height: 48, width: 61, pointerEvents: 'none' });
    expect(screen.getByTestId('mode-switch').props).toMatchObject({
      activeMode: 'pro',
      disabled: false,
      onSelectMode,
    });
    expect(screen.getByTestId('account-trigger').props).toMatchObject({
      label: 'Hongbo',
      onPress: onPressAccount,
    });
  });

  it('separates Root navigation from business interaction and late mode-switch state', () => {
    const pagerUI = {
      position: { value: 1 },
      selectedIndex: { value: 1 },
      select: jest.fn(),
    } as unknown as RootScenePagerUI;
    const screen = render(
      <PerpsHeader
        activeMode="simple"
        accountLabel="Wallet"
        onPressAccount={jest.fn()}
        onSelectMode={jest.fn()}
        isModeSwitching
        businessControlsEnabled={false}
        navigationEnabled
        pagerUI={pagerUI}
        showBottomDivider={false}
      />,
    );
    expect(screen.getByTestId('mode-switch').props).toMatchObject({
      pagerUI,
      disabled: false,
    });
    expect(
      screen.getByTestId('perps-header-account-controls', {
        includeHiddenElements: true,
      }).props,
    ).toMatchObject({
      collapsable: false,
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
    });
    fireEvent.press(screen.getByTestId('perps-header-back'));
    expect(navBack).not.toHaveBeenCalled();
    screen.rerender(
      <PerpsHeader
        activeMode="simple"
        onSelectMode={jest.fn()}
        isModeSwitching={false}
        navigationEnabled={false}
        pagerUI={pagerUI}
        showBottomDivider={false}
      />,
    );
    expect(screen.getByTestId('mode-switch').props.disabled).toBe(true);
  });
});
