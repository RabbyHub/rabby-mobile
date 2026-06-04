import { renderHook, waitFor } from '@testing-library/react-native';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { apiMnemonic } from '@/core/apis';
import { useAddressSource } from './useAddressSource';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => `t:${key}`,
  }),
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_CLASS: {
    GNOSIS: 'Gnosis Keyring',
    HARDWARE: {
      KEYSTONE: 'Keystone Hardware',
      LEDGER: 'Ledger Hardware',
      ONEKEY: 'OneKey Hardware',
      TREZOR: 'Trezor Hardware',
    },
  },
  KEYRING_TYPE: {
    HdKeyring: 'HD Key Tree',
    SimpleKeyring: 'Simple Key Pair',
    WatchAddressKeyring: 'Watch Address',
  },
}));

jest.mock('@/core/apis', () => ({
  apiMnemonic: {
    getMnemonicKeyringIfNeedPassphrase: jest.fn(),
  },
}));

jest.mock('@/utils/walletInfo', () => ({
  WALLET_INFO: {
    Rabby: {
      name: 'Rabby Wallet',
    },
  },
}));

const getMnemonicKeyringIfNeedPassphrase =
  apiMnemonic.getMnemonicKeyringIfNeedPassphrase as jest.Mock;

describe('useAddressSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the imported HD source when needPassphrase is already known', () => {
    const { result: imported } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.HdKeyring,
        brandName: '',
        byImport: true,
        needPassphrase: false,
      }),
    );
    const { result: importedWithPassphrase } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.HdKeyring,
        brandName: '',
        byImport: true,
        needPassphrase: true,
      }),
    );

    expect(imported.current).toBe('t:constant.IMPORTED_HD_KEYRING');
    expect(importedWithPassphrase.current).toBe(
      't:constant.IMPORTED_HD_KEYRING_NEED_PASSPHRASE',
    );
    expect(getMnemonicKeyringIfNeedPassphrase).not.toHaveBeenCalled();
  });

  it('updates imported HD source after async passphrase detection', async () => {
    getMnemonicKeyringIfNeedPassphrase.mockResolvedValue(true);

    const { result } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.HdKeyring,
        brandName: '',
        byImport: true,
        address: '0xabc',
      }),
    );

    expect(result.current).toBe('t:constant.IMPORTED_HD_KEYRING');

    await waitFor(() => {
      expect(result.current).toBe(
        't:constant.IMPORTED_HD_KEYRING_NEED_PASSPHRASE',
      );
    });
    expect(getMnemonicKeyringIfNeedPassphrase).toHaveBeenCalledWith(
      'address',
      '0xabc',
    );
  });

  it('keeps the imported HD fallback when async passphrase detection fails', async () => {
    getMnemonicKeyringIfNeedPassphrase.mockRejectedValue(new Error('locked'));

    const { result } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.HdKeyring,
        brandName: '',
        byImport: true,
        address: '0xabc',
      }),
    );

    await waitFor(() => {
      expect(getMnemonicKeyringIfNeedPassphrase).toHaveBeenCalled();
    });
    expect(result.current).toBe('t:constant.IMPORTED_HD_KEYRING');
  });

  it('uses translated labels for built-in software keyrings', () => {
    const { result: simple } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.SimpleKeyring,
        brandName: '',
      }),
    );
    const { result: watch } = renderHook(() =>
      useAddressSource({
        type: KEYRING_TYPE.WatchAddressKeyring,
        brandName: '',
      }),
    );

    expect(simple.current).toBe('t:constant.KEYRING_TYPE_TEXT.SimpleKeyring');
    expect(watch.current).toBe(
      't:constant.KEYRING_TYPE_TEXT.WatchAddressKeyring',
    );
  });

  it('falls back to static labels for hardware and safe keyrings', () => {
    const { result: ledger } = renderHook(() =>
      useAddressSource({
        type: KEYRING_CLASS.HARDWARE.LEDGER,
        brandName: '',
      }),
    );
    const { result: safe } = renderHook(() =>
      useAddressSource({
        type: KEYRING_CLASS.GNOSIS,
        brandName: '',
      }),
    );

    expect(ledger.current).toBe('Imported by Ledger');
    expect(safe.current).toBe('Imported by Safe');
  });
});
