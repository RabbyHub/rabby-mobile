import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsSimpleHeader } from './PerpsHeaderTitle';

const mockGetAliasName = jest.fn();
const mockSetPopupState = jest.fn();
const mockSharedHeaderProps = jest.fn();

jest.mock('@/core/apis', () => ({
  apiContact: {
    getAliasName: (...args: unknown[]) => mockGetAliasName(...args),
  },
}));

jest.mock('../hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{ isShowLoginPopup: false }, mockSetPopupState],
}));

jest.mock('../../PerpsShared/components/PerpsHeader', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    PerpsHeader: ({
      accountAddress,
      accountBrandName,
      accountLabel,
      accountTriggerVariant,
      activeMode,
      extendProHitAreaRight,
      onPressAccount,
      onPressInMode,
      onPressOutMode,
      onSelectMode,
      showBottomDivider,
    }: {
      accountAddress?: string;
      accountBrandName?: string;
      accountLabel?: string;
      accountTriggerVariant?: 'compact' | 'wallet';
      activeMode: 'simple' | 'pro';
      extendProHitAreaRight?: boolean;
      onPressAccount?: () => void;
      onPressInMode?: (mode: 'simple' | 'pro') => void;
      onPressOutMode?: (mode: 'simple' | 'pro') => void;
      onSelectMode: (mode: 'simple' | 'pro') => void;
      showBottomDivider: boolean;
    }) => {
      mockSharedHeaderProps({
        accountAddress,
        accountBrandName,
        accountTriggerVariant,
      });
      return ReactModule.createElement(
        View,
        {
          accessibilityLabel: `${activeMode}:${String(
            extendProHitAreaRight,
          )}:${String(accountLabel)}:${String(showBottomDivider)}`,
          testID: 'shared-header',
        },
        ReactModule.createElement(Pressable, {
          onPress: () => onSelectMode('pro'),
          onPressIn: () => onPressInMode?.('pro'),
          onPressOut: () => onPressOutMode?.('pro'),
          testID: 'switch-to-pro',
        }),
        onPressAccount
          ? ReactModule.createElement(Pressable, {
              onPress: onPressAccount,
              testID: 'account-trigger',
            })
          : null,
      );
    },
  };
});

describe('PerpsSimpleHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the shared page header and preserves the Simple mode corridor', () => {
    const onSwitchToPro = jest.fn();
    const onPressInPro = jest.fn();
    const onPressOutPro = jest.fn();
    const screen = render(
      <PerpsSimpleHeader
        account={{
          address: '0x1234567890123456789012345678901234567890',
          aliasName: 'Wallet alias',
          brandName: 'Rabby',
          type: 'WatchAddressKeyring',
        }}
        isModeSwitching={false}
        onPressInPro={onPressInPro}
        onPressOutPro={onPressOutPro}
        onSwitchToPro={onSwitchToPro}
      />,
    );

    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'simple:true:Wallet alias:false',
    );
    expect(mockGetAliasName).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890',
    );
    expect(mockSharedHeaderProps.mock.lastCall?.[0]).toMatchObject({
      accountAddress: '0x1234567890123456789012345678901234567890',
      accountBrandName: 'Rabby',
      accountTriggerVariant: 'wallet',
    });

    fireEvent(screen.getByTestId('switch-to-pro'), 'pressIn');
    fireEvent(screen.getByTestId('switch-to-pro'), 'pressOut');
    fireEvent.press(screen.getByTestId('switch-to-pro'));
    expect(onPressInPro).toHaveBeenCalledTimes(1);
    expect(onPressOutPro).toHaveBeenCalledTimes(1);
    expect(onSwitchToPro).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing popup owner and uses Contact alias as fallback', () => {
    mockGetAliasName.mockReturnValue('Contact alias');
    const screen = render(
      <PerpsSimpleHeader
        account={{
          address: '0x1234567890123456789012345678901234567890',
          aliasName: '',
          brandName: 'Rabby',
          type: 'WatchAddressKeyring',
        }}
        isModeSwitching={false}
        onSwitchToPro={jest.fn()}
      />,
    );

    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'simple:true:Contact alias:false',
    );

    fireEvent.press(screen.getByTestId('account-trigger'));
    expect(mockSetPopupState).toHaveBeenCalledTimes(1);
    const update = mockSetPopupState.mock.calls[0]?.[0];
    expect(update({ isShowLoginPopup: false, untouched: true })).toEqual({
      isShowLoginPopup: true,
      untouched: true,
    });
  });
});
