import { apiKeyring, apiMnemonic } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KeyringTypeName, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useState, useCallback, useEffect } from 'react';

export const LedgerHDPathTypeLabel = {
  [LedgerHDPathType.LedgerLive]: 'Ledger Live',
  [LedgerHDPathType.BIP44]: 'BIP44',
  [LedgerHDPathType.Legacy]: 'Ledger Legacy',
};

export const useAccountsInfo = (
  type: KeyringTypeName,
  address: string,
  brand?: string,
) => {
  const [account, setAccount] = useState<{
    address: string;
    hdPathType: LedgerHDPathType;
    hdPathTypeLabel: string;
    index: number;
  }>();
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
    const info = await apiMnemonic.getMnemonicAddressInfo(address);
    if (info) {
      setAccount({
        address,
        index: info.index + 1,
        hdPathType: info.hdPathType as any,
        hdPathTypeLabel: LedgerHDPathTypeLabel[info.hdPathType],
      });
    }
  }, [address]);

  useEffect(() => {
    if (isLedger || isKeystone) {
      fetAccountInfo();
    } else if (isTrezorLike) {
      fetchTrezorLikeAccount();
    } else if (isMnemonics) {
      fetchMnemonicsAccount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return account;
};
