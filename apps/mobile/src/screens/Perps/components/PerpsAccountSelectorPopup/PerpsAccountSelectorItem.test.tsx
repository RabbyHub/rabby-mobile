import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { PortfolioEntry } from '@/hooks/perps/usePerpsPortfolioStore';

const mockT = jest.fn((key: string, params?: { count?: number }) =>
  key.endsWith('positionCount')
    ? params?.count === 1
      ? '1 Position'
      : `${params?.count} Positions`
    : key,
);

let mockPortfolioEntry: PortfolioEntry | null = null;
let mockLiveValue: number | null = null;
let mockIsSameAddress = false;

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
jest.mock('@/hooks/perps/usePerpsPortfolioStore', () => ({
  usePerpsPortfolio: () => mockPortfolioEntry,
}));
jest.mock('@/hooks/perps/usePerpsPortfolioLiveValue', () => ({
  usePerpsPortfolioLiveValue: (enabled: boolean) =>
    enabled ? mockLiveValue : null,
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
  splitNumberByStep: (value: number | string) => String(value),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: () => mockIsSameAddress,
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

const portfolioEntry = (value: string): PortfolioEntry => ({
  data: {
    day: {
      accountValueHistory: [[1_700_000_000_000, value]],
      pnlHistory: [],
      vlm: '0',
    },
  },
  status: 'ready',
  updatedAt: 1_700_000_000_000,
});

describe('PerpsAccountSelectorItem', () => {
  beforeEach(() => {
    mockT.mockClear();
    mockPortfolioEntry = null;
    mockLiveValue = null;
    mockIsSameAddress = false;
  });

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

  it('renders the portfolio value from the portfolio store', () => {
    mockPortfolioEntry = portfolioEntry('123.456');

    render(<PerpsAccountSelectorItem account={account} info={null} />);

    expect(screen.getByText('$123.46')).toBeTruthy();
  });

  it('prefers the WS live value on the current perps account row', () => {
    mockPortfolioEntry = portfolioEntry('123.45');
    mockLiveValue = 456.78;
    mockIsSameAddress = true;

    render(
      <PerpsAccountSelectorItem
        account={account}
        currentPerpsAddress={account.address}
        info={null}
      />,
    );

    expect(screen.getByText('$456.78')).toBeTruthy();
  });

  it('falls back to withdrawable when portfolio data is unavailable', () => {
    mockPortfolioEntry = {
      data: null,
      status: 'error',
      updatedAt: 0,
    };

    render(
      <PerpsAccountSelectorItem
        account={account}
        info={{ ...info(0), withdrawable: '50.125' }}
      />,
    );

    expect(screen.getByText('$50.13')).toBeTruthy();
  });

  it('hides the perps info for an empty account', () => {
    mockPortfolioEntry = portfolioEntry('0.0');
    // A non-zero wallet balance so the left column cannot render "$0.00" —
    // the query below must only be able to match the perps info slot.
    const funded = { ...account, balance: 5 };

    render(<PerpsAccountSelectorItem account={funded} info={info(0)} />);

    expect(screen.queryByText('$0.00')).toBeNull();
  });
});
