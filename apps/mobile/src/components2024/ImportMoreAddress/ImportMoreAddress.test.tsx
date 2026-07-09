import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

const mockApiLedger = {
  getAddresses: jest.fn(),
  getCurrentAccounts: jest.fn(),
  getMaxAccountLimit: jest.fn(),
  importAddress: jest.fn(),
};

jest.mock('@/core/apis', () => ({
  apiLedger: mockApiLedger,
  apiKeystone: {},
  apiMnemonic: {
    getKeyringByMnemonic: jest.fn(),
  },
  apiOneKey: {},
  apiTrezor: {},
}));

jest.mock('@/components/HDSetting/MainContainer', () => {
  const { atom } = require('jotai');

  return {
    settingAtom: atom({ hdPath: 'LedgerLive', startNumber: 1 }),
  };
});

jest.mock('@/components/HDSetting/util', () => ({
  getAccountBalance: jest.fn(async () => 0),
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {
    info: jest.fn(),
    show: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {
    SETTING_HDKEYRING: 'SETTING_HDKEYRING',
    SETTING_KEYSTONE: 'SETTING_KEYSTONE',
    SETTING_LEDGER: 'SETTING_LEDGER',
    SETTING_ONEKEY: 'SETTING_ONEKEY',
    SETTING_TREZOR: 'SETTING_TREZOR',
  },
}));

jest.mock('@/hooks/account', () => ({
  useAccounts: () => ({ accounts: [] }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    colors2024: new Proxy(
      {},
      {
        get: () => '#000',
      },
    ),
    styles: {},
  }),
}));

jest.mock('@/utils/navigation', () => ({
  replace: jest.fn(),
}));

jest.mock('@/hooks/navigation', () => ({
  resetNavigationOnTopOfHome: jest.fn(),
}));

jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: jest.fn(async () => true),
}));

jest.mock('@/core/apis/mnemonic', () => ({
  activeAndPersistAccountsByMnemonics: jest.fn(),
}));

jest.mock('@/assets2024/icons/common/setting-cc.svg', () => () => null);

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('../Button', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');

  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('./AccountListView', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    AccountListView: () => <Text>account-list</Text>,
  };
});

jest.mock('./LoadingSkeleton', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    LoadingSkeleton: () => <Text>loading</Text>,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.refresh': 'Refresh',
        'page.newAddress.generatingWallets': 'Generating wallets',
        'page.newAddress.ledger.error.lockedOrNoEthApp':
          'Please keep Ledger unlocked and Ethereum APP open',
        'page.newAddress.ledger.error.unknown':
          'Connection failed, please go back and retry',
        'page.newAddress.seedPhrase.addMoreWalletTitle': 'Add more wallets',
        'page.newAddress.selectAddressesToAdd': 'Select addresses to add',
      }[key] || key),
  }),
}));

jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

const { ImportMoreAddress } =
  require('./ImportMoreAddress') as typeof import('./ImportMoreAddress');

describe('ImportMoreAddress', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockApiLedger.getMaxAccountLimit.mockResolvedValue(1);
    mockApiLedger.getCurrentAccounts.mockResolvedValue([]);
    mockApiLedger.getAddresses.mockRejectedValue(
      new Error('DisconnectedDeviceDuringOperation'),
    );
    global.requestIdleCallback = ((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 0 });
      return 0;
    }) as typeof requestIdleCallback;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('keeps a visible retry state when Ledger disconnects before any address loads', async () => {
    render(
      <ImportMoreAddress
        params={{
          type: KEYRING_TYPE.LedgerKeyring,
          brandName: 'Ledger',
        }}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockApiLedger.getAddresses).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Please keep Ledger unlocked and Ethereum APP open'),
      ).toBeTruthy();
    });

    expect(screen.getByText('Refresh')).toBeTruthy();
  });
});
