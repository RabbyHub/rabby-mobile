import { apiKeyring, apiMnemonic } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KeyringTypeName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useState, useCallback, useEffect } from 'react';

export const LedgerHDPathTypeLabel = {
  [LedgerHDPathType.LedgerLive]: 'Ledger Live',
  [LedgerHDPathType.BIP44]: 'BIP44',
  [LedgerHDPathType.Legacy]: 'Ledger Legacy',
};

type AccountInfoState = {
  address: string;
  hdPathType: LedgerHDPathType;
  hdPathTypeLabel: string;
  index: number;
};

export const useAccountsInfo = (
  type: KeyringTypeName,
  address: string,
  brand?: string,
) => {
  const [account, setAccount] = useState<AccountInfoState>();
  const isLedger = type === KEYRING_CLASS.HARDWARE.LEDGER;
  const isTrezorLike =
    type === KEYRING_CLASS.HARDWARE.TREZOR ||
    type === KEYRING_CLASS.HARDWARE.ONEKEY;
  const isMnemonics = type === KEYRING_CLASS.MNEMONIC;
  const isKeystone = brand === 'Keystone';
  const fetAccountInfo = useCallback(() => {
    apiKeyring
      .requestKeyring(type, 'getAccountInfo', null, address)
      .then(res => {
        setAccount({
          ...res,
          hdPathTypeLabel: LedgerHDPathTypeLabel[res.hdPathType],
        });
      });
  }, [address, type]);

  const fetchTrezorLikeAccount = useCallback(() => {
    apiKeyring
      .requestKeyring(type, 'indexFromAddress', null, address)
      .then(index => {
        setAccount({
          address,
          index: index + 1,
          hdPathType: LedgerHDPathType.BIP44,
          hdPathTypeLabel: LedgerHDPathTypeLabel.BIP44,
        });
      });
  }, [address, type]);

  const fetchMnemonicsAccount = useCallback(async () => {
    try {
      const info = await apiMnemonic.getMnemonicAddressInfo(address);
      if (info) {
        const hdPathType = info.hdPathType as unknown as LedgerHDPathType;
        setAccount({
          address,
          index: info.index + 1,
          hdPathType,
          hdPathTypeLabel: LedgerHDPathTypeLabel[hdPathType],
        });
        return;
      }
    } catch {
      // Locked wallets fall back to the public snapshot at the call site.
    }
    setAccount(undefined);
  }, [address]);

  useEffect(() => {
    if (isLedger || isKeystone) {
      fetAccountInfo();
    } else if (isTrezorLike) {
      fetchTrezorLikeAccount();
    } else if (isMnemonics) {
      fetchMnemonicsAccount();
    }
  }, [
    fetchMnemonicsAccount,
    fetchTrezorLikeAccount,
    fetAccountInfo,
    isKeystone,
    isLedger,
    isMnemonics,
    isTrezorLike,
  ]);

  return account;
};
