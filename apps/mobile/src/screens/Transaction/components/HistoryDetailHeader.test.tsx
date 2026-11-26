import React from 'react';
import { render, screen } from '@testing-library/react-native';

import type { KeyringAccountWithAlias } from '@/hooks/account';
import { useAccounts } from '@/hooks/account';

import { HistoryDetailHeader } from './HistoryDetailHeader';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/account', () => ({
  useAccounts: jest.fn(),
}));

// `@/utils/account` pulls the app's i18n/keychain bootstrap; only the priority
// picker is needed here.
jest.mock('@/utils/account', () => ({
  findAccountByPriority: (accounts: any[]) => accounts[0],
}));

jest.mock('@/components/AutoFitCenterHeader', () => ({
  AutoFitCenterHeader: ({ titleNode }: { titleNode?: React.ReactNode }) => (
    <>{titleNode}</>
  ),
}));

jest.mock('@/components/AccountSwitcher/OnScreenHeader', () => {
  const { Text } = require('react-native');
  return {
    ScreenHeaderAccountTitle: ({
      account,
    }: {
      account?: { type?: string; address?: string } | null;
    }) => (
      <Text testID="account-title">
        {account ? `${account.type}:${account.address}` : 'no-account'}
      </Text>
    ),
  };
});

jest.mock('./HistoryHeaderTitle', () => ({
  HistoryHeaderTitle: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const makeAccount = (
  type: string,
  address = ADDRESS,
): KeyringAccountWithAlias => ({ type, address } as KeyringAccountWithAlias);

const mockedUseAccounts = useAccounts as unknown as jest.Mock;

function renderHeader(
  props: React.ComponentProps<typeof HistoryDetailHeader>,
  accounts: KeyringAccountWithAlias[],
) {
  mockedUseAccounts.mockReturnValue({ accounts, fetchAccounts: jest.fn() });
  return render(<HistoryDetailHeader {...props} />);
}

describe('HistoryDetailHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers the route account when two account types share the address', () => {
    const watchOnly = makeAccount('WatchAddressKeyring');
    const local = makeAccount('HDKeyring');

    renderHeader(
      { title: 'Approved', account: local as any, address: ADDRESS },
      [watchOnly, local],
    );

    expect(screen.getByTestId('account-title')).toHaveTextContent(
      `HDKeyring:${ADDRESS}`,
    );
  });

  it('shows a watch-only account that is not part of the "my accounts" filter', () => {
    const watchOnly = makeAccount('WatchAddressKeyring');

    // `useAccounts` is the full list; the point is that the header does not
    // filter watch-only accounts out of the display.
    renderHeader(
      { title: 'Approved', account: watchOnly as any, address: ADDRESS },
      [watchOnly],
    );

    expect(screen.getByTestId('account-title')).toHaveTextContent(
      `WatchAddressKeyring:${ADDRESS}`,
    );
  });

  it('falls back to the keyring type carried by the history item', () => {
    const hd = makeAccount('HDKeyring');
    const simple = makeAccount('SimpleKeyring');

    renderHeader(
      { title: 'Approved', address: ADDRESS, keyringType: 'SimpleKeyring' },
      [hd, simple],
    );

    expect(screen.getByTestId('account-title')).toHaveTextContent(
      `SimpleKeyring:${ADDRESS}`,
    );
  });

  it('renders no account row when nothing matches', () => {
    renderHeader({ title: 'Approved', address: '0xdead' }, []);

    expect(screen.getByTestId('account-title')).toHaveTextContent('no-account');
  });
});
