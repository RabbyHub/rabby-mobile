import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { FontNames } from '@/core/utils/fonts';

jest.mock('@/assets2024/icons/perps/PerpsHeaderAccountCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) =>
    ReactModule.createElement(View, {
      ...props,
      testID: 'header-account-caret',
    });
});

jest.mock('@/components/Icons/CaretArrowIconCC', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    CaretArrowIconCC: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'wallet-account-caret',
      }),
  };
});

jest.mock('@/components2024/WalletIcon/WalletIcon', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    WalletIcon: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'wallet-account-icon',
      }),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

import { PerpsAccountTrigger } from './PerpsAccountTrigger';

describe('PerpsAccountTrigger', () => {
  it('uses the shared Pro-sized visual contract and remains interactive', () => {
    const onPress = jest.fn();
    render(
      <PerpsAccountTrigger
        expanded={false}
        label="0x123...789"
        onPress={onPress}
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-account-trigger').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      borderRadius: 6,
      gap: 2,
      height: 26,
      maxWidth: 108,
      paddingHorizontal: 6,
    });
    expect(
      StyleSheet.flatten(screen.getByText('0x123...789').props.style),
    ).toMatchObject({
      fontFamily: FontNames.sf_pro,
      fontSize: 14,
      fontWeight: '400',
      includeFontPadding: false,
      lineHeight: 18,
    });
    expect(screen.getByTestId('header-account-caret').props.color).toBe(
      'neutral-foot',
    );
    fireEvent.press(screen.getByTestId('perps-account-trigger'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('matches the standard wallet selector without changing the compact variant', () => {
    render(
      <PerpsAccountTrigger
        address="0x1234567890123456789012345678901234567890"
        brandName="metamask"
        expanded
        label="Wallet alias"
        onPress={jest.fn()}
        variant="wallet"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-account-trigger').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 8,
      flexShrink: 1,
      gap: 4,
      height: 32,
      maxWidth: 180,
      paddingHorizontal: 8,
      paddingVertical: 6,
    });
    const walletLabelStyle = StyleSheet.flatten(
      screen.getByText('Wallet alias').props.style,
    );
    expect(walletLabelStyle).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    });
    expect(walletLabelStyle).not.toHaveProperty('includeFontPadding');
    expect(screen.getByTestId('wallet-account-icon').props).toMatchObject({
      address: '0x1234567890123456789012345678901234567890',
      height: 18,
      type: 'metamask',
      width: 18,
    });
    expect(screen.getByTestId('wallet-account-caret').props).toMatchObject({
      height: 14,
      lineColor: 'neutral-title-1',
      width: 14,
    });
  });
});
