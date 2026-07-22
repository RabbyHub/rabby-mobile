import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { KeyringAccountWithAlias } from '@/types/account';

const mockNavigateToSingleHome = jest.fn();

jest.mock('@/assets/icons/home/more-cc.svg', () => () => null);

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {},
    colors2024: {},
  }),
}));

jest.mock('@/screens/Home/hooks/singleHome', () => ({
  apisSingleHome: {
    navigateToSingleHome: (...args: unknown[]) =>
      mockNavigateToSingleHome(...args),
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => () => ({}),
}));

jest.mock('@rabby-wallet/base-utils', () => ({
  addressUtils: {
    isSameAddress: (a: string, b: string) => a === b,
  },
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('./AddressItemContextMenu', () => ({
  AddressItemContextMenu: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('./AddressItemInner2024', () => ({
  AddressItemInner2024: ({ account }: { account: { address: string } }) => {
    const { Text } = require('react-native');
    return <Text>{account.address}</Text>;
  },
}));

jest.mock('./AddressItemShadowView', () => ({
  AddressItemShadowView: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('./MultiAssets/hooks', () => ({
  isTabsSwiping: { value: false },
}));

const { AddressItemEntry } =
  require('./AddressItem') as typeof import('./AddressItem');

describe('AddressItemEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps wallet selection and address management as separate press targets', () => {
    const account = {
      address: '0x1234',
      type: 'Simple Key Pair',
      brandName: 'Rabby',
    } satisfies KeyringAccountWithAlias;
    const onManage = jest.fn();

    render(
      <AddressItemEntry
        account={account}
        onManage={onManage}
        manageAccessibilityLabel="Manage wallet"
      />,
    );

    fireEvent.press(screen.getByLabelText('Manage wallet'));

    expect(onManage).toHaveBeenCalledTimes(1);
    expect(mockNavigateToSingleHome).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText(account.address));

    expect(mockNavigateToSingleHome).toHaveBeenCalledWith(account);
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});
