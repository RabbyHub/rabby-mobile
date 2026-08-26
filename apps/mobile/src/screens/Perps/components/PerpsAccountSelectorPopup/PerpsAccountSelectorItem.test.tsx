import { render, screen } from '@testing-library/react-native';
import React from 'react';

const mockT = jest.fn((key: string, params?: { count?: number }) =>
  key.endsWith('positionCount')
    ? params?.count === 1
      ? '1 Position'
      : `${params?.count} Positions`
    : key,
);

jest.mock('@/assets/icons/common', () => ({
  RcIconCorrectCC: require('react-native').View,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components2024/WalletIcon/WalletIcon', () => ({
  WalletIcon: require('react-native').View,
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  isSameAccount: () => false,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, isLight: true, safeAreaInsets: {} }),
    };
  },
}));
jest.mock('@/screens/Address/components/AddressItemShadowView', () => ({
  AddressItemShadowView: require('react-native').View,
}));
jest.mock('@/utils/address', () => ({ ellipsisAddress: () => '0xabc...def' }));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value}`,
  splitNumberByStep: (value: number | string) => String(value),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: () => false,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

import { PerpsAccountSelectorItem } from './PerpsAccountSelectorItem';

const account = {
  address: '0x0000000000000000000000000000000000000001',
  aliasName: 'Wallet',
  balance: 0,
  brandName: 'metamask',
  type: 'watch',
} as any;

const info = (count: number) =>
  ({
    assetPositions: Array.from({ length: count }, () => ({})),
    withdrawable: '0',
  } as any);

describe('PerpsAccountSelectorItem', () => {
  beforeEach(() => mockT.mockClear());

  it.each([
    [1, '1 Position'],
    [2, '2 Positions'],
  ])('uses i18next pluralization for %i positions', (count, expected) => {
    render(<PerpsAccountSelectorItem account={account} info={info(count)} />);

    expect(screen.getByText(expected)).toBeTruthy();
    expect(mockT).toHaveBeenCalledWith(
      'page.perps.PerpsAccountSelectorPopup.positionCount',
      { count },
    );
  });
});
