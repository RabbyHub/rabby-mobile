import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SeedPhraseBar } from './SeedPhraseBar';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

// Component contract: use the real popup-dismiss helper, but replace wallet
// operations and the native sheet boundary. Native animation is device-owned.
const mockCreateModal = jest.fn();
const mockRemoveModal = jest.fn();
const mockEnsureUnlocked = jest.fn();
const mockEnterPassphrase = jest.fn();
const mockGetMnemonic = jest.fn();
const mockGenerateKeyring = jest.fn();
const mockStorePayload = jest.fn();

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockCreateModal(...args),
  removeGlobalBottomSheetModal2024: (...args: unknown[]) =>
    mockRemoveModal(...args),
}));
jest.mock('@/core/apis', () => ({
  apiMnemonic: {
    getMnemonicByAddress: (...args: unknown[]) => mockGetMnemonic(...args),
    generateKeyringWithMnemonic: (...args: unknown[]) =>
      mockGenerateKeyring(...args),
  },
}));
jest.mock('@/hooks/useEnterPassphraseModal', () => ({
  useEnterPassphraseModal: () => mockEnterPassphrase,
}));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: (...args: unknown[]) =>
    mockEnsureUnlocked(...args),
}));
jest.mock('@/core/utils/secretVault', () => ({
  storeMnemonicsPayload: (...args: unknown[]) => mockStorePayload(...args),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (style: unknown) => style,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/assets2024/icons/common/arrow-right-cc.svg', () => () => null);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const account = {
  address: '0x0000000000000000000000000000000000000001',
  type: KEYRING_TYPE.HdKeyring,
  brandName: KEYRING_CLASS.MNEMONIC,
} as React.ComponentProps<typeof SeedPhraseBar>['account'];

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateModal.mockReturnValue('IMPORT_MORE_ADDRESS_wallet-detail');
  mockRemoveModal.mockResolvedValue(undefined);
  mockEnsureUnlocked.mockResolvedValue(true);
  mockEnterPassphrase.mockResolvedValue('');
  mockGetMnemonic.mockResolvedValue('non-secret-test-fixture');
  mockGenerateKeyring.mockResolvedValue({ keyringId: 7, isExistedKR: true });
  mockStorePayload.mockReturnValue('opaque-test-vault-id');
});

async function openPopup(onCancel = jest.fn()) {
  const view = render(<SeedPhraseBar account={account} onCancel={onCancel} />);
  await act(async () => {
    fireEvent.press(
      view.getByText(
        'page.addressDetail.manage-addresses-under-this-seed-phrase',
      ),
    );
  });
  return { view, onCancel, config: mockCreateModal.mock.calls[0]?.[0] };
}

it('waits for native popup dismissal before completing the wallet-detail close', async () => {
  let finishDismiss!: () => void;
  mockRemoveModal.mockReturnValue(
    new Promise<void>(resolve => {
      finishDismiss = resolve;
    }),
  );
  const flow = await openPopup();
  const settled = jest.fn();
  const completion = Promise.resolve(flow.config.onCancel()).then(settled);

  expect(mockRemoveModal).toHaveBeenCalledWith(
    'IMPORT_MORE_ADDRESS_wallet-detail',
    { waitForDismiss: true },
  );
  await act(async () => {});
  expect(flow.onCancel).not.toHaveBeenCalled();
  expect(settled).not.toHaveBeenCalled();

  await act(async () => {
    finishDismiss();
    await completion;
  });
  expect(flow.onCancel).toHaveBeenCalledTimes(1);
  expect(settled).toHaveBeenCalledTimes(1);
});

it('preserves the existing account, keyring and first-result animation policy', async () => {
  const flow = await openPopup();
  expect(flow.config.params).toEqual({
    type: KEYRING_TYPE.HdKeyring,
    brandName: KEYRING_CLASS.MNEMONIC,
    account,
    keyringId: 7,
    isExistedKR: true,
    mnemonicsVaultId: 'opaque-test-vault-id',
  });
  await flow.config.onCancel();
  expect(flow.onCancel).toHaveBeenCalledTimes(1);
});

it('does not open the popup when the wallet unlock is declined', async () => {
  mockEnsureUnlocked.mockResolvedValue(false);
  await openPopup();
  expect(mockEnterPassphrase).not.toHaveBeenCalled();
  expect(mockGetMnemonic).not.toHaveBeenCalled();
  expect(mockCreateModal).not.toHaveBeenCalled();
});
