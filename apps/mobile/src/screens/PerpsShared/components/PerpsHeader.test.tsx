import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PERPS_HEADER_HEIGHT } from '../constants';
import { PerpsHeader } from './PerpsHeader';

jest.mock('@/assets2024/icons/perps/IconHyper.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, { ...props, testID: 'hyper-icon' });
});

jest.mock('@/hooks/navigation', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    HeaderBackPressable: (props: object) =>
      ReactModule.createElement(View, props),
  };
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
      backgroundColor: 'neutral-bg-0',
      gap: 8,
      height: PERPS_HEADER_HEIGHT,
      paddingLeft: 8,
      paddingRight: 15,
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
    ).toMatchObject({ flex: 1, gap: 16, minWidth: 0 });
    expect(
      StyleSheet.flatten(screen.getByTestId('perps-header-back').props.style),
    ).toMatchObject({
      height: 24,
      marginLeft: 0,
      paddingLeft: 0,
      width: 24,
    });
    expect(screen.getByTestId('hyper-icon').props).toMatchObject({
      height: 15,
      width: 19,
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
});
