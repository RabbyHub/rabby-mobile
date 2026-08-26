import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsProHeader } from './PerpsProHeader';

const mockGetAliasName = jest.fn();
const mockSetPopupState = jest.fn();
const mockSharedHeaderProps = jest.fn();
let mockAccount = {
  address: '0x1234567890123456789012345678901234567890',
  aliasName: '',
  brandName: 'metamask',
};

jest.mock('@/core/apis', () => ({
  apiContact: {
    getAliasName: (...args: unknown[]) => mockGetAliasName(...args),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: (selector: (state: object) => unknown) =>
    selector({ currentPerpsAccount: mockAccount }),
}));

jest.mock('../../../Perps/hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{ isShowLoginPopup: false }, mockSetPopupState],
}));

jest.mock('../../../PerpsShared/components/PerpsHeader', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    PerpsHeader: (props: any) => {
      mockSharedHeaderProps(props);
      const {
        accountLabel,
        activeMode,
        extendProHitAreaRight,
        onPressAccount,
        onSelectMode,
        showBottomDivider,
      } = props;
      return ReactModule.createElement(
        View,
        {
          accessibilityLabel: `${activeMode}:${String(
            extendProHitAreaRight,
          )}:${String(accountLabel)}:${String(showBottomDivider)}`,
          testID: 'shared-header',
        },
        ReactModule.createElement(Pressable, {
          onPress: () => onSelectMode('simple'),
          testID: 'switch-to-simple',
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

describe('PerpsProHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount = {
      address: '0x1234567890123456789012345678901234567890',
      aliasName: '',
      brandName: 'metamask',
    };
    mockGetAliasName.mockReturnValue('Contact alias');
  });

  it('keeps the narrow account owner and renders the shared Pro header', () => {
    const onSwitchToSimple = jest.fn();
    const screen = render(
      <PerpsProHeader
        isModeSwitching={false}
        onSwitchToSimple={onSwitchToSimple}
        showBottomDivider
      />,
    );

    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'pro:undefined:Contact alias:true',
    );
    expect(mockGetAliasName).toHaveBeenCalledWith(mockAccount.address);
    expect(mockSharedHeaderProps.mock.lastCall?.[0]).toMatchObject({
      accountAddress: mockAccount.address,
      accountBrandName: 'metamask',
      accountTriggerVariant: 'wallet',
    });

    fireEvent.press(screen.getByTestId('switch-to-simple'));
    expect(onSwitchToSimple).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('account-trigger'));
    expect(mockSetPopupState).toHaveBeenCalledTimes(1);
    const update = mockSetPopupState.mock.calls[0]?.[0];
    expect(update({ isShowLoginPopup: false, untouched: true })).toEqual({
      isShowLoginPopup: true,
      untouched: true,
    });
  });

  it('prefers the account alias so mode changes cannot alter its width source', () => {
    mockAccount = { ...mockAccount, aliasName: 'Wallet alias' };
    const screen = render(
      <PerpsProHeader
        isModeSwitching={false}
        onSwitchToSimple={jest.fn()}
        showBottomDivider={false}
      />,
    );

    expect(screen.getByTestId('shared-header').props.accessibilityLabel).toBe(
      'pro:undefined:Wallet alias:false',
    );
  });
});
